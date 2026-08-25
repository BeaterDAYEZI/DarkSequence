// 战斗总引擎：回合编排、行动队列、意图揭示、胜负判定、Boss推进
import type { ZoneDef, RunState, BattleState, HeroId, HeroInstance, EnemyInstance, CardDef, MonsterDef } from '../../core/types';
import { Rng } from '../../core/rng';
import { registry } from '../../core/registry';
import { combatLog } from '../../core/log';
import { eventBus } from '../../core/eventBus';
import { DeckSystem } from '../run/DeckSystem';
import type { BattleCtx } from './context';
import { soulfireCap, soulfireRatio } from './context';
import { BuffSystem } from './BuffSystem';
import { MadnessSystem } from './MadnessSystem';
import { TrainSystem } from './TrainSystem';
import { TargetResolver } from './TargetResolver';
import { DamagePipeline } from './DamagePipeline';
import { CardResolver } from './CardResolver';
import { EnemyAI } from './EnemyAI';

export interface BattleOutcome {
  result: 'victory' | 'defeat' | 'ongoing';
  reason?: string;
  turns: number;
}

export class BattleEngine {
  readonly registry = registry;
  readonly deck: DeckSystem;
  readonly buffs: BuffSystem;
  readonly madness: MadnessSystem;
  readonly train: TrainSystem;
  readonly targets: TargetResolver;
  readonly pipeline: DamagePipeline;
  readonly resolver: CardResolver;
  readonly ai: EnemyAI;
  readonly ctx: BattleCtx;

  battle!: BattleState;
  stats: { kills: number; damage: number } = { kills: 0, damage: 0 };
  private uidCounter = 0;
  private battleEnded = false;

  constructor(
    public run: RunState,
    public zone: ZoneDef,
    public rng: Rng,
    techEffects: Set<string>,
    avatarForm = false,
  ) {
    this.deck = new DeckSystem(run, rng);
    this.ctx = { run, battle: null as unknown as BattleState, rng, zone, techs: techEffects, avatar: avatarForm };
    this.buffs = new BuffSystem(this);
    this.madness = new MadnessSystem(this);
    this.train = new TrainSystem(this);
    this.targets = new TargetResolver(this);
    this.pipeline = new DamagePipeline(this);
    this.resolver = new CardResolver(this);
    this.ai = new EnemyAI(this);
    this.battle = this.newBattle();
    this.ctx.battle = this.battle;
  }

  // ================= 战斗初始化 =================
  private newBattle(): BattleState {
    return {
      turn: 0,
      playerFirst: true,
      trainSpeed: 0,
      energy: this.run.energyMax,
      energyMax: this.run.energyMax,
      soulfire: this.run.resources.soulfire,
      darkEnergy: 0,
      heroes: this.run.heroes,
      enemies: [],
      queue: [],
      phase: 'start',
      playedThisTurn: [],
      resonanceCount: {},
      speedPlayedThisTurn: 0,
      furnaceStacks: 0,
      zoneId: this.zone.id,
      blockNerf: 0,
      awakenedThisBattle: [],
      damageMult: 1,
      ignorePosTurn: false,
      nextAttackDouble: false,
      exhaustHeroes: [],
    };
  }

  /** 开战：重置英雄战斗态、应用环境规则、生成敌人 */
  startEncounter(monsters: { defId: string; count: number }[]): void {
    this.battleEnded = false;
    combatLog.clear();
    const battle = this.battle;
    battle.awakenedThisBattle = [];
    battle.soulfire = this.run.resources.soulfire;

    // 英雄战斗态重置
    for (const hero of Object.values(battle.heroes)) {
      const def = registry.heroes.get(hero.heroId)!;
      hero.block = 0;
      hero.statuses = [];
      hero.awakeningTurns = 0;
      hero.runaway = false;
      hero.pos = def.defaultCarriage;
      hero.critChance = 0.05;
      // 复仇：复活英雄下场战斗获得（灵柩共鸣×1.5）
      if (hero.hasRevenge) {
        const mult = this.ctx.techs.has('coffinResonance') ? 1.5 : 1;
        this.buffs.apply(hero, 'revenge', 1, -1, 0.5 * mult);
        hero.hasRevenge = false;
        this.log(`${this.heroName(hero.heroId)} 怀着复仇归来（伤害+${Math.round(0.5 * mult * 100)}%）`, 'system');
      }
    }

    // 初始速度：锅炉增压科技+1，锈蚀齿轮遗物+1，环境规则修正，本局永久修正
    let speed = 0;
    if (this.ctx.techs.has('initialSpeed')) speed += 1;
    if (this.run.relics.includes('relic_gear')) speed += 1;
    if (this.zone.environmentRule.id === 'speedStartDelta') speed += this.zone.environmentRule.amount ?? 0;
    speed += this.run.permSpeedMod ?? 0;
    battle.trainSpeed = Math.max(0, Math.min(5, speed));

    // 血祭献祭遗物：战斗开始+20魂火，第一名英雄-10生命
    if (this.run.relics.includes('relic_bloodsac')) {
      this.gainSoulfire(20);
      const firstHero = Object.values(battle.heroes).find((h) => h.alive);
      if (firstHero) {
        firstHero.hp = Math.max(1, firstHero.hp - 10);
        this.log(`${this.heroName(firstHero.heroId)} 因血祭献祭失去10点生命`, 'soulfire');
      }
    }

    // 岔道区域效果：左轨（记忆）全队力量+3 / 右轨（遗忘）格挡获取-2
    const fork = this.run.forkMemory[this.zone.id];
    if (fork === 'memory') {
      for (const hero of Object.values(battle.heroes)) {
        if (hero.alive) this.buffs.apply(hero, 'strength', 3, -1);
      }
      this.log('记忆之轨回响：全队力量+3', 'narration');
    } else if (fork === 'oblivion') {
      battle.blockNerf = 2;
      this.log('遗忘之轨侵蚀：全队格挡获取-2', 'narration');
    }

    // 生成敌人
    for (const m of monsters) {
      for (let i = 0; i < m.count; i++) {
        this.spawnEnemy(m.defId);
      }
    }
    // 蚀雾破片科技：所有敌人后退1格
    if (this.ctx.techs.has('fragmentPush')) {
      for (const e of battle.enemies) {
        if (e.hp > 0 && !registry.monsters.get(e.defId)?.bossAdvance) {
          e.pos = Math.min(4, e.pos + 1);
        }
      }
      this.log('蚀雾破片：敌人被逼退1格', 'system');
    }
    this.log(`—— 遭遇战开始 · ${this.zone.name} ——`, 'narration');
    if (battle.trainSpeed > 0) this.log(`列车以速度 ${battle.trainSpeed} 驶入战场`, 'info');
  }

  /** 生成单个敌人（自动分配允许站位） */
  spawnEnemy(defId: string, forcedPos?: number): EnemyInstance {
    const def = registry.monsters.get(defId);
    if (!def) throw new Error(`怪物定义不存在: ${defId}`);
    const battle = this.battle;
    const allowed = def.pos;
    // 分配站位：优先填满允许站位
    let pos = forcedPos ?? allowed[0];
    if (!forcedPos) {
      const occupied = new Set(battle.enemies.filter((e) => e.hp > 0).map((e) => e.pos));
      const free = allowed.find((p) => !occupied.has(p));
      if (free) pos = free;
    }
    const hp = Math.round(def.hp * this.zone.hpScale);
    const enemy: EnemyInstance = {
      uid: `e${++this.uidCounter}_${defId}`,
      defId,
      name: def.name,
      hp,
      maxHp: hp,
      pos,
      speed: def.speed,
      block: 0,
      statuses: [],
      phaseIndex: 0,
      cooldowns: {},
      nextActionAt: 1,
      stunTurns: 0,
      stealthArmed: (def.traits ?? []).some((t) => t.id === 'stealth'),
      lastHp: hp,
      aiIndex: 0,
      summoned: forcedPos !== undefined,
    };
    battle.enemies.push(enemy);
    this.log(`${enemy.name} 出现于 ${pos} 号位`, 'info');
    return enemy;
  }

  // ================= 回合流程 =================
  beginTurn(): void {
    const battle = this.battle;
    battle.turn += 1;
    battle.phase = 'start';
    battle.energy = battle.energyMax;
    battle.playedThisTurn = [];
    battle.resonanceCount = {};
    battle.speedPlayedThisTurn = 0;
    combatLog.beginTurn(battle.turn);
    this.log(`———— 第 ${battle.turn} 回合 ————`, 'system');

    // 眩晕tick（怪物）
    for (const e of battle.enemies.filter((x) => x.hp > 0)) {
      if (this.buffs.has(e, 'stun')) this.log(`${e.name} 被眩晕，无法行动`, 'info');
    }
    // 蚀铁护甲片遗物：全队每回合3格挡
    if (this.run.relics.includes('relic_armor')) {
      for (const h of Object.values(battle.heroes)) {
        if (h.alive) h.block += 3;
      }
      this.log('蚀铁护甲片：全队获得3点格挡', 'info');
    }
    // 装甲车厢科技：全队每回合3格挡
    if (this.ctx.techs.has('armorPlating')) {
      for (const h of Object.values(battle.heroes)) {
        if (h.alive) {
          h.block += 3;
          this.log(`${this.heroName(h.heroId)} 获得装甲车厢防护（+3格挡）`, 'info');
        }
      }
    }
    // 环境规则：敌方每回合格挡
    if (this.zone.environmentRule.id === 'enemyBlockPerTurn') {
      const n = this.zone.environmentRule.amount ?? 2;
      for (const e of battle.enemies.filter((x) => x.hp > 0)) e.block += n;
    }
    // 环境规则：Boss战敌方速度成长
    if (this.zone.environmentRule.id === 'bossSpeedGrow' && battle.enemies.some((e) => registry.monsters.get(e.defId)?.bossAdvance)) {
      for (const e of battle.enemies.filter((x) => x.hp > 0)) e.speed += this.zone.environmentRule.amount ?? 1;
    }
    // 沃里克阈值"铁壁"：回合开始+2格挡；塞拉芬娜"圣歌"：全队+2格挡
    for (const h of Object.values(battle.heroes)) {
      if (!h.alive) continue;
      if (this.hasThreshold(h.heroId, 'ironWall')) {
        h.block += 2;
        this.log(`铁壁：${this.heroName(h.heroId)} 获得2点格挡`, 'info');
      }
      if (this.hasThreshold(h.heroId, 'hymn')) {
        for (const x of Object.values(battle.heroes)) if (x.alive) x.block += 2;
        this.log('圣歌：全队获得2点格挡', 'info');
      }
      // 奥瑞斯阈值"星轨"：每回合暴击率+3%
      if (this.hasThreshold(h.heroId, 'starTrail')) {
        this.buffs.apply(h, 'critUp', 1, -1, 0.03);
      }
      // 每回合格挡（执念灌注）
      const perTurn = h.infused['blockPerTurn'] ?? 0;
      if (perTurn > 0) h.block += perTurn;
    }

    // 先手判定：列车速度 vs 敌方速度总和
    const enemySpeedSum = battle.enemies.filter((e) => e.hp > 0).reduce((s, e) => s + e.speed, 0);
    battle.playerFirst = battle.trainSpeed >= enemySpeedSum;
    this.log(battle.playerFirst
      ? `先手判定：列车速度 ${battle.trainSpeed} ≥ 敌方速度总和 ${enemySpeedSum}——我方先手`
      : `先手判定：列车速度 ${battle.trainSpeed} < 敌方速度总和 ${enemySpeedSum}——敌方先手`, 'info');

    battle.phase = 'reveal';
    this.revealIntentions();
    battle.phase = 'draw';
    this.drawPhase();
    battle.phase = 'planning';
  }

  revealIntentions(): void {
    for (const enemy of this.battle.enemies.filter((e) => e.hp > 0)) {
      const action = this.ai.pickIntent(enemy);
      if (action) {
        this.log(`${enemy.name} 的意图：${action.icon} ${action.name}`, 'info');
      } else {
        enemy.intent = undefined;
      }
    }
  }

  /** 每回合抽牌数（基础4 + 锈蚀齿轮遗物+1） */
  drawPerTurn(): number {
    return 4 + (this.run.relics.includes('relic_gear') ? 1 : 0);
  }

  drawPhase(): void {
    const per = this.drawPerTurn();
    for (const hero of Object.values(this.battle.heroes)) {
      if (hero.alive && !this.buffs.has(hero, 'swallowed')) {
        this.deck.draw(per);
      }
    }
    this.log(`抽牌阶段：每英雄抽 ${per} 张（手牌上限10）`, 'info');
    // 灾厄化身：每回合抽牌+2
    if (this.ctx.avatar) {
      const drawn = this.deck.draw(2);
      if (drawn.length > 0) this.log(`灾厄化身：额外抽取 ${drawn.length} 张牌`, 'system');
    }
  }

  // ================= 规划与执行 =================
  /** 规划校验：卡牌是否可由该英雄打出 */
  canPlay(heroId: HeroId, cardId: string): string | null {
    const battle = this.battle;
    const hero = battle.heroes[heroId];
    const card = registry.cards.get(cardId);
    if (!card) return '卡牌不存在';
    if (!hero.alive) return '英雄已残影化';
    if (hero.runaway) return '暴走中无法行动';
    if (this.buffs.has(hero, 'swallowed')) return '被吞噬中';
    if (!this.deck.deck.hand.includes(cardId)) return '不在手牌中';
    if (card.heroId && card.heroId !== heroId) return '不是该英雄的牌';
    // 状态封锁
    if (this.buffs.has(hero, 'imprison') && (card.tags.includes('speed') || card.tags.includes('displace'))) {
      return '禁锢中无法使用位移牌';
    }
    if (this.buffs.has(hero, 'silenceHeal') && card.tags.includes('heal')) {
      return '低语萦绕，无法使用治疗牌';
    }
    // 虚脱：本回合只能打1张（恶魔契约负面）
    if (this.buffs.has(hero, 'exhaust') && battle.playedThisTurn.filter((p) => p.heroId === heroId).length >= 1) {
      return '虚脱中，本回合只能打出1张牌';
    }
    // 车厢与速度条件（废弃车厢：本回合无视站位）
    if (card.carriageReq && !battle.ignorePosTurn) {
      const { mode, pos } = card.carriageReq;
      if (mode === 'exact' && !pos.includes(hero.pos)) return `需要在${pos.join('/')}号车厢`;
      if (mode === 'not' && pos.includes(hero.pos)) return `不能在${pos.join('/')}号车厢`;
      if (mode === 'range' && (hero.pos < pos[0] || hero.pos > pos[pos.length - 1])) return '车厢不符';
    }
    if (card.speedReq) {
      if (card.speedReq.min !== undefined && battle.trainSpeed < card.speedReq.min) return `需要列车速度≥${card.speedReq.min}`;
      if (card.speedReq.max !== undefined && battle.trainSpeed > card.speedReq.max) return `需要列车速度≤${card.speedReq.max}`;
    }
    // 费用（觉醒折扣）
    if (this.cardCost(heroId, card) > battle.energy) return '能量不足';
    return null;
  }

  cardCost(heroId: HeroId, card: CardDef): number {
    const hero = this.battle.heroes[heroId];
    let cost = card.cost;
    if (this.ctx.avatar) cost -= 1;                     // 灾厄化身：所有牌费-1
    if (this.buffs.has(hero, 'awakened')) cost -= 1;    // 觉醒：专属牌费-1
    return Math.max(1, cost);
  }

  /** 提交规划（≤4张，有序） */
  executePlan(plan: { heroId: HeroId; cardId: string }[]): void {
    const battle = this.battle;
    if (plan.length > 4) throw new Error('每回合最多规划4张牌');
    const queue = [];
    for (const p of plan) {
      if (this.canPlay(p.heroId, p.cardId) !== null) continue; // 非法规划静默跳过（UI已校验）
      queue.push({ kind: 'playCard' as const, cardId: p.cardId, heroId: p.heroId });
    }
    // 敌方行动（按速度降序）
    const enemyActs = battle.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => this.ai.effectiveSpeed(b) - this.ai.effectiveSpeed(a))
      .map((e) => ({ kind: 'enemyAct' as const, enemyUid: e.uid }));
    battle.queue = battle.playerFirst ? [...queue, ...enemyActs] : [...enemyActs, ...queue];
    battle.phase = 'execution';
    this.processQueue();
  }

  /** 执行行动队列（FIFO，可插入） */
  processQueue(): void {
    let guard = 0;
    while (this.battle.queue.length > 0 && guard++ < 500) {
      const action = this.battle.queue.shift()!;
      switch (action.kind) {
        case 'playCard':
          this.playCard(action.heroId!, action.cardId!, action.free, action.halve);
          break;
        case 'extraPlay':
          this.processExtraPlay(action.heroId!);
          break;
        case 'enemyAct': {
          const enemy = this.battle.enemies.find((e) => e.uid === action.enemyUid);
          if (enemy && enemy.hp > 0) {
            const stunned = this.buffs.has(enemy, 'stun');
            if (stunned) {
              this.log(`${enemy.name} 被眩晕，跳过行动`, 'info');
            } else {
              this.ai.executeIntent(enemy);
            }
          }
          break;
        }
        case 'endTurn':
          break;
        case 'bossAdvance':
          break;
        case 'derailCheck':
          break;
      }
      if (this.checkEnd()) break;
    }
    if (guard >= 500) this.log('⚠ 行动队列超出安全上限，强制中断', 'system');
    if (!this.battleEnded) this.endPhase();
  }

  /** 打出一张卡 */
  playCard(heroId: HeroId, cardId: string, free = false, actionHalve = false): void {
    const battle = this.battle;
    const hero = battle.heroes[heroId];
    const card = registry.cards.get(cardId)!;
    if (this.canPlay(heroId, cardId) !== null) return;

    const cost = free ? 0 : this.cardCost(heroId, card);
    battle.energy -= cost;
    this.deck.removeFromHand(cardId);
    this.deck.deck.discardPile.push(cardId);
    battle.playedThisTurn.push({ heroId, cardId });
    if (battle.playedThisTurn.length === 1) combatLog.setFirstCard(battle.turn, heroId, cardId);
    combatLog.setLastCard(battle.turn, heroId, cardId);  // 时空错位用
    // 共鸣计数（打出前检查 → 倍率）
    let mult = 1;
    if (card.resonance) {
      const played = battle.resonanceCount[card.resonance.tag] ?? 0;
      if (played >= card.resonance.countReq) {
        mult = card.resonance.bonus;
        this.log(`🔗 牌组共鸣【${card.resonance.tag}】触发：${card.name} 效果×${mult}`, 'system');
      }
    }
    for (const tag of card.tags) battle.resonanceCount[tag] = (battle.resonanceCount[tag] ?? 0) + 1;

    this.log(`▶ ${this.heroName(heroId)} 打出【${card.name}】（${cost === 0 ? '免费' : `-${cost}能量`}）`, 'system');
    this.resolver.resolve(card.effects, {
      source: { side: 'hero', heroId }, card, mult, paidCost: cost,
      halve: actionHalve,
    });
    // 双连发装置：下一张攻击牌打出两次（第二次伤害减半）
    if (battle.nextAttackDouble && card.effects.some((e) => e.kind === 'damage')) {
      battle.nextAttackDouble = false;
      this.log(`🔁 双连发装置触发：${card.name} 再次打出（伤害减半）`, 'system');
      this.battle.queue.unshift({ kind: 'playCard', heroId, cardId, free: true, halve: true });
    }
    this.run.stats.turns += 0;
    this.run.stats.damage += 0;
    eventBus.emit('stateChanged', { scope: 'battle' });
  }

  /** 连斩/额外行动：免费打出该英雄一张手牌（headless自动选择第一张） */
  queueExtraPlay(heroId: HeroId): void {
    this.log(`⚡ ${this.heroName(heroId)} 获得一次额外行动！`, 'system');
    this.battle.queue.unshift({ kind: 'extraPlay', heroId, free: true });
  }

  queueReplayCard(heroId: HeroId, cardId: string): void {
    this.log(`🔁 ${this.heroName(heroId)} 的卡牌再度轰鸣！`, 'system');
    this.battle.queue.unshift({ kind: 'playCard', heroId, cardId, free: true });
  }

  processExtraPlay(heroId: HeroId): void {
    const hero = this.battle.heroes[heroId];
    if (!hero.alive || hero.runaway) return;
    // headless自动策略：选该英雄第一张可打的手牌，其次任意可打手牌
    const hand = this.deck.deck.hand;
    const candidates = hand.filter((c) => registry.cards.get(c)!.heroId === heroId);
    const pick = [...candidates, ...hand].find((c) => this.canPlay(heroId, c) === null);
    if (pick) {
      this.playCard(heroId, pick, true);
    } else {
      this.log(`${this.heroName(heroId)} 没有可打出的牌`, 'info');
    }
  }

  // ================= 回合结束 =================
  endPhase(): void {
    if (this.battleEnded) return;
    const battle = this.battle;
    battle.phase = 'end';

    // 状态tick（流血/持续衰减）
    this.buffs.tickEnd();

    // 自爆检查（被诅咒的枕木）——先于共振治疗，防止自愈逃过自爆阈值
    for (const enemy of battle.enemies.filter((e) => e.hp > 0)) {
      const def = registry.monsters.get(enemy.defId)!;
      if (def.selfDestruct && enemy.hp <= enemy.maxHp * def.selfDestruct.hpPct) {
        this.log(`💥 ${enemy.name} 崩裂自爆！`, 'system');
        this.resolver.resolve(def.selfDestruct.effects, { source: { side: 'enemy', enemyUid: enemy.uid } });
        this.onEnemyKilled(enemy);
      }
    }

    // 枕木共振等回合结束效果
    for (const enemy of battle.enemies.filter((e) => e.hp > 0)) {
      const def = registry.monsters.get(enemy.defId)!;
      if (def.endTurnEffects) {
        this.log(`${enemy.name} 共振：${def.endTurnEffects.map((e) => e.kind).join('、')}`, 'info');
        this.resolver.resolve(def.endTurnEffects, { source: { side: 'enemy', enemyUid: enemy.uid } });
      }
    }

    // 冷却递减
    this.ai.tickCooldowns();
    // 手牌弃入蚀渊
    this.deck.discardHand();
    // 觉醒/暴走tick
    this.madness.tickEnd();
    // 回合性效果重置（恶魔契约/废弃车厢/双连发/虚脱）
    battle.damageMult = 1;
    battle.ignorePosTurn = false;
    battle.nextAttackDouble = false;
    battle.exhaustHeroes = [];
    // Boss推进（脱轨判定）
    if (battle.enemies.some((e) => e.hp > 0 && registry.monsters.get(e.defId)?.bossAdvance)) {
      if (this.train.bossAdvance()) {
        this.finishBattle('defeat', '列车脱轨——Boss抵达了车头');
        return;
      }
    }
    this.checkEnd();
  }

  /** 胜负检查 */
  checkEnd(): boolean {
    const battle = this.battle;
    if (battle.enemies.every((e) => e.hp <= 0)) {
      this.finishBattle('victory');
      return true;
    }
    if (Object.values(battle.heroes).every((h) => !h.alive)) {
      this.finishBattle('defeat', '全员残影化——列车停在了蚀雾里');
      return true;
    }
    return false;
  }

  finishBattle(result: 'victory' | 'defeat', reason?: string): void {
    if (this.battleEnded) return;
    this.battleEnded = true;
    this.battle.phase = result;
    this.log(result === 'victory' ? '🏆 遭遇战胜利！' : `💀 败北${reason ? `——${reason}` : ''}`, 'system');
  }

  get outcome(): BattleOutcome {
    if (!this.battleEnded) return { result: 'ongoing', turns: this.battle.turn };
    return {
      result: this.battle.phase === 'victory' ? 'victory' : 'defeat',
      reason: this.battle.phase === 'defeat' ? '败北' : undefined,
      turns: this.battle.turn,
    };
  }

  // ================= 死亡结算 =================
  onEnemyKilled(enemy: EnemyInstance, killerHeroId?: HeroId): void {
    if (enemy.hp > 0) enemy.hp = 0;
    this.log(`☠ ${enemy.name} 被击溃！`, 'damage');
    this.stats.kills += 1;
    this.run.stats.kills += 1;
    this.buffs.markDeathTriggers(enemy);
    if (killerHeroId && this.hasThreshold(killerHeroId, 'thirst')) {
      this.healHero(killerHeroId, 3);
      this.log(`渴血：${this.heroName(killerHeroId)} 恢复3点生命`, 'heal');
    }
    // 铁链羁绊：一方死亡，另一方暴走+额外行动
    const def = registry.monsters.get(enemy.defId)!;
    const chain = (def.traits ?? []).find((t) => t.id === 'chainBound');
    if (chain) {
      const partner = this.battle.enemies.find((e) => e.hp > 0 && e.uid !== enemy.uid
        && (registry.monsters.get(e.defId)!.traits ?? []).some((t) => t.id === 'chainBound' && t.params?.chain === chain.params?.chain));
      if (partner) {
        this.buffs.apply(partner, 'enraged', 1, -1, 0.5);
        this.log(`⛓️ 铁链崩断：${partner.name} 暴走！（伤害+50%）`, 'system');
        this.battle.queue.unshift({ kind: 'enemyAct', enemyUid: partner.uid });
      }
    }
    eventBus.emit('stateChanged', { scope: 'battle' });
  }

  onHeroFell(heroId: HeroId): void {
    const hero = this.battle.heroes[heroId];
    if (!hero.alive) return;
    hero.alive = false;
    hero.hp = 0;
    hero.block = 0;
    hero.statuses = [];
    hero.awakeningTurns = 0;
    this.deck.heroFell(heroId);
    this.log(`💀 ${this.heroName(heroId)} 残影化了……`, 'system');
    // 复仇标记：可在下一场战斗复活（灵柩复生/调度站）
    eventBus.emit('stateChanged', { scope: 'battle' });
  }

  // ================= 引擎公共接口 =================
  log(text: string, kind: 'info' | 'damage' | 'heal' | 'madness' | 'soulfire' | 'narration' | 'system' = 'info'): void {
    combatLog.add(text, kind, this.battle.turn);
    eventBus.emit('battleEvent', { text, kind });
  }

  heroName(heroId: HeroId): string {
    return registry.heroes.get(heroId)?.name ?? heroId;
  }

  heroAttackType(heroId?: HeroId): 'melee' | 'ranged' {
    return heroId ? registry.heroes.get(heroId)!.attackType : 'melee';
  }

  heroDamageType(heroId?: HeroId): 'physical' | 'arcane' {
    return heroId ? registry.heroes.get(heroId)!.damageType : 'physical';
  }

  healHero(heroId: HeroId, amount: number): void {
    const hero = this.battle.heroes[heroId];
    if (!hero || !hero.alive) return;
    let ratio = 1 - (this.buffs.has(hero, 'healReduction')?.value ?? 0);
    if (this.zone.environmentRule.id === 'healNerf') ratio *= 1 - (this.zone.environmentRule.amount ?? 0.2);
    ratio *= 1 + (hero.infused['healPower'] ?? 0) * 0.15;
    const heal = Math.max(0, Math.round(amount * ratio));
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    this.log(`${this.heroName(heroId)} 恢复 ${heal} 点生命`, 'heal');
    // 塞拉芬娜阈值"安魂"：治疗时清除2点狂气
    if (this.hasThreshold('serafina', 'requiemT') && heroId !== 'serafina') {
      this.madness.reduce(heroId, 2);
    }
  }

  /** 无管线直伤（流血/暴走等） */
  rawDamage(target: HeroInstance | EnemyInstance, amount: number, opts: { source: string; bypassBlock?: boolean }): void {
    if (!opts.bypassBlock && target.block > 0) {
      const absorbed = Math.min(target.block, amount);
      target.block -= absorbed;
      amount -= absorbed;
      if (amount <= 0) return;
    }
    target.hp -= amount;
    // 直伤致死结算
    if (target.hp <= 0) {
      if ('heroId' in target) {
        if (target.alive) this.onHeroFell(target.heroId);
      } else {
        this.onEnemyKilled(target);
      }
    }
  }

  gainSoulfire(amount: number): void {
    const battle = this.battle;
    const before = battle.soulfire;
    battle.soulfire = Math.min(soulfireCap(this.ctx), battle.soulfire + amount);
    if (battle.soulfire !== before) this.log(`🔥 魂火 +${battle.soulfire - before}（共 ${battle.soulfire}）`, 'soulfire');
  }

  soulfireRatio(): number {
    return soulfireRatio(this.ctx);
  }

  gainDarkEnergy(amount: number): void {
    if (amount <= 0) return;
    this.battle.darkEnergy += amount;
    this.log(`🌑 暗蚀能量 +${Math.round(amount * 10) / 10}（共 ${Math.round(this.battle.darkEnergy * 10) / 10}）`, 'info');
  }

  checkCondition(cond: string, heroId?: HeroId): boolean {
    const battle = this.battle;
    switch (cond) {
      case 'speedGE2': return battle.trainSpeed >= 2;
      case 'speedGE3': return battle.trainSpeed >= 3;
      case 'madnessAbove50': return heroId ? battle.heroes[heroId].madness > 50 : false;
      default: return false;
    }
  }

  checkEnemyCondition(enemy: EnemyInstance, cond: string): boolean {
    switch (cond) {
      case 'atPos2': {
        if (enemy.pos !== 2) return false;
        const frontHero = Object.values(this.battle.heroes).find((h) => h.alive && h.pos === 1 && !this.buffs.has(h, 'swallowed'));
        return !!frontHero;
      }
      default: return true;
    }
  }

  /** 蠕虫吞噬：吞噬1号位英雄 */
  swallowFrontHero(): void {
    const battle = this.battle;
    const frontHero = Object.values(battle.heroes).find((h) => h.alive && h.pos === 1 && !this.buffs.has(h, 'swallowed'));
    if (!frontHero) {
      this.log('吞噬落空：1号位没有可吞噬的英雄', 'info');
      return;
    }
    battle.swallow = { heroId: frontHero.heroId, need: 15, dealt: 0 };
    this.buffs.apply(frontHero, 'swallowed', 1, -1);
    this.log(`🪱 ${this.heroName(frontHero.heroId)} 被蠕虫吞噬！对Boss累计造成15点伤害可救回`, 'system');
  }

  /** 记忆铁轨：复制上一回合第一张牌攻击玩家 */
  executeMemoryRail(enemy: EnemyInstance): void {
    const prev = combatLog.getFirstCard(this.battle.turn - 1);
    if (!prev) {
      this.log('记忆铁轨空空如也——上一回合没有打出任何牌', 'info');
      return;
    }
    const card = registry.cards.get(prev.cardId);
    if (!card) return;
    this.log(`🎞️ ${enemy.name} 复刻了你的【${card.name}】！`, 'system');
    this.resolver.resolve(card.effects, { source: { side: 'enemy', enemyUid: enemy.uid }, card, flipSides: true });
  }

  // ================= 元数据/科技接口 =================
  markAwakened(heroId: HeroId): void {
    if (!this.battle.awakenedThisBattle.includes(heroId)) {
      this.battle.awakenedThisBattle.push(heroId);
    }
  }

  battleAwakenedThisBattle(heroId: HeroId): boolean {
    return this.battle.awakenedThisBattle.includes(heroId);
  }

  // ================= 存档恢复 =================
  /** 从快照恢复战斗（战斗中刷新回到回合开始） */
  static restore(
    run: RunState,
    zone: ZoneDef,
    rng: Rng,
    techEffects: Set<string>,
    avatarForm: boolean,
    battle: BattleState,
  ): BattleEngine {
    const engine = new BattleEngine(run, zone, rng, techEffects, avatarForm);
    engine.battle = battle;
    engine.ctx.battle = battle;
    // 恢复uid计数器（取最大值+1）
    let maxUid = 0;
    for (const e of battle.enemies) {
      const m = e.uid.match(/^e(\d+)_/);
      if (m) maxUid = Math.max(maxUid, Number(m[1]));
    }
    engine['uidCounter'] = maxUid;
    engine.battleEnded = battle.phase === 'victory' || battle.phase === 'defeat';
    return engine;
  }

  /** 执念阈值是否已解锁（obsessionCount累计） */
  hasThreshold(heroId: HeroId, thresholdId: string): boolean {
    const def = registry.heroes.get(heroId)!;
    const hero = this.battle.heroes[heroId];
    const threshold = def.obsession.thresholds.find((t) => t.id === thresholdId);
    if (!threshold) return false;
    return hero.obsessionCount >= threshold.at;
  }

  monsterDef(defId: string): MonsterDef | undefined {
    return registry.monsters.get(defId);
  }

  // ================= 魂火战斗服务 =================
  /** 炉火升温：10魂火，本回合起全队攻击+20%（可叠加，持续至战斗结束） */
  useFurnace(): boolean {
    if (this.battle.soulfire < 10) return false;
    this.battle.soulfire -= 10;
    this.battle.furnaceStacks += 1;
    this.log(`🔥 炉火升温！全队攻击力+20%（共${this.battle.furnaceStacks}层，当前+${this.battle.furnaceStacks * 20}%）`, 'soulfire');
    eventBus.emit('stateChanged', { scope: 'battle' });
    return true;
  }

  /** 鸣笛威慑：30魂火，强制所有敌人后退1格 */
  useHorn(): boolean {
    if (this.battle.soulfire < 30) return false;
    this.battle.soulfire -= 30;
    this.train.pushAllEnemies();
    this.log('📯 汽笛长鸣！所有敌人被逼退1格', 'soulfire');
    eventBus.emit('stateChanged', { scope: 'battle' });
    return true;
  }

  canUseFurnace(): boolean { return this.battle.soulfire >= 10 && this.battle.phase === 'planning'; }
  canUseHorn(): boolean { return this.battle.soulfire >= 30 && this.battle.phase === 'planning'; }
}
