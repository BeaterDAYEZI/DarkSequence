// 整局流程控制器：跑局状态机（旅行、节点进入、岔道、战斗结算、区域推进）
import type { RunState, MapNode, ZoneDef, CardDef, Rarity, HeroId } from '../core/types';
import { registry } from '../core/registry';
import { Rng, randomSeed } from '../core/rng';
import { createNewRun } from '../systems/run/RunState';
import { DeckSystem } from '../systems/run/DeckSystem';
import { generateAllZones } from '../systems/map/MapGenerator';
import { settleFork, type ForkRail } from '../systems/map/ForkSystem';
import { resolveMapEffect } from '../systems/map/MapEffects';
import { eventBus } from '../core/eventBus';

export type NodeEnter =
  | { type: 'battle'; monsters: { defId: string; count: number }[]; node: MapNode }
  | { type: 'station'; node: MapNode }
  | { type: 'event'; eventId: string; node: MapNode }
  | { type: 'fork'; node: MapNode };

export class RunController {
  readonly run: RunState;
  readonly rng: Rng;
  readonly deck: DeckSystem;

  constructor(seed?: number) {
    const s = seed ?? randomSeed();
    this.run = createNewRun(s);
    this.rng = new Rng(s);
    this.deck = new DeckSystem(this.run, this.rng);
    this.run.map = generateAllZones([...registry.zones.values()], this.rng);
    this.run.currentNodeId = this.run.map[0].id;
  }

  get currentZoneDef(): ZoneDef {
    const node = this.currentNode;
    return registry.zones.get(node?.zoneId ?? 'zone1')!;
  }

  get currentNode(): MapNode {
    return this.run.map.find((n) => n.id === this.run.currentNodeId)!;
  }

  zoneOf(nodeId: string): ZoneDef {
    return registry.zones.get(this.run.map.find((n) => n.id === nodeId)!.zoneId)!;
  }

  /** 当前节点的下游可达节点（排除未选中的岔道分支） */
  getReachable(): MapNode[] {
    const node = this.currentNode;
    const nextIds = node.type === 'fork'
      ? [this.chosenForkBranch(node)]
      : node.next;
    return nextIds.filter(Boolean).map((id) => this.nodeById(id));
  }

  nodeById(id: string): MapNode {
    return this.run.map.find((n) => n.id === id)!;
  }

  /** 岔道选择后的分支 */
  chosenForkBranch(forkNode: MapNode): string {
    const rail = this.run.flags[`fork_${forkNode.id}`] as ForkRail | undefined;
    if (!rail) return '';
    return rail === 'memory' ? forkNode.next[0] : forkNode.next[1];
  }

  isForkChosen(forkNode: MapNode): boolean {
    return !!this.run.flags[`fork_${forkNode.id}`];
  }

  /** 旅行到指定节点并触发其进入效果 */
  travelTo(nodeId: string): NodeEnter | null {
    const reachable = this.getReachable();
    if (!reachable.some((n) => n.id === nodeId)) return null;
    this.run.currentNodeId = nodeId;
    eventBus.emit('stateChanged', { scope: 'map' });
    return this.enterNode();
  }

  /** 进入当前节点 */
  enterNode(): NodeEnter | null {
    const node = this.currentNode;
    switch (node.type) {
      case 'battle':
      case 'elite':
      case 'boss': {
        const monsters = this.encounterMonsters(node);
        return { type: 'battle', monsters, node };
      }
      case 'station':
        return { type: 'station', node };
      case 'event':
        return { type: 'event', eventId: node.eventId ?? 'event_trackscrap', node };
      case 'fork':
        return { type: 'fork', node };
      case 'start':
        node.resolved = true;
        return null;
      default:
        return null;
    }
  }

  /** 节点遭遇的怪物列表 */
  encounterMonsters(node: MapNode): { defId: string; count: number }[] {
    const zone = registry.zones.get(node.zoneId)!;
    if (node.type === 'boss') {
      return [{ defId: node.encounterIds?.[0] ?? zone.bossId, count: 1 }];
    }
    const encounterId = node.encounterIds?.[0];
    const encounter = zone.encounters?.find((e) => e.id === encounterId);
    if (encounter) return encounter.monsters.map((m) => ({ ...m }));
    if (node.type === 'elite') {
      return (node.encounterIds ?? zone.elitePool).map((defId) => ({ defId, count: 1 }));
    }
    return [];
  }

  // ================= 岔道 =================
  chooseFork(rail: ForkRail): { logs: { text: string; kind: string }[]; chosenNodeId: string } {
    const node = this.currentNode;
    const zone = this.currentZoneDef;
    const result = settleFork(this.run, zone, node.id, rail, this.rng);
    node.resolved = true;
    eventBus.emit('stateChanged', { scope: 'map' });
    return result;
  }

  // ================= 战斗结算 =================
  onBattleVictory(node: MapNode): { advancedZone: boolean; rewards: string[] } {
    node.resolved = true;
    const isBoss = node.type === 'boss';
    const isElite = node.type === 'elite';
    const rewards: string[] = [];
    this.run.resources.obsession += isBoss ? 20 : isElite ? 10 : 5;
    this.run.resources.shards += isBoss ? 30 : isElite ? 15 : 8;
    rewards.push(`执念值+${isBoss ? 20 : isElite ? 10 : 5} · 残响碎片+${isBoss ? 30 : isElite ? 15 : 8}`);

    // 战后恢复：存活英雄恢复20%生命上限（可调设计默认值，防止无奶局不可通关）
    for (const h of Object.values(this.run.heroes)) {
      if (h.alive) {
        const heal = Math.ceil(h.maxHp * 0.2);
        h.hp = Math.min(h.maxHp, h.hp + heal);
      }
    }

    if (isBoss) {
      // Boss固定掉落：30蚀铁 + 15魂火 + 1张随机蓝色遗物牌
      this.run.resources.darkIron += 30;
      this.run.resources.soulfire += 15;
      rewards.push('蚀铁+30 · 魂火+15');
      const blueRelics = [...registry.cards.values()]
        .filter((c) => c.kind === 'relic' && c.rarity === 'blue' && !c.isFused);
      if (blueRelics.length > 0) {
        const reward = this.rng.pick(blueRelics);
        this.deck.addToDeck(reward.id);
        rewards.push(`获得蓝色遗物牌【${reward.name}】`);
      }
      // 科技树层解锁：区域1→1层，区域2→2层，区域3→3层
      const zoneIndex = [...registry.zones.values()].map((z) => z.id).indexOf(node.zoneId);
      const tier = Math.min(3, zoneIndex + 1);
      const prevTier = Number(this.run.flags['techTierUnlocked'] ?? 0);
      if (tier > prevTier) {
        this.run.flags['techTierUnlocked'] = tier;
        rewards.push(`列车科技树第${tier}层解锁`);
      }
      eventBus.emit('stateChanged', { scope: 'resources' });
      return { advancedZone: this.advanceZone(), rewards };
    }
    eventBus.emit('stateChanged', { scope: 'resources' });
    return { advancedZone: false, rewards };
  }

  /** 区域推进：进入下一区域起点 */
  advanceZone(): boolean {
    const zoneIds = [...registry.zones.values()].map((z) => z.id);
    const currentZoneId = this.currentNode.zoneId;
    const idx = zoneIds.indexOf(currentZoneId);
    if (idx < 0 || idx >= zoneIds.length - 1) {
      this.run.flags['runComplete'] = true;
      return false; // 全流程结束（胜利，步骤6做结算场景）
    }
    const nextZoneId = zoneIds[idx + 1];
    this.run.zoneIndex = idx + 1;
    const nextStart = this.run.map.find((n) => n.zoneId === nextZoneId && n.type === 'start')!;
    nextStart.resolved = true;
    this.run.currentNodeId = nextStart.id;
    eventBus.emit('stateChanged', { scope: 'map' });
    return true;
  }

  // ================= 调度站 =================
  canAfford(cost: number): boolean {
    return this.run.resources.soulfire >= cost;
  }

  stationCoal(): { text: string } {
    this.run.resources.soulfire -= 20;
    for (const h of Object.values(this.run.heroes)) {
      h.hp = h.maxHp;
      h.madness = 0;
      h.alive = true;
      this.deck.heroRevived(h.heroId);
    }
    eventBus.emit('stateChanged', { scope: 'resources' });
    return { text: '煤水加注完成——全队恢复满状态，狂气清空，残影英雄归队' };
  }

  stationMap(): { text: string } {
    this.run.resources.soulfire -= 10;
    this.run.flags[`mapped_${this.currentNode.zoneId}`] = true;
    return { text: '轨道测绘完成——本区域剩余节点的内容已被标绘' };
  }

  // ================= 事件 =================
  resolveEvent(eventId: string, choiceIndex: number): { logs: string[] } {
    const event = registry.events.get(eventId)!;
    const choice = event.choices[choiceIndex];
    const logs: string[] = [];
    for (const eff of choice.effects) {
      const log = resolveMapEffect(this.run, eff, this.rng);
      if (log) logs.push(log.text);
    }
    // 事件奖励结算（选项文本约定）
    if (choice.text.includes('执念值')) {
      const amount = choice.text.includes('+12') ? 12 : choice.text.includes('+8') ? 8 : 5;
      this.run.resources.obsession += amount;
      logs.push(`执念值 +${amount}`);
    }
    if (choice.text.includes('残响碎片')) {
      this.run.resources.shards += 10;
      logs.push('残响碎片 +10');
    }
    if (choice.text.includes('蚀刻剂')) {
      this.run.resources.etchant += 1;
      logs.push('蚀刻剂 +1');
    }
    eventBus.emit('stateChanged', { scope: 'resources' });
    return { logs };
  }

  /** 事件节点结算完成 */
  resolveCurrentNode(): void {
    this.currentNode.resolved = true;
    eventBus.emit('stateChanged', { scope: 'map' });
  }

  // ================= 元进度：卡牌品质升级 =================
  /** 残响碎片升级专属牌：白15 / 绿30 / 蓝50 */
  static UPGRADE_COST: Record<string, number> = { white: 15, green: 30, blue: 50 };

  upgradeCardQuality(cardId: string): { ok: boolean; text: string } {
    const card = registry.cards.get(cardId);
    if (!card || card.rarity === 'orange') return { ok: false, text: '该卡已达橙色品质' };
    const up = registry.nextRarity(card);
    if (!up) return { ok: false, text: '该卡无法继续升级' };
    const cost = RunController.UPGRADE_COST[card.rarity] ?? 50;
    if (this.run.resources.shards < cost) return { ok: false, text: `残响碎片不足（需要${cost}）` };
    // 在牌组中找到这张卡并替换
    for (const pile of [this.run.deck.drawPile, this.run.deck.hand, this.run.deck.discardPile]) {
      const i = pile.indexOf(cardId);
      if (i >= 0) {
        pile[i] = up.id;
        this.run.resources.shards -= cost;
        this.updateAvatarForm();
        eventBus.emit('stateChanged', { scope: 'deck' });
        return { ok: true, text: `【${card.name}】升级为【${up.name}】` };
      }
    }
    return { ok: false, text: '牌组中没有这张牌' };
  }

  // ================= 元进度：执念灌注 =================
  static INFUSE_COST = 10;

  infuseHero(heroId: string, optionId: string): { ok: boolean; text: string } {
    const hero = this.run.heroes[heroId as keyof typeof this.run.heroes];
    const def = registry.heroes.get(heroId as never);
    if (!hero || !def) return { ok: false, text: '英雄不存在' };
    const option = def.obsession.options.find((o) => o.id === optionId);
    if (!option) return { ok: false, text: '灌注选项不存在' };
    if (this.run.resources.obsession < RunController.INFUSE_COST) {
      return { ok: false, text: `执念值不足（需要${RunController.INFUSE_COST}）` };
    }
    this.run.resources.obsession -= RunController.INFUSE_COST;
    hero.obsessionCount += 1;
    hero.infused[option.stat] = (hero.infused[option.stat] ?? 0) + option.amount;
    if (option.stat === 'maxHp') hero.maxHp += option.amount;
    const unlock = def.obsession.thresholds.find((t) => t.at === hero.obsessionCount);
    eventBus.emit('stateChanged', { scope: 'resources' });
    return {
      ok: true,
      text: `${def.name} 灌注【${option.name}】${unlock ? `——执念阈值突破！解锁被动【${unlock.name}：${unlock.desc}】` : ''}`,
    };
  }

  // ================= 元进度：列车科技 =================
  buyTech(techId: string): { ok: boolean; text: string } {
    const tech = registry.techs.get(techId);
    if (!tech) return { ok: false, text: '科技不存在' };
    if (this.run.techUnlocked.includes(techId)) return { ok: false, text: '已解锁' };
    const tierUnlocked = Number(this.run.flags['techTierUnlocked'] ?? 0);
    if (tech.tier > tierUnlocked) return { ok: false, text: `需要先击败第${tech.tier}区域Boss解锁该层` };
    if (this.run.resources.darkIron < tech.cost) return { ok: false, text: `蚀铁不足（需要${tech.cost}）` };
    this.run.resources.darkIron -= tech.cost;
    this.run.techUnlocked.push(techId);
    this.updateAvatarForm();
    eventBus.emit('stateChanged', { scope: 'resources' });
    return { ok: true, text: `列车科技【${tech.name}】已解锁——${tech.desc}` };
  }

  // ================= 元进度：铭刻融合 =================
  fuseCards(cardA: string, cardB: string, via: 'etchant' | 'soulfire' = 'etchant'): { ok: boolean; text: string } {
    if (cardA === cardB) return { ok: false, text: '需要两张不同的遗物牌' };
    const a = registry.cards.get(cardA);
    const b = registry.cards.get(cardB);
    if (!a || !b || a.kind !== 'relic' || b.kind !== 'relic') return { ok: false, text: '只能融合遗物牌' };
    const costPaid = via === 'etchant' ? 1 : 30;
    if (via === 'etchant') {
      if (this.run.resources.etchant < 1) return { ok: false, text: '蚀刻剂不足（需要1）' };
    } else {
      if (this.run.resources.soulfire < 30) return { ok: false, text: '魂火不足（需要30）' };
    }
    // 特殊配方优先
    const recipe = [...registry.fusionRecipes.values()].find(
      (r) => (r.cardA === cardA && r.cardB === cardB) || (r.cardA === cardB && r.cardB === cardA),
    );
    let resultDef: CardDef | undefined;
    if (recipe) {
      resultDef = registry.cards.get(recipe.resultCardId);
    } else {
      // 通用融合：效果串联、费用A+B-1（上限4）、品质取高
      const rarities: Rarity[] = ['white', 'green', 'blue', 'orange'];
      const rar: Rarity = rarities[Math.max(rarities.indexOf(a.rarity), rarities.indexOf(b.rarity))];
      resultDef = {
        id: `fused_${cardA}_${cardB}_${Object.keys(this.run.customCards).length}`,
        lineageId: `fused_${cardA}_${cardB}`,
        name: `${a.name}·${b.name}`,
        kind: 'relic',
        rarity: rar,
        cost: Math.min(4, Math.max(1, a.cost + b.cost - 1)),
        tags: [...new Set([...a.tags, ...b.tags])],
        attackType: a.attackType ?? b.attackType,
        damageType: a.damageType ?? b.damageType,
        effects: [...a.effects, ...b.effects],
        isFused: true,
      };
    }
    if (!resultDef) return { ok: false, text: '配方产物缺失' };
    // 支付 + 移除素材 + 加入产物
    if (via === 'etchant') this.run.resources.etchant -= 1;
    else this.run.resources.soulfire -= costPaid;
    this.deck.removeCard(cardA);
    this.deck.removeCard(cardB);
    this.run.customCards[resultDef.id] = resultDef;
    registry.addCards([resultDef]);   // 动态注册，全局查询直接可用
    this.deck.addToDeck(resultDef.id);
    this.updateAvatarForm();
    eventBus.emit('stateChanged', { scope: 'deck' });
    return { ok: true, text: `铭刻融合成功——获得【${resultDef.name}】` };
  }

  // ================= 复活 =================
  reviveHero(heroId: HeroId, cost = 50): { ok: boolean; text: string } {
    const hero = this.run.heroes[heroId];
    if (!hero) return { ok: false, text: '英雄不存在' };
    if (hero.alive) return { ok: false, text: '该英雄未阵亡' };
    if (this.run.resources.soulfire < cost) return { ok: false, text: `魂火不足（需要${cost}）` };
    this.run.resources.soulfire -= cost;
    hero.alive = true;
    hero.hp = hero.maxHp;
    hero.madness = 0;
    // 灵柩共鸣科技：复活后下战复仇（×1.5）
    hero.hasRevenge = this.run.techUnlocked.includes('tech_coffin');
    this.deck.heroRevived(heroId);
    eventBus.emit('stateChanged', { scope: 'resources' });
    return { ok: true, text: `${registry.heroes.get(heroId)?.name} 从灵柩中苏醒` };
  }

  get deadHeroes(): string[] {
    return Object.keys(this.run.heroes).filter((id) => !this.run.heroes[id as keyof typeof this.run.heroes].alive);
  }

  // ================= 灾厄化身 =================
  /** 满足任意两项：专属牌全橙 / ≥3张融合遗物牌 / ≥3项列车科技 */
  isAvatarForm(): boolean {
    const deck = [...this.run.deck.drawPile, ...this.run.deck.hand, ...this.run.deck.discardPile];
    let conditions = 0;
    // 条件1：某英雄的5张专属牌全部为橙
    for (const heroId of ['warwick', 'morgan', 'serafina', 'auris'] as const) {
      const oranges = deck.filter((c) => {
        const def = registry.cards.get(c);
        return def?.heroId === heroId && def.rarity === 'orange';
      });
      if (new Set(oranges.map((c) => registry.cards.get(c)!.lineageId)).size >= 5) {
        conditions += 1;
        break;
      }
    }
    // 条件2：≥3张融合遗物牌
    const fused = deck.filter((c) => registry.cards.get(c)?.isFused).length;
    if (fused >= 3) conditions += 1;
    // 条件3：≥3项列车科技
    if (this.run.techUnlocked.length >= 3) conditions += 1;
    return conditions >= 2;
  }

  updateAvatarForm(): void {
    const was = this.run.avatarForm;
    this.run.avatarForm = this.isAvatarForm();
    if (this.run.avatarForm && !was) {
      eventBus.emit('stateChanged', { scope: 'resources' });
    }
  }

  // ================= 状态快照 =================
  get heroSummary(): string {
    return Object.values(this.run.heroes)
      .map((h) => `${registry.heroes.get(h.heroId)?.name} ${h.alive ? `${h.hp}/${h.maxHp}` : '残影'}`)
      .join(' · ');
  }
}
