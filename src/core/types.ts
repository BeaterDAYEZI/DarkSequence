// ============================================================
// 《暗蚀牌序》全局类型与 Schema —— 数据驱动架构的根基
// 所有卡牌/怪物/英雄/区域/科技/事件数据都遵循这里的定义
// ============================================================

// ---------- 品质 ----------
export type Rarity = 'white' | 'green' | 'blue' | 'orange';
export const RARITY_ORDER: Rarity[] = ['white', 'green', 'blue', 'orange'];
export const RARITY_NAME: Record<Rarity, string> = {
  white: '白', green: '绿', blue: '蓝', orange: '橙',
};

// ---------- 英雄 ----------
export type HeroId = 'warwick' | 'morgan' | 'serafina' | 'auris';

// ---------- 车厢站位（1=煤水车/车头，4=车尾平台） ----------
export type CarriagePos = 1 | 2 | 3 | 4;

// ---------- 攻击类型 / 伤害类型 ----------
export type AttackType = 'melee' | 'ranged';        // 车厢修正用：1号车厢近战+10%远程-20% 等
export type DamageType = 'physical' | 'arcane';     // 灵体特性：物理-30% 法术+50%

// ---------- 状态效果 ----------
export type StatusId =
  | 'bleed'          // 流血：每回合流失N点生命，持续X回合
  | 'vulnerable'     // 易伤：受伤+30%/层
  | 'fear'           // 恐惧：伤害-20%/层
  | 'tenacity'       // 坚韧：下次受伤减半（stacks=次数）
  | 'imprison'       // 禁锢：本回合无法使用位移牌
  | 'healReduction'  // 减疗：受到治疗-50%/75%/100%
  | 'dodge'          // 闪避：chance 概率抵挡一次攻击（stacks=次数）
  | 'stun'           // 眩晕：跳过N回合行动
  | 'mark'           // 标记：受伤+30%
  | 'taunt'          // 嘲讽：强制敌方攻击自己
  | 'strength'       // 力量：攻击+stacks
  | 'revenge'        // 复仇：复活后本场战斗伤害+50%（value=倍率）
  | 'guard'          // 援护：替所有队友承受伤害
  | 'silenceHeal'    // 低语：本回合无法使用治疗牌
  | 'awakened'       // 觉醒中：伤害+50%、受伤-25%、专属牌费-1
  | 'critUp'         // 暴击率提升（value=单层数值，stacks=层数）
  | 'enraged'        // 暴走·敌：伤害+50%（value=倍率）
  | 'swallowed';     // 被吞噬：移出战斗（需累计伤害救回）

// ---------- 条件（EffectSpec.condition 引用） ----------
export type ConditionId =
  | 'targetHpBelow50'   // 目标生命<50%
  | 'speedGE2'          // 列车速度≥2
  | 'speedGE3'          // 列车速度≥3
  | 'madnessAbove50'    // 狂气>50
  | 'killedThisHit';    // 本次伤害击杀目标

// ---------- 目标选择器 ----------
export interface TargetSelector {
  side: 'enemy' | 'ally';
  /** pos=指定位置；front/back=最前/最后；random=随机；all=全体；
   *  lowestHp=最低血量；marked=被标记者；lowestHpAlly/highestMadnessAlly=己方；
   *  self=打出者自身；random2=随机交换两名单位 */
  mode: 'pos' | 'front' | 'back' | 'random' | 'all' | 'lowestHp' | 'marked'
      | 'lowestHpAlly' | 'highestMadnessAlly' | 'self' | 'random2';
  pos?: number[];
  count?: number;   // random 时选取数量，默认1
}

// ---------- 效果 DSL（CardResolver 解释执行） ----------
export type EffectKind =
  | 'damage'            // 伤害（可多段/范围值/穿格挡/溢伤转化倍率/暗蚀加成）
  | 'block'             // 格挡
  | 'heal'              // 治疗
  | 'draw'              // 抽牌
  | 'energyGain'        // 能量
  | 'taunt'             // 嘲讽
  | 'speed'             // 列车速度±（同时全体英雄轮转车厢、Boss后退）
  | 'pull'              // 将目标拉拽至最前（1号位）
  | 'push'              // 目标后退1格
  | 'shufflePos'        // 交换/打乱站位
  | 'madnessGain'       // 狂气+
  | 'madnessTransfer'   // 自身狂气转移给敌方全体（转移量=压力伤害）
  | 'madnessClear'      // 清除狂气
  | 'soulfireSteal'     // 窃取魂火
  | 'soulfireGain'      // 获得魂火
  | 'applyStatus'       // 施加状态
  | 'clearStatus'       // 清除状态
  | 'extraAction'       // 额外行动（连斩：免费再打一张该英雄手牌）
  | 'costOverride'      // 费用覆盖（如觉醒时本牌无消耗）
  | 'summon'            // 召唤（Boss用）
  | 'soulfireClear'     // 清空魂火（枕木自爆）
  | 'critGain'          // 暴击率提升（scope: battle=本场 run=全局）
  | 'swallow';          // 吞噬1号位英雄（Boss蠕虫）

export interface EffectSpec {
  kind: EffectKind;
  target?: TargetSelector;
  amount?: number | [number, number];   // 固定值 或 [min,max] 区间
  times?: number;                       // 多段攻击次数
  status?: StatusId;                    // applyStatus/clearStatus 用
  stacks?: number;
  duration?: number;                    // -1 = 永久
  chance?: number;                      // 0~1 概率
  value?: number;                       // 状态数值参数（恐惧0.2/易伤0.3/减疗0.5…）
  condition?: ConditionId;
  pierceBlock?: boolean;                // 无视格挡
  overkillMult?: number;                // 溢伤→暗蚀能量 倍率（默认1）
  allToDarkMult?: number;               // 全部伤害→暗蚀能量 倍率（不依赖溢出）
  plusPerDark?: number;                 // 伤害 += 暗蚀能量 × N
  consumeDark?: boolean;                // 结算后清空暗蚀能量
  summonId?: string;                    // summon 用
  summonPos?: number;                   // summon 用
  // ---- 伤害类附加 ----
  hpBelow50Bonus?: number;              // 目标生命<50% 伤害加成（0.3=+30%）
  selfMadnessAbove50Mult?: number;      // 自身狂气>50 伤害倍率（1.0=翻倍）
  madnessOnHit?: number;                // 命中附带狂气
  onKillExtra?: boolean;                // 击杀→额外行动（连斩）
  critMult?: number;                    // 本次攻击暴击率倍率（2=翻倍）
  lastHitCrit?: boolean;                // 最后一段必暴击
  reduceBlockPerHit?: number;           // 每次命中降低格挡
  // ---- 效果类附加 ----
  valuePerSpeed?: number;               // value = 列车速度 × N
  drawIfEmpty?: number;                 // 狂气转移后若归零则抽牌
  replayIfAwakened?: boolean;           // 打出后觉醒→免消耗且再打一次
  clearMadnessIfSpeedZero?: boolean;    // 速度归零→清除全队狂气
  fallbackDamage?: number;              // 魂火不足时改为伤害
  critScope?: 'battle' | 'run';         // critGain 作用域
}

// ---------- 卡牌 ----------
export type CardKind = 'hero' | 'relic';

export interface CarriageReq {
  mode: 'exact' | 'not' | 'range';
  pos: number[];
}

export interface ResonanceSpec {
  tag: string;        // 共鸣词缀
  countReq: number;   // 本回合先打出 ≥N 张同 tag 牌后触发
  bonus: number;      // 数值倍率（1.5 = +50%）
}

export interface CardDef {
  id: string;              // 唯一id，含品质后缀：warwick_wall_white
  lineageId: string;       // 升级谱系：warwick_wall（升级=沿谱系换id）
  name: string;
  flavor?: string;
  heroId?: HeroId;         // 无 = 遗物牌
  kind: CardKind;
  rarity: Rarity;
  cost: number;
  tags: string[];          // speed/displace/heal/madness/aoe/arcane/melee…
  attackType?: AttackType;
  damageType?: DamageType;
  speedDelta?: number;     // 打出时列车速度变化
  carriageReq?: CarriageReq;
  speedReq?: { min?: number; max?: number };
  resonance?: ResonanceSpec;
  effects: EffectSpec[];
  isFused?: boolean;       // 铭刻融合产物（灾厄化身判定用）
}

// ---------- 特性（怪物） ----------
export type TraitId = 'thorns' | 'spiritBody' | 'packInstinct' | 'stealth' | 'rooted' | 'chainBound';

export interface TraitDef {
  id: TraitId;
  params?: Record<string, number>;
}

// ---------- 怪物 ----------
export interface MonsterActionDef {
  id: string;
  name: string;
  icon: string;                 // 意图图标占位：⚔️🛡💀🔮♨️…
  desc?: string;
  effects: EffectSpec[];
  cooldown?: number;            // 冷却回合数
  firstUseTurn?: number;        // 首次可用回合
  condition?: string;           // 特殊条件（如"atPos2"=推进至2号位）
  special?: string;             // 特殊行动（"memoryRail"=记忆铁轨）
  attackType?: AttackType;      // 默认 melee
  damageType?: DamageType;      // 默认 physical
}

export interface BossPhaseDef {
  name: string;
  hpThreshold: number;          // 血量比例（0-1）
  passive?: EffectSpec[];       // 每回合开始自动生效
  actions: MonsterActionDef[];
}

export interface MonsterDef {
  id: string;
  name: string;
  zoneId: string;
  isPlaceholder?: boolean;
  flavor?: string;
  hp: number;
  speed: number;                // 单体速度（决定敌方内部行动顺序）
  pos: number[];                // 允许站位（敌方队列1-4）
  traits?: TraitDef[];
  ai: { pattern: 'cycle' | 'random' | 'priority'; weights?: number[] };
  actions: MonsterActionDef[];
  phases?: BossPhaseDef[];      // Boss多阶段
  bossAdvance?: boolean;        // 每回合向车头推进1格，到1号位脱轨
  endTurnEffects?: EffectSpec[];    // 每回合结束自动生效（枕木共振）
  selfDestruct?: { hpPct: number; effects: EffectSpec[] };  // 低血量自爆
  isElite?: boolean;
}

// ---------- 英雄 ----------
export interface ObsessionOption {
  id: string;
  name: string;
  desc: string;
  stat: 'maxHp' | 'attack' | 'blockPerTurn' | 'healPower' | 'energyMax';
  amount: number;
}

export interface ObsessionThreshold {
  at: number;         // 累计灌注第N次解锁
  id: string;
  name: string;
  desc: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: string;              // 主题色
  defaultCarriage: CarriagePos;
  baseHp: number;
  attackType: AttackType;
  damageType: DamageType;
  awakening: { duration: number };
  obsession: { options: ObsessionOption[]; thresholds: ObsessionThreshold[] };
  quote: string;
  intro: string;
}

// ---------- 区域 ----------
export interface EnvironmentRuleDef {
  id: 'speedStartDelta' | 'enemyBlockPerTurn' | 'healNerf' | 'bossSpeedGrow';
  name: string;
  desc: string;
  amount?: number;
}

export interface ZoneDef {
  id: string;
  name: string;
  isPlaceholder?: boolean;
  theme: string;
  environmentRule: EnvironmentRuleDef;
  monsterPool: { defId: string; weight: number }[];
  elitePool: string[];
  bossId: string;
  hpScale: number;
  damageScale: number;
  nodeLayout: string[];     // 节点类型模板（map生成用，步骤4）
  entryNarration: string;
  /** 预设遭遇组合：教学遭遇与固定配置 */
  encounters?: { id: string; monsters: { defId: string; count: number }[] }[];
}

// ---------- 列车科技 ----------
export type TechEffectId = 'initialSpeed' | 'armorPlating' | 'echoAmplify' | 'soulfireCondense' | 'coffinResonance';

export interface TechDef {
  id: string;
  name: string;
  cost: number;             // 蚀铁
  desc: string;
  effectId: TechEffectId;
  tier: number;
}

// ---------- 调度站服务 ----------
export interface StationServiceDef {
  id: string;
  name: string;
  cost: number;             // 魂火
  desc: string;
}

// ---------- 事件节点 ----------
export interface EventChoiceDef {
  text: string;
  effects: EffectSpec[];    // 复用效果DSL做地图层结算（heal/madnessClear/soulfireGain…）
  note?: string;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoiceDef[];
}

// ---------- 融合配方 ----------
export interface FusionRecipeDef {
  id: string;
  cardA: string;
  cardB: string;
  resultCardId: string;
}

// ---------- 地图节点（步骤4细化） ----------
export type MapNodeType = 'start' | 'battle' | 'elite' | 'station' | 'event' | 'fork' | 'boss';

export interface MapNode {
  id: string;
  type: MapNodeType;
  zoneId: string;
  next: string[];           // 下游节点id
  eventId?: string;
  encounterIds?: string[];  // 可能遭遇的怪物组合（battle/elite）
  resolved?: boolean;
}

// ============================================================
// 运行时状态（RunState 及战斗快照）—— 全部可 JSON 序列化
// ============================================================

export interface StatusInstance {
  id: StatusId;
  stacks: number;
  duration: number;   // -1 = 永久/整场
  value?: number;
}

export interface HeroInstance {
  heroId: HeroId;
  hp: number;
  maxHp: number;
  pos: CarriagePos;
  block: number;                // 格挡
  madness: number;              // 0-100
  statuses: StatusInstance[];
  awakeningTurns: number;       // 觉醒剩余回合，0=未觉醒
  alive: boolean;               // false=残影化
  runaway: boolean;             // 暴走中：本回合无法行动
  critChance: number;           // 本场战斗暴击率（0.05=5%基础）
  runCritBonus: number;         // 全局珍藏暴击率（禁忌知识橙）
  obsessionCount: number;       // 累计灌注次数
  infused: Record<string, number>; // 灌注属性累计值 {maxHp:3, attack:1...}
  hasRevenge: boolean;          // 本场战斗是否带复仇
}

export interface EnemyInstance {
  uid: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  pos: number;
  speed: number;
  block: number;
  statuses: StatusInstance[];
  phaseIndex: number;           // Boss阶段
  intent?: { actionId: string; name: string; icon: string; desc: string };
  cooldowns: Record<string, number>;
  nextActionAt: number;         // 下次可用行动的回合
  stunTurns: number;
  summoned?: boolean;
  stealthArmed?: boolean;       // 潜行已武装（每回合首次受击80%闪避）
  lastHp: number;               // 上次记录血量（阶段切换/触发判断用）
  aiIndex: number;              // cycle模式行动游标
}

/** 行动队列条目：执行阶段按 FIFO 结算，可向队首插入 */
export interface QueueAction {
  kind: 'playCard' | 'enemyAct' | 'extraPlay' | 'bossAdvance' | 'derailCheck' | 'endTurn';
  cardId?: string;
  heroId?: HeroId;      // playCard/extraPlay 归属英雄
  enemyUid?: string;    // enemyAct 归属
  free?: boolean;       // extraPlay 免能量
}

export interface BattleState {
  turn: number;
  playerFirst: boolean;
  trainSpeed: number;             // 0-5
  energy: number;
  energyMax: number;
  soulfire: number;
  darkEnergy: number;             // 本场战斗内临时资源
  heroes: Record<HeroId, HeroInstance>;
  enemies: EnemyInstance[];
  queue: QueueAction[];
  phase: 'start' | 'reveal' | 'draw' | 'planning' | 'execution' | 'end' | 'victory' | 'defeat';
  playedThisTurn: { heroId: HeroId; cardId: string }[];   // 本回合出牌记录（记忆铁轨用）
  resonanceCount: Record<string, number>;                 // 本回合已打出 tag 计数
  speedPlayedThisTurn: number;                            // 本回合加速牌计数
  swallow?: { heroId: HeroId; need: number; dealt: number };  // 蠕虫吞噬状态
  furnaceStacks: number;                                  // 炉火升温层数（每层攻击+20%）
  zoneId: string;                                         // 当前战斗所在区域
  blockNerf: number;                                      // 遗忘之轨：格挡获取-2（最低0）
}

/** 单局状态快照（唯一真相源） */
export interface RunState {
  version: string;
  seed: number;
  zoneIndex: number;              // 当前区域 0-4
  map: MapNode[];
  currentNodeId: string;
  deck: {
    drawPile: string[];
    hand: string[];
    discardPile: string[];
    /** 残影化英雄的卡牌暂存处（复活时归还） */
    resting: Record<string, string[]>;
  };
  /** 动态生成的卡牌（铭刻融合产物，读档时重建注册） */
  customCards: Record<string, CardDef>;
  heroes: Record<HeroId, HeroInstance>;
  resources: {
    shards: number;      // 残响碎片
    etchant: number;     // 蚀刻剂
    obsession: number;   // 执念值
    soulfire: number;    // 魂火（跨战斗）
    darkIron: number;    // 蚀铁
  };
  techUnlocked: string[];
  energyMax: number;
  forkMemory: Record<string, 'memory' | 'oblivion'>;  // 各区域岔道选择记录
  avatarForm: boolean;   // 灾厄化身
  stats: { kills: number; damage: number; turns: number };
  flags: Record<string, boolean | number | string>;  // 事件/剧情/岔道标记
}
