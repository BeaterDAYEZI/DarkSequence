// 遗物牌：全英雄通用牌池，带"牌组共鸣"词缀，支持铭刻融合
import type { CardDef, TargetSelector } from '../core/types';

const EPOS = (pos: number[]): TargetSelector => ({ side: 'enemy', mode: 'pos', pos });
const EALL: TargetSelector = { side: 'enemy', mode: 'all' };
const EFRONT: TargetSelector = { side: 'enemy', mode: 'front' };
const ALLY_ALL: TargetSelector = { side: 'ally', mode: 'all' };
const ALLY_LOWEST: TargetSelector = { side: 'ally', mode: 'lowestHpAlly' };
const SELF: TargetSelector = { side: 'ally', mode: 'self' };

function relic(p: {
  id: string; name: string; rarity: CardDef['rarity']; cost: number;
  effects: CardDef['effects']; tags?: string[]; flavor?: string;
  resonance?: CardDef['resonance']; attackType?: CardDef['attackType']; damageType?: CardDef['damageType'];
  isFused?: boolean;
}): CardDef {
  return { ...p, lineageId: p.id, kind: 'relic', tags: p.tags ?? [] };
}

export const RELIC_CARDS: CardDef[] = [
  // ---- 起始遗物（白色×2） ----
  relic({
    id: 'relic_railpatrol', name: '铁轨巡检', rarity: 'white', cost: 1,
    tags: ['draw'], flavor: '在铁轨上走了一辈子，闭着眼也知道哪里有松动。',
    effects: [{ kind: 'draw', amount: 1 }, { kind: 'block', target: SELF, amount: 3 }],
  }),
  relic({
    id: 'relic_rustwrench', name: '锈蚀扳手', rarity: 'white', cost: 1,
    tags: ['resonance'], attackType: 'melee', damageType: 'physical',
    flavor: '扳手旧了，但拧断骨头的力气还在。',
    effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [3, 5] }],
  }),
  // ---- 绿色 ----
  relic({
    id: 'relic_steamburst', name: '蒸汽喷涌', rarity: 'green', cost: 2,
    tags: ['speed'], flavor: '锅炉的脾气和它的温度一样不稳定。',
    effects: [{ kind: 'speed', amount: 1 }, { kind: 'block', target: ALLY_ALL, amount: 2 }],
  }),
  relic({
    id: 'relic_phosphor', name: '磷光提灯', rarity: 'green', cost: 1,
    tags: ['resonance'], flavor: '灯里烧的不是油，是一小截还亮着的亡魂。',
    effects: [{ kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: 1 }],
  }),
  relic({
    id: 'relic_fogcrystal', name: '蚀雾凝晶', rarity: 'green', cost: 2,
    tags: ['heal', 'resonance'], flavor: '把雾捏成晶体，疼痛也会跟着凝固。',
    effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: 4 }, { kind: 'madnessClear', target: SELF, amount: 5 }],
  }),
  // ---- 蓝色 ----
  relic({
    id: 'relic_wraithsignal', name: '亡魂号志', rarity: 'blue', cost: 3,
    tags: ['aoe', 'resonance'], attackType: 'ranged', damageType: 'arcane',
    flavor: '号志亮起时，雾里的东西都会回头看。',
    effects: [{ kind: 'damage', target: EALL, amount: [4, 6] }],
  }),
  relic({
    id: 'relic_chainwinch', name: '锁链绞盘', rarity: 'blue', cost: 2,
    tags: ['displace', 'resonance'], flavor: '绞盘一转，总有什么东西要被拖过来。',
    effects: [{ kind: 'pull', target: EPOS([4]) }, { kind: 'damage', target: EPOS([1]), amount: 5 }],
    resonance: { tag: '机关', countReq: 2, bonus: 1.5 },
  }),
  relic({
    id: 'relic_boilerrune', name: '锅炉铭文', rarity: 'blue', cost: 2,
    tags: ['draw'], flavor: '铭文刻在锅炉内壁，蒸汽每一次循环都会念一遍。',
    effects: [{ kind: 'energyGain', amount: 2 }],
  }),
  relic({
    id: 'relic_crowtalisman', name: '鸦群护符', rarity: 'blue', cost: 2,
    tags: ['draw', 'resonance'], flavor: '乌鸦记得每一具尸体的位置。',
    effects: [{ kind: 'draw', amount: 2 }, { kind: 'applyStatus', target: SELF, status: 'dodge', stacks: 1, duration: -1, value: 1 }],
    resonance: { tag: '星蚀', countReq: 2, bonus: 1.5 },
  }),
  // ---- 橙色 ----
  relic({
    id: 'relic_etchedsaw', name: '蚀铁锯刃', rarity: 'orange', cost: 4,
    tags: ['resonance'], attackType: 'melee', damageType: 'physical',
    flavor: '锯齿间卡着上一场战斗的碎屑，还有上一场战斗的惨叫。',
    effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [8, 12], hpBelow50Bonus: 0.3 }],
    resonance: { tag: '机关', countReq: 3, bonus: 1.5 },
  }),
  relic({
    id: 'relic_starcompass', name: '蚀星星盘', rarity: 'orange', cost: 3,
    tags: ['draw', 'resonance'], attackType: 'ranged', damageType: 'arcane',
    flavor: '星盘上所有的指针，都指向同一个人的死期。',
    effects: [{ kind: 'damage', target: EALL, amount: [3, 5], times: 2, overkillMult: 2 }],
    resonance: { tag: '星蚀', countReq: 2, bonus: 1.5 },
  }),
];

// ============================================================
// 公共遗物牌池（卡牌优化 v1）：泛用辅助P-01~07 / 流派核心C-01~08 / 风险收益R-01~05
// 获取方式：岔道奖励、战斗掉落、调度站兑换
// ============================================================
export const PUBLIC_RELIC_CARDS: CardDef[] = [
  // ---- 泛用辅助 ----
  relic({
    id: 'p01_gear', name: '锈蚀齿轮', rarity: 'green', cost: 0,
    tags: ['speed', 'draw'], flavor: '转不动的齿轮，也能撬动时间。',
    effects: [{ kind: 'draw', amount: 1 }, { kind: 'speed', amount: 1 }],
  }),
  relic({
    id: 'p02_armorplate', name: '蚀铁护甲片', rarity: 'green', cost: 1,
    tags: ['defense', 'heal'], flavor: '贴在胸口的最后一道防线。',
    effects: [{ kind: 'block', target: SELF, amount: 5 }, { kind: 'heal', target: SELF, amount: 2 }],
  }),
  relic({
    id: 'p03_crystal', name: '共鸣水晶', rarity: 'green', cost: 0,
    tags: ['madness', 'heal'], flavor: '水晶里困着一段还没散去的叹息。',
    effects: [{ kind: 'madnessGain', target: ALLY_ALL, amount: 2 }, { kind: 'heal', target: ALLY_ALL, amount: 3 }],
  }),
  relic({
    id: 'p04_signal', name: '信号灯', rarity: 'green', cost: 1,
    tags: ['crit'], flavor: '灯亮起的时候，所有人都知道要动手了。',
    effects: [{ kind: 'applyStatus', target: ALLY_ALL, status: 'critUp', stacks: 1, duration: 1, value: 0.15 }],
  }),
  relic({
    id: 'p05_bandage', name: '急救绷带', rarity: 'green', cost: 0,
    tags: ['heal'], flavor: '缠得够紧，就能假装伤口不存在。',
    effects: [{ kind: 'clearStatus', target: ALLY_LOWEST, status: 'bleed', stacks: 1 }, { kind: 'clearStatus', target: ALLY_LOWEST, status: 'corrosion', stacks: 1 }],
  }),
  relic({
    id: 'p06_cinder', name: '煤渣', rarity: 'green', cost: 0,
    tags: ['soulfire'], flavor: '锅炉吃剩的渣滓，也能换点东西。',
    effects: [{ kind: 'discardCard' }, { kind: 'soulfireGain', amount: 5 }],
  }),
  relic({
    id: 'p07_rivet', name: '铁轨铆钉', rarity: 'green', cost: 1,
    tags: ['attack', 'speed'], flavor: '敲下去，整条铁轨都会抖一抖。',
    effects: [{ kind: 'damage', target: EPOS([1]), amount: 4 }, { kind: 'speed', amount: -1 }],
  }),
  // ---- 流派核心 ----
  relic({
    id: 'c01_engine', name: '魂火引擎', rarity: 'blue', cost: 1,
    tags: ['soulfire'], flavor: '把魂火烧进锅炉，让整列列车咆哮。',
    effects: [{ kind: 'soulfireSteal', amount: 10 }, { kind: 'damageMultTurn', damageMult: 1.3 }],
  }),
  relic({
    id: 'c02_conduit', name: '暗蚀导管', rarity: 'blue', cost: 1,
    tags: ['overkill'], flavor: '溢出的能量顺着导管流进每个人的肌肉。',
    effects: [{ kind: 'permanentStrength', limitPerRun: true, darkToStrength: true }],
  }),
  relic({
    id: 'c03_valve', name: '增压阀', rarity: 'blue', cost: 1,
    tags: ['speed'], flavor: '压力表红到发烫，但速度从不撒谎。',
    effects: [{ kind: 'speed', amount: 3 }, { kind: 'damage', target: ALLY_ALL, amount: 5, pierceBlock: true }],
  }),
  relic({
    id: 'c04_brake', name: '刹车间', rarity: 'blue', cost: 0,
    tags: ['speed', 'madness'], flavor: '全速倒车，把脑子里的轰鸣也甩出去。',
    effects: [{ kind: 'speed', amount: -5 }, { kind: 'madnessClear', target: ALLY_ALL }],
  }),
  relic({
    id: 'c05_resonator', name: '狂气共鸣器', rarity: 'blue', cost: 1,
    tags: ['madness', 'aoe'], flavor: '一个人的疯狂，经它能变成一群人的灾难。',
    effects: [{ kind: 'copyMadness', target: { side: 'ally', mode: 'highestMadnessAlly' } }],
  }),
  relic({
    id: 'c06_doublefire', name: '双连发装置', rarity: 'blue', cost: 2,
    tags: ['attack'], flavor: '扳机扣两下，第二下留给悔恨。',
    effects: [{ kind: 'nextAttackDouble' }],
  }),
  relic({
    id: 'c07_markbarrage', name: '标记弹幕', rarity: 'blue', cost: 1,
    tags: ['mark'], flavor: '每一道瞄准线都是一句宣判。',
    effects: [{ kind: 'applyStatus', target: EALL, status: 'mark', stacks: 1, duration: 2 }],
  }),
  relic({
    id: 'c08_acid', name: '腐蚀酸液', rarity: 'blue', cost: 1,
    tags: ['dot'], flavor: '蚀雾的液态形态，比雾更记仇。',
    effects: [{ kind: 'applyStatus', target: EFRONT, status: 'corrosion', stacks: 2, duration: 3, value: 4 }],
  }),
  // ---- 风险收益 ----
  relic({
    id: 'r01_pact', name: '恶魔契约', rarity: 'orange', cost: 0,
    tags: ['risk'], flavor: '签下名字的那刻，你的影子咧开了嘴。',
    effects: [{ kind: 'damageMultTurn', damageMult: 2 }, { kind: 'applyStatus', target: ALLY_ALL, status: 'exhaust', stacks: 1, duration: 1 }],
  }),
  relic({
    id: 'r02_sacrifice', name: '血祭献祭', rarity: 'orange', cost: 0,
    tags: ['soulfire', 'risk'], flavor: '把最后一点体温换成一捧火。',
    effects: [{ kind: 'soulfireGain', amount: 30 }, { kind: 'hpSet', hpTo: 1 }],
  }),
  relic({
    id: 'r03_inhaler', name: '蚀雾吸入口', rarity: 'orange', cost: 0,
    tags: ['draw', 'madness', 'risk'], flavor: '深吸一口。知识在肺里燃烧。',
    effects: [{ kind: 'draw', amount: 3 }, { kind: 'madnessGain', target: ALLY_ALL, amount: 15 }],
  }),
  relic({
    id: 'r04_abandoned', name: '废弃车厢', rarity: 'orange', cost: 2,
    tags: ['risk', 'speed'], flavor: '拆掉一节车厢，换来的自由值得吗？',
    effects: [{ kind: 'ignorePosTurn' }, { kind: 'permanentSpeed', amount: -2 }],
  }),
  relic({
    id: 'r05_timewarp', name: '时空错位', rarity: 'orange', cost: 1,
    tags: ['draw', 'risk'], flavor: '铁轨在雾里打了个结，你伸手够到了昨天的牌。',
    effects: [{ kind: 'copyLastCard' }],
  }),
];

// ---- 特殊融合产物（配方见 fusionRecipes.ts） ----
export const FUSED_CARDS: CardDef[] = [
  relic({
    id: 'fused_knell', name: '丧钟低鸣', rarity: 'orange', cost: 4,
    tags: ['madness', 'aoe'], attackType: 'ranged', damageType: 'arcane',
    flavor: '钟声与哀鸣叠在一起，分不清是谁在为谁送葬。',
    effects: [
      { kind: 'madnessTransfer', amount: 15 },
      { kind: 'damage', target: EALL, amount: [6, 9] },
      { kind: 'soulfireSteal', amount: 8 },
    ],
    isFused: true,
  }),
];
