// 区域一：遗忘平原（The Forgotten Plains）—— 全量实装
// 5种普通怪 + 精英"被缚的双子" + Boss"残响牧羊人"（两阶段）
import type { MonsterDef, TargetSelector } from '../../core/types';

const HERO_POS = (pos: number[]): TargetSelector => ({ side: 'ally', mode: 'pos', pos });
const HERO_ALL: TargetSelector = { side: 'ally', mode: 'all' };
const HERO_RANDOM: TargetSelector = { side: 'ally', mode: 'random', count: 1 };
const ENEMY_ALL: TargetSelector = { side: 'enemy', mode: 'all' };
const SELF: TargetSelector = { side: 'ally', mode: 'self' };

export const ZONE1_MONSTERS: MonsterDef[] = [
  // ============ 1. 锈蚀稻草人 ============
  {
    id: 'zone1_scarecrow',
    name: '锈蚀稻草人',
    zoneId: 'zone1',
    flavor: '农夫为驱赶乌鸦而造，蚀雾却赋予了它驱赶活人的使命。',
    hp: 18,
    speed: 1,
    pos: [1],
    traits: [{ id: 'thorns', params: { damage: 3 } }],
    ai: { pattern: 'cycle' },
    actions: [
      {
        id: 'sickle', name: '锈镰横扫', icon: '⚔️',
        desc: '对1-2号位英雄造成4-6点伤害，50%概率施加流血',
        effects: [
          { kind: 'damage', target: HERO_POS([1, 2]), amount: [4, 6] },
          { kind: 'applyStatus', target: HERO_POS([1, 2]), status: 'bleed', stacks: 1, duration: 2, chance: 0.5 },
        ],
      },
      {
        id: 'straw', name: '稻草抛撒', icon: '🛡️',
        desc: '自身格挡+5，并强制嘲讽所有英雄',
        effects: [
          { kind: 'block', target: SELF, amount: 5 },
          { kind: 'taunt', duration: 1 },
        ],
      },
    ],
  },
  // ============ 2. 哀嚎游魂 ============
  {
    id: 'zone1_wraith',
    name: '哀嚎游魂',
    zoneId: 'zone1',
    flavor: '它们曾在铁轨上等候未归的亲人，如今只剩下声带在蚀雾中共振。',
    hp: 12,
    speed: 4,
    pos: [4],
    traits: [{ id: 'spiritBody', params: { physicalMult: 0.7, arcaneMult: 1.5 } }],
    ai: { pattern: 'cycle' },
    actions: [
      {
        id: 'wail', name: '哀嚎穿刺', icon: '💀',
        desc: '对随机英雄造成4点伤害，并施加+8狂气',
        effects: [
          { kind: 'damage', target: HERO_RANDOM, amount: 4, madnessOnHit: 8 },
        ],
      },
      {
        id: 'whisper', name: '附身低语', icon: '🔮',
        desc: '清除自身负面标记，目标英雄本回合无法使用治疗牌',
        effects: [
          { kind: 'clearStatus', target: SELF },
          { kind: 'applyStatus', target: HERO_RANDOM, status: 'silenceHeal', stacks: 1, duration: 1 },
        ],
      },
    ],
  },
  // ============ 3. 蚀化猎犬 ============
  {
    id: 'zone1_hound',
    name: '蚀化猎犬',
    zoneId: 'zone1',
    flavor: '成群出动时，连列车都敢啃噬。',
    hp: 10,
    speed: 5,
    pos: [1, 2],
    traits: [{ id: 'packInstinct', params: { perAlly: 2 } }],
    ai: { pattern: 'cycle' },
    actions: [
      {
        id: 'gnaw', name: '啃噬铁轨', icon: '⚔️',
        desc: '对1号位造成3-5点伤害，并窃取2点魂火',
        effects: [
          { kind: 'damage', target: HERO_POS([1]), amount: [3, 5] },
          { kind: 'soulfireSteal', amount: 2, fallbackDamage: 3 },
        ],
      },
      {
        id: 'bite', name: '撕咬', icon: '⚔️',
        desc: '对单体造成5-7点伤害，50%概率施加流血',
        effects: [
          { kind: 'damage', target: HERO_POS([1]), amount: [5, 7] },
          { kind: 'applyStatus', target: HERO_POS([1]), status: 'bleed', stacks: 1, duration: 2, chance: 0.5 },
        ],
      },
    ],
  },
  // ============ 4. 迷雾徘徊者 ============
  {
    id: 'zone1_prowler',
    name: '迷雾徘徊者',
    zoneId: 'zone1',
    flavor: '它行走在铁轨的影子里，你只能看到它的轮廓。',
    hp: 14,
    speed: 3,
    pos: [2, 3],
    traits: [{ id: 'stealth' }],
    ai: { pattern: 'cycle' },
    actions: [
      {
        id: 'shadowstab', name: '影刺', icon: '🗡️',
        desc: '对2-3号位造成6-8点伤害，无视格挡',
        effects: [
          { kind: 'damage', target: HERO_POS([2, 3]), amount: [6, 8], pierceBlock: true },
        ],
      },
      {
        id: 'fog', name: '雾化', icon: '🌫️',
        desc: '进入潜行状态（闪避+80%），并恢复4点生命',
        special: 'rearmStealth',
        effects: [
          { kind: 'heal', target: SELF, amount: 4 },
        ],
      },
    ],
  },
  // ============ 5. 被诅咒的枕木 ============
  {
    id: 'zone1_sleeper',
    name: '被诅咒的枕木',
    zoneId: 'zone1',
    flavor: '铁轨的记忆，被蚀雾诅咒后活了过来。',
    hp: 22,
    speed: 0,
    pos: [1, 3],
    traits: [{ id: 'rooted' }],
    ai: { pattern: 'cycle' },
    actions: [],
    endTurnEffects: [
      { kind: 'heal', target: ENEMY_ALL, amount: 2 },
      { kind: 'speed', amount: -1 },
    ],
    selfDestruct: {
      hpPct: 0.3,
      effects: [
        { kind: 'damage', target: HERO_ALL, amount: [8, 10], pierceBlock: true },
        { kind: 'soulfireClear' },
      ],
    },
  },
  // ============ 精英：被缚的双子（哥哥·笑面） ============
  {
    id: 'zone1_twin_laugh',
    name: '被缚的双子·笑面',
    zoneId: 'zone1',
    flavor: '生前是一对双胞胎列车调度员，死后被同一根铁链拴在一起。他负责笑。',
    hp: 20,
    speed: 3,
    pos: [2],
    traits: [{ id: 'chainBound', params: { chain: 1 } }],
    ai: { pattern: 'cycle' },
    isElite: true,
    actions: [
      {
        id: 'chaos', name: '混乱调度', icon: '🔀',
        desc: '对全队造成3-5点伤害，并随机交换两名英雄的车厢位置',
        effects: [
          { kind: 'damage', target: HERO_ALL, amount: [3, 5] },
          { kind: 'shufflePos', target: { side: 'ally', mode: 'random2' } },
        ],
      },
      {
        id: 'whistle', name: '激励哨声', icon: '📣',
        desc: '全队敌人+3力量',
        effects: [
          { kind: 'applyStatus', target: ENEMY_ALL, status: 'strength', stacks: 3, duration: 2 },
        ],
      },
    ],
  },
  // ============ 精英：被缚的双子（弟弟·哭面） ============
  {
    id: 'zone1_twin_cry',
    name: '被缚的双子·哭面',
    zoneId: 'zone1',
    flavor: '他负责哭。哭声顺着铁链传过去，笑声顺着铁链传回来。',
    hp: 20,
    speed: 3,
    pos: [3],
    traits: [{ id: 'chainBound', params: { chain: 1 } }],
    ai: { pattern: 'cycle' },
    isElite: true,
    actions: [
      {
        id: 'flute', name: '绝望笛音', icon: '💀',
        desc: '对单体造成8-10点伤害，施加+15狂气',
        effects: [
          { kind: 'damage', target: HERO_RANDOM, amount: [8, 10], madnessOnHit: 15 },
        ],
      },
      {
        id: 'sand', name: '减速砂砾', icon: '⏳',
        desc: '列车速度-2',
        effects: [
          { kind: 'speed', amount: -2 },
        ],
      },
    ],
  },
  // ============ Boss：残响牧羊人（两阶段） ============
  {
    id: 'zone1_shepherd',
    name: '残响牧羊人',
    zoneId: 'zone1',
    flavor: '他是第一支远征队的幸存者，但他走错了方向——他选择与蚀雾共生，如今他驱赶着亡魂牲畜，试图阻止任何列车通过平原。',
    hp: 40,
    speed: 2,
    pos: [4],
    bossAdvance: true,
    ai: { pattern: 'cycle' },
    actions: [],
    phases: [
      {
        name: '放牧',
        hpThreshold: 0.5,
        actions: [
          {
            id: 'whip', name: '牧羊人长鞭', icon: '⚔️',
            desc: '对2-3号位造成6-8点伤害，并施加禁锢（本回合无法使用位移牌）',
            effects: [
              { kind: 'damage', target: HERO_POS([2, 3]), amount: [6, 8] },
              { kind: 'applyStatus', target: HERO_POS([2, 3]), status: 'imprison', stacks: 1, duration: 1 },
            ],
          },
          {
            id: 'summon', name: '召唤畜群', icon: '🐕',
            desc: '召唤2只蚀化猎犬（1号位和2号位）',
            cooldown: 2,
            effects: [
              { kind: 'summon', summonId: 'zone1_hound', summonPos: 1 },
              { kind: 'summon', summonId: 'zone1_hound', summonPos: 2 },
            ],
          },
          {
            id: 'devour', name: '蠕虫吞噬', icon: '🪱',
            desc: '推进至2号位时发动：吞噬1号位英雄（累计造成15点伤害可救回）',
            condition: 'atPos2',
            effects: [
              { kind: 'swallow', target: HERO_POS([1]) },
            ],
          },
        ],
      },
      {
        name: '共振',
        hpThreshold: 0,
        passive: [
          { kind: 'madnessGain', target: HERO_ALL, amount: 10 },
          { kind: 'block', target: ENEMY_ALL, amount: 5 },
        ],
        actions: [
          {
            id: 'elegy', name: '蚀雾挽歌', icon: '💀',
            desc: '对全队造成5-7点伤害，并将所有英雄的车厢位置向后推1格',
            effects: [
              { kind: 'damage', target: HERO_ALL, amount: [5, 7] },
              { kind: 'push', target: HERO_ALL },
            ],
          },
          {
            id: 'memory', name: '记忆铁轨', icon: '🎞️',
            desc: '复制上一回合你打出的第一张牌，以同等效果攻击你',
            special: 'memoryRail',
            effects: [],
          },
        ],
      },
    ],
  },
];

// 预设遭遇组合（教学顺序，见怪物设计文档"区域流程建议"）
export const ZONE1_ENCOUNTERS = [
  { id: 'zone1_encounter1', monsters: [{ defId: 'zone1_scarecrow', count: 1 }, { defId: 'zone1_wraith', count: 1 }] },
  { id: 'zone1_encounter2', monsters: [{ defId: 'zone1_hound', count: 2 }, { defId: 'zone1_prowler', count: 1 }] },
  { id: 'zone1_encounter3', monsters: [{ defId: 'zone1_sleeper', count: 1 }, { defId: 'zone1_scarecrow', count: 1 }] },
  { id: 'zone1_encounter4', monsters: [{ defId: 'zone1_prowler', count: 1 }, { defId: 'zone1_wraith', count: 1 }, { defId: 'zone1_scarecrow', count: 1 }] },
];
