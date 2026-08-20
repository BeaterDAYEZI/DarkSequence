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
