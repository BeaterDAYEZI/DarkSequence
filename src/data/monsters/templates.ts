// 占位怪物模板工厂：区域2-5 用统一模板 + 区域倍率生成
// 后续填充正式内容时，逐区域替换数值与文案即可，不动代码
import type { MonsterDef, TargetSelector } from '../../core/types';

const HERO_POS = (pos: number[]): TargetSelector => ({ side: 'ally', mode: 'pos', pos });
const HERO_ALL: TargetSelector = { side: 'ally', mode: 'all' };
const HERO_RANDOM: TargetSelector = { side: 'ally', mode: 'random', count: 1 };
const ENEMY_ALL: TargetSelector = { side: 'enemy', mode: 'all' };
const SELF: TargetSelector = { side: 'ally', mode: 'self' };

const r = (v: number) => Math.round(v);

/** 生成某区域的5种占位普通怪 */
export function placeholderMonsters(zoneId: string, zoneName: string, hpScale: number, dmgScale: number): MonsterDef[] {
  const dmg = (min: number, max: number): [number, number] => [r(min * dmgScale), r(max * dmgScale)];
  return [
    {
      id: `${zoneId}_soldier`, name: `蚀影步兵`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位怪物。`,
      hp: r(16 * hpScale), speed: 2, pos: [1, 2],
      traits: [{ id: 'thorns', params: { damage: r(2 * dmgScale) } }],
      ai: { pattern: 'cycle' },
      actions: [
        { id: 'slash', name: '蚀影劈砍', icon: '⚔️', desc: '对1-2号位英雄造成伤害', effects: [{ kind: 'damage', target: HERO_POS([1, 2]), amount: dmg(4, 6) }] },
        { id: 'guard', name: '蚀影凝甲', icon: '🛡️', desc: '自身格挡', effects: [{ kind: 'block', target: SELF, amount: r(4 * dmgScale) }] },
      ],
    },
    {
      id: `${zoneId}_archer`, name: `蚀影弓手`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位怪物。`,
      hp: r(10 * hpScale), speed: 3, pos: [3, 4],
      ai: { pattern: 'cycle' },
      actions: [
        { id: 'shot', name: '蚀影箭', icon: '🏹', desc: '对3-4号位英雄造成伤害', effects: [{ kind: 'damage', target: HERO_POS([3, 4]), amount: dmg(3, 5) }] },
        { id: 'aim', name: '瞄准标记', icon: '🎯', desc: '标记一名英雄', effects: [{ kind: 'applyStatus', target: HERO_RANDOM, status: 'mark', stacks: 1, duration: 1 }] },
      ],
    },
    {
      id: `${zoneId}_hound`, name: `蚀影猎犬`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位怪物。`,
      hp: r(9 * hpScale), speed: 5, pos: [1, 2],
      traits: [{ id: 'packInstinct', params: { perAlly: r(2 * dmgScale) } }],
      ai: { pattern: 'cycle' },
      actions: [
        { id: 'bite', name: '蚀影撕咬', icon: '⚔️', desc: '对1号位英雄造成伤害', effects: [{ kind: 'damage', target: HERO_POS([1]), amount: dmg(4, 6) }] },
      ],
    },
    {
      id: `${zoneId}_bulwark`, name: `蚀影壁垒`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位怪物。`,
      hp: r(24 * hpScale), speed: 1, pos: [1],
      traits: [{ id: 'rooted' }],
      ai: { pattern: 'cycle' },
      actions: [
        { id: 'wall', name: '蚀影护垒', icon: '🛡️', desc: '全体敌人获得格挡', effects: [{ kind: 'block', target: ENEMY_ALL, amount: r(3 * dmgScale) }] },
        { id: 'slam', name: '蚀影重压', icon: '⚔️', desc: '对1号位英雄造成伤害', effects: [{ kind: 'damage', target: HERO_POS([1]), amount: dmg(5, 7) }] },
      ],
    },
    {
      id: `${zoneId}_whisperer`, name: `蚀影低语`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位怪物。`,
      hp: r(12 * hpScale), speed: 4, pos: [4],
      traits: [{ id: 'spiritBody', params: { physicalMult: 0.7, arcaneMult: 1.5 } }],
      ai: { pattern: 'cycle' },
      actions: [
        { id: 'whisper', name: '蚀影低语', icon: '🔮', desc: '对随机英雄造成伤害并施加狂气', effects: [{ kind: 'damage', target: HERO_RANDOM, amount: dmg(3, 4), madnessOnHit: r(8 * dmgScale) }] },
      ],
    },
  ];
}

/** 占位精英：复用"被缚的双子"框架换数值 */
export function placeholderElites(zoneId: string, zoneName: string, hpScale: number, dmgScale: number): MonsterDef[] {
  const dmg = (min: number, max: number): [number, number] => [r(min * dmgScale), r(max * dmgScale)];
  return [
    {
      id: `${zoneId}_twin_a`, name: `蚀影调度员·甲`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位精英。`,
      hp: r(20 * hpScale), speed: 3, pos: [2],
      traits: [{ id: 'chainBound', params: { chain: 1 } }],
      ai: { pattern: 'cycle' }, isElite: true,
      actions: [
        { id: 'chaos', name: '混乱调度', icon: '🔀', desc: '全队伤害并交换两名英雄站位', effects: [{ kind: 'damage', target: HERO_ALL, amount: dmg(3, 5) }, { kind: 'shufflePos', target: { side: 'ally', mode: 'random2' } }] },
        { id: 'buff', name: '激励哨声', icon: '📣', desc: '全队敌人+3力量', effects: [{ kind: 'applyStatus', target: ENEMY_ALL, status: 'strength', stacks: 3, duration: 2 }] },
      ],
    },
    {
      id: `${zoneId}_twin_b`, name: `蚀影调度员·乙`, zoneId, isPlaceholder: true,
      flavor: `${zoneName}的占位精英。`,
      hp: r(20 * hpScale), speed: 3, pos: [3],
      traits: [{ id: 'chainBound', params: { chain: 1 } }],
      ai: { pattern: 'cycle' }, isElite: true,
      actions: [
        { id: 'flute', name: '绝望笛音', icon: '💀', desc: '单体伤害并施加狂气', effects: [{ kind: 'damage', target: HERO_RANDOM, amount: dmg(8, 10), madnessOnHit: r(15 * dmgScale) }] },
        { id: 'sand', name: '减速砂砾', icon: '⏳', desc: '列车速度-2', effects: [{ kind: 'speed', amount: -2 }] },
      ],
    },
  ];
}

/** 占位Boss：复刻牧羊人两阶段结构（推进+共振） */
export function placeholderBoss(zoneId: string, zoneName: string, hpScale: number, dmgScale: number): MonsterDef {
  const dmg = (min: number, max: number): [number, number] => [r(min * dmgScale), r(max * dmgScale)];
  return {
    id: `${zoneId}_boss`, name: `蚀影统领`, zoneId, isPlaceholder: true,
    flavor: `${zoneName}的占位Boss，正在等待它的正式设定。`,
    hp: r(40 * hpScale), speed: 2, pos: [4],
    bossAdvance: true,
    ai: { pattern: 'cycle' },
    actions: [],
    phases: [
      {
        name: '压境',
        hpThreshold: 0.5,
        actions: [
          { id: 'whip', name: '蚀影长鞭', icon: '⚔️', desc: '对2-3号位英雄造成伤害并禁锢', effects: [{ kind: 'damage', target: HERO_POS([2, 3]), amount: dmg(6, 8) }, { kind: 'applyStatus', target: HERO_POS([2, 3]), status: 'imprison', stacks: 1, duration: 1 }] },
          { id: 'summon', name: '召唤蚀影', icon: '🐕', desc: '召唤2只蚀影猎犬', cooldown: 2, effects: [{ kind: 'summon', summonId: `${zoneId}_hound`, summonPos: 1 }, { kind: 'summon', summonId: `${zoneId}_hound`, summonPos: 2 }] },
          { id: 'devour', name: '蚀影吞噬', icon: '🪱', desc: '推进至2号位时吞噬1号位英雄', condition: 'atPos2', effects: [{ kind: 'swallow', target: HERO_POS([1]) }] },
        ],
      },
      {
        name: '共振',
        hpThreshold: 0,
        passive: [
          { kind: 'madnessGain', target: HERO_ALL, amount: r(10 * dmgScale) },
          { kind: 'block', target: ENEMY_ALL, amount: 5 },
        ],
        actions: [
          { id: 'elegy', name: '蚀影挽歌', icon: '💀', desc: '全队伤害并后推英雄', effects: [{ kind: 'damage', target: HERO_ALL, amount: dmg(5, 7) }, { kind: 'push', target: HERO_ALL }] },
          { id: 'memory', name: '记忆铁轨', icon: '🎞️', desc: '复制上一回合你打出的第一张牌攻击你', special: 'memoryRail', effects: [] },
        ],
      },
    ],
  };
}
