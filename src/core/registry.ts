// 数据注册表：id→Def 的 Map，加载+启动校验（缺失字段/悬空引用报错）
import type {
  CardDef, HeroDef, MonsterDef, ZoneDef, TechDef, StationServiceDef,
  EventDef, FusionRecipeDef, HeroId, Rarity, CarriagePos,
} from './types';
import { RARITY_ORDER } from './types';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const KNOWN_TAGS = new Set(['speed', 'displace', 'heal', 'madness', 'frenzy', 'aoe', 'arcane', 'melee', 'ranged', 'physical', 'draw', 'resonance', 'defense', 'attack', 'soulfire', 'mark', 'debuff', 'buff', 'dot', 'finisher', 'selfloss', 'purify', 'counter', 'taunt', 'overkill', 'relic', 'risky', 'crit', 'risk', 'resonance', 'defense']);
const KNOWN_STATUS = new Set(['bleed', 'vulnerable', 'fear', 'tenacity', 'imprison', 'healReduction', 'dodge', 'stun', 'mark', 'taunt', 'strength', 'revenge', 'guard', 'silenceHeal', 'awakened', 'critUp', 'enraged', 'swallowed', 'corrosion', 'exhaust', 'undying', 'madnessImmune', 'slow']);
const KNOWN_TRAITS = new Set(['thorns', 'spiritBody', 'packInstinct', 'stealth', 'rooted', 'chainBound']);
const KNOWN_CONDITIONS = new Set(['targetHpBelow50', 'speedGE2', 'speedGE3', 'madnessAbove50', 'killedThisHit']);
const VALID_POS = new Set([1, 2, 3, 4]);

export class Registry {
  cards = new Map<string, CardDef>();
  heroes = new Map<HeroId, HeroDef>();
  monsters = new Map<string, MonsterDef>();
  zones = new Map<string, ZoneDef>();
  techs = new Map<string, TechDef>();
  stations = new Map<string, StationServiceDef>();
  events = new Map<string, EventDef>();
  fusionRecipes = new Map<string, FusionRecipeDef>();

  // ---------- 注册 API ----------
  addCards(defs: CardDef[]): void { defs.forEach((d) => this.cards.set(d.id, d)); }
  addHeroes(defs: HeroDef[]): void { defs.forEach((d) => this.heroes.set(d.id, d)); }
  addMonsters(defs: MonsterDef[]): void { defs.forEach((d) => this.monsters.set(d.id, d)); }
  addZones(defs: ZoneDef[]): void { defs.forEach((d) => this.zones.set(d.id, d)); }
  addTechs(defs: TechDef[]): void { defs.forEach((d) => this.techs.set(d.id, d)); }
  addStations(defs: StationServiceDef[]): void { defs.forEach((d) => this.stations.set(d.id, d)); }
  addEvents(defs: EventDef[]): void { defs.forEach((d) => this.events.set(d.id, d)); }
  addFusionRecipes(defs: FusionRecipeDef[]): void { defs.forEach((d) => this.fusionRecipes.set(d.id, d)); }

  /** 沿品质谱系找下一品质卡（升级用） */
  nextRarity(card: CardDef): CardDef | undefined {
    const idx = RARITY_ORDER.indexOf(card.rarity);
    if (idx < 0 || idx >= RARITY_ORDER.length - 1) return undefined;
    return this.cards.get(`${card.lineageId}_${RARITY_ORDER[idx + 1]}`);
  }

  // ---------- 校验 ----------
  validateAll(): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const err = (msg: string) => errors.push(msg);
    const warn = (msg: string) => warnings.push(msg);

    // --- 英雄 ---
    if (this.heroes.size === 0) warn('英雄数据为空（步骤1填充）');
    for (const h of this.heroes.values()) {
      if (!VALID_POS.has(h.defaultCarriage as CarriagePos)) err(`英雄 ${h.id} 默认车厢非法`);
      if (h.baseHp <= 0) err(`英雄 ${h.id} 生命值非法`);
      if (h.awakening.duration <= 0) err(`英雄 ${h.id} 觉醒时长非法`);
      for (const t of h.obsession.thresholds) {
        if (![3, 6, 10].includes(t.at)) err(`英雄 ${h.id} 阈值 ${t.at} 需为 3/6/10`);
      }
    }

    // --- 卡牌 ---
    if (this.cards.size === 0) warn('卡牌数据为空（步骤1填充）');
    for (const c of this.cards.values()) {
      if (c.cost < 0 || c.cost > 5) err(`卡 ${c.id} 费用 ${c.cost} 越界`);
      if (!RARITY_ORDER.includes(c.rarity as Rarity)) err(`卡 ${c.id} 品质非法`);
      if (c.heroId && !this.heroes.has(c.heroId)) err(`卡 ${c.id} 英雄引用悬空: ${c.heroId}`);
      for (const tag of c.tags) if (!KNOWN_TAGS.has(tag)) err(`卡 ${c.id} 未知标签: ${tag}`);
      if (c.carriageReq) {
        if (!['exact', 'not', 'range'].includes(c.carriageReq.mode)) err(`卡 ${c.id} 车厢条件模式非法`);
        for (const p of c.carriageReq.pos) if (!VALID_POS.has(p)) err(`卡 ${c.id} 车厢条件位置越界: ${p}`);
      }
      if (c.speedDelta !== undefined && (c.speedDelta < -5 || c.speedDelta > 5)) err(`卡 ${c.id} 速度变化越界`);
      if (c.resonance && c.resonance.countReq < 1) err(`卡 ${c.id} 共鸣需求非法`);
      this.validateEffects(c.effects, `卡 ${c.id}`, err);
    }
    // 谱系完整性：专属卡应有同谱系更高品质（橙卡与遗物牌除外）
    for (const c of this.cards.values()) {
      if (c.kind === 'relic' || c.rarity === 'orange') continue;
      const up = this.nextRarity(c);
      if (!up) warn(`卡 ${c.id} 谱系 ${c.lineageId} 缺少 ${RARITY_ORDER[RARITY_ORDER.indexOf(c.rarity as Rarity) + 1]} 品质升级卡`);
    }

    // --- 怪物 ---
    if (this.monsters.size === 0) warn('怪物数据为空（步骤1填充）');
    for (const m of this.monsters.values()) {
      if (!this.zones.has(m.zoneId)) err(`怪物 ${m.id} 区域引用悬空: ${m.zoneId}`);
      if (m.hp <= 0) err(`怪物 ${m.id} 血量非法`);
      for (const p of m.pos) if (!VALID_POS.has(p)) err(`怪物 ${m.id} 站位越界: ${p}`);
      for (const t of m.traits ?? []) if (!KNOWN_TRAITS.has(t.id)) err(`怪物 ${m.id} 未知特性: ${t.id}`);
      if (!['cycle', 'random', 'priority'].includes(m.ai.pattern)) err(`怪物 ${m.id} AI模式非法`);
      if (m.actions.length === 0 && !(m.phases && m.phases.length) && !m.endTurnEffects && !m.selfDestruct) err(`怪物 ${m.id} 无行动定义`);
      for (const a of m.actions) this.validateEffects(a.effects, `怪物 ${m.id}.${a.id}`, err);
      if (m.phases) {
        if (m.phases.length < 2) warn(`Boss ${m.id} 阶段数 ${m.phases.length}（建议≥2）`);
        for (const ph of m.phases) {
          for (const a of ph.actions) this.validateEffects(a.effects, `Boss ${m.id}.${ph.name}.${a.id}`, err);
          if (ph.passive) for (const e of ph.passive) this.validateEffects([e], `Boss ${m.id}.${ph.name}.passive`, err);
        }
        if (!m.bossAdvance && m.id.includes('boss')) warn(`Boss ${m.id} 未标记 bossAdvance`);
      }
    }

    // --- 区域 ---
    if (this.zones.size === 0) warn('区域数据为空（步骤1填充）');
    for (const z of this.zones.values()) {
      for (const p of z.monsterPool) if (!this.monsters.has(p.defId)) err(`区域 ${z.id} 怪物池引用悬空: ${p.defId}`);
      for (const e of z.elitePool) if (!this.monsters.has(e)) err(`区域 ${z.id} 精英引用悬空: ${e}`);
      if (!this.monsters.has(z.bossId)) err(`区域 ${z.id} Boss引用悬空: ${z.bossId}`);
      if (z.hpScale <= 0 || z.damageScale <= 0) err(`区域 ${z.id} 数值倍率非法`);
    }

    // --- 科技/调度站/事件/配方 ---
    for (const t of this.techs.values()) if (t.cost <= 0) err(`科技 ${t.id} 消耗非法`);
    for (const s of this.stations.values()) if (s.cost < 0) err(`调度站服务 ${s.id} 消耗非法`);
    for (const e of this.events.values()) {
      if (e.choices.length === 0) err(`事件 ${e.id} 无选项`);
      for (const ch of e.choices) this.validateEffects(ch.effects, `事件 ${e.id}`, err);
    }
    for (const r of this.fusionRecipes.values()) {
      if (!this.cards.has(r.cardA) || !this.cards.has(r.cardB)) err(`融合配方 ${r.id} 素材卡悬空`);
      if (!this.cards.has(r.resultCardId)) err(`融合配方 ${r.id} 产物卡悬空: ${r.resultCardId}`);
    }

    return { errors, warnings };
  }

  private validateEffects(effects: readonly { kind: string; target?: { side: string; mode: string; pos?: number[] }; status?: string; condition?: string; chance?: number }[], ctx: string, err: (s: string) => void): void {
    for (const e of effects) {
      if (e.status && !KNOWN_STATUS.has(e.status)) err(`${ctx} 未知状态: ${e.status}`);
      if (e.condition && !KNOWN_CONDITIONS.has(e.condition)) err(`${ctx} 未知条件: ${e.condition}`);
      if (e.chance !== undefined && (e.chance < 0 || e.chance > 1)) err(`${ctx} 概率越界`);
      if (e.target?.pos) for (const p of e.target.pos) if (!VALID_POS.has(p)) err(`${ctx} 目标位置越界: ${p}`);
    }
  }
}

export const registry = new Registry();
