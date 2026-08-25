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

export const RELIC_CARDS: CardDef[] = [];

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
