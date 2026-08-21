// 整局流程控制器：跑局状态机（旅行、节点进入、岔道、战斗结算、区域推进）
import type { RunState, MapNode, ZoneDef } from '../core/types';
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

  // ================= 状态快照 =================
  get heroSummary(): string {
    return Object.values(this.run.heroes)
      .map((h) => `${registry.heroes.get(h.heroId)?.name} ${h.alive ? `${h.hp}/${h.maxHp}` : '残影'}`)
      .join(' · ');
  }
}
