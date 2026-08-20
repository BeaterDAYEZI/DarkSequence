// 四英雄专属卡牌：4英雄 × 5谱系 × 4品质 = 80张（逐张抄录策划案数值）
import type { CardDef, EffectSpec, HeroId, Rarity, TargetSelector } from '../core/types';

// ---------- 目标快捷构造 ----------
const EPOS = (pos: number[]): TargetSelector => ({ side: 'enemy', mode: 'pos', pos });
const EALL: TargetSelector = { side: 'enemy', mode: 'all' };
const EFRONT: TargetSelector = { side: 'enemy', mode: 'front' };
const ERANDOM: TargetSelector = { side: 'enemy', mode: 'random', count: 1 };
const ALLY_ALL: TargetSelector = { side: 'ally', mode: 'all' };
const ALLY_LOWEST: TargetSelector = { side: 'ally', mode: 'lowestHpAlly' };
const SELF: TargetSelector = { side: 'ally', mode: 'self' };

interface RaritySpec {
  rarity: Rarity;
  cost: number;
  effects: EffectSpec[];
  tags?: string[];
}

function mkCards(hero: HeroId, base: string, name: string, specs: RaritySpec[], flavor?: string): CardDef[] {
  return specs.map((s) => ({
    id: `${base}_${s.rarity}`,
    lineageId: base,
    name,
    flavor,
    heroId: hero,
    kind: 'hero' as const,
    rarity: s.rarity,
    cost: s.cost,
    tags: s.tags ?? [],
    effects: s.effects,
  }));
}

// ============================================================
// 一、沃里克 · 守夜人（坦克/保护者）
// ============================================================
const warwickCards: CardDef[] = [
  // ---- 壁垒之盾 ----
  ...mkCards('warwick', 'warwick_wall', '壁垒之盾', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'block', target: SELF, amount: 8 }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'block', target: SELF, amount: 10 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'block', target: SELF, amount: 12 }, { kind: 'heal', target: SELF, amount: 2 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'block', target: SELF, amount: 15 }, { kind: 'applyStatus', target: SELF, status: 'guard', stacks: 1, duration: 1 }] },
  ], '盾面上刻满了他没能守住的名字。'),
  // ---- 蚀铁锤击 ----
  ...mkCards('warwick', 'warwick_hammer', '蚀铁锤击', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'damage', target: EPOS([1]), amount: [4, 6] }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'damage', target: EPOS([1]), amount: [6, 8] }] },
    { rarity: 'blue', cost: 3, effects: [{ kind: 'damage', target: EPOS([1]), amount: [8, 10] }, { kind: 'applyStatus', target: EPOS([1]), status: 'vulnerable', stacks: 1, duration: -1 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'damage', target: EPOS([1]), amount: [10, 12] }, { kind: 'applyStatus', target: EPOS([1]), status: 'stun', stacks: 1, duration: 1, condition: 'speedGE3' }] },
  ], '一锤下去，铁轨都会记住这次的震动。'),
  // ---- 嘲讽咆哮 ----
  ...mkCards('warwick', 'warwick_taunt', '嘲讽咆哮', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'taunt', duration: 1 }, { kind: 'madnessGain', target: SELF, amount: 5 }] },
    { rarity: 'green', cost: 1, effects: [{ kind: 'taunt', duration: 1 }, { kind: 'madnessGain', target: SELF, amount: 8 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'taunt', duration: 1 }, { kind: 'block', target: ALLY_ALL, amount: 3 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'taunt', duration: 2, value: 2 }] },
  ], '他朝蚀雾咆哮，蚀雾回以沉默——然后扑了上来。'),
  // ---- 列车冲锋 ----
  ...mkCards('warwick', 'warwick_charge', '列车冲锋', [
    { rarity: 'white', cost: 1, tags: ['speed'], effects: [{ kind: 'speed', amount: 1 }, { kind: 'damage', target: EPOS([1]), amount: 3 }] },
    { rarity: 'green', cost: 2, tags: ['speed'], effects: [{ kind: 'speed', amount: 2 }, { kind: 'damage', target: EPOS([1]), amount: 5 }] },
    { rarity: 'blue', cost: 2, tags: ['speed'], effects: [{ kind: 'speed', amount: 2 }, { kind: 'damage', target: EPOS([1]), amount: 7 }, { kind: 'block', target: SELF, amount: 3 }] },
    { rarity: 'orange', cost: 3, tags: ['speed', 'displace'], effects: [{ kind: 'speed', amount: 3 }, { kind: 'damage', target: EPOS([1]), amount: 9 }, { kind: 'push', target: EALL }] },
  ], '列车碾过一切挡路的东西，包括敌人。'),
  // ---- 残喘之躯 ----
  ...mkCards('warwick', 'warwick_gasp', '残喘之躯', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'damage', target: SELF, amount: 5, pierceBlock: true }, { kind: 'block', target: SELF, amount: 10 }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'damage', target: SELF, amount: 5, pierceBlock: true }, { kind: 'block', target: SELF, amount: 13 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'damage', target: SELF, amount: 3, pierceBlock: true }, { kind: 'block', target: SELF, amount: 16 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'damage', target: SELF, amount: 3, pierceBlock: true }, { kind: 'block', target: SELF, amount: 20 }, { kind: 'clearStatus', target: SELF }] },
  ], '活着本身就是一种消耗，但他早就习惯了。'),
];

// ============================================================
// 二、摩根 · 行刑者（近战爆发/收割者）
// ============================================================
const morganCards: CardDef[] = [
  // ---- 断首斩 ----
  ...mkCards('morgan', 'morgan_decapitate', '断首斩', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [6, 9] }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [8, 11] }] },
    { rarity: 'blue', cost: 3, effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [10, 13], hpBelow50Bonus: 0.3 }] },
    { rarity: 'orange', cost: 4, effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [14, 18], onKillExtra: true }] },
  ], '刀落之处，头颅与悔恨一起滚进蚀雾。'),
  // ---- 血腥狂怒 ----
  ...mkCards('morgan', 'morgan_fury', '血腥狂怒', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'applyStatus', target: SELF, status: 'strength', stacks: 3, duration: 2 }, { kind: 'madnessGain', target: SELF, amount: 5 }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'applyStatus', target: SELF, status: 'strength', stacks: 4, duration: 2 }, { kind: 'madnessGain', target: SELF, amount: 8 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'applyStatus', target: SELF, status: 'strength', stacks: 5, duration: 2 }, { kind: 'madnessGain', target: SELF, amount: 10 }, { kind: 'draw', amount: 1 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'applyStatus', target: SELF, status: 'strength', stacks: 6, duration: 2 }, { kind: 'madnessGain', target: SELF, amount: 15 }, { kind: 'draw', amount: 1 }, { kind: 'critGain', amount: 0.2, critScope: 'battle', duration: 1 }] },
  ], '血让刀更快，刀让血更多。'),
  // ---- 链钩突进 ----
  ...mkCards('morgan', 'morgan_hook', '链钩突进', [
    { rarity: 'white', cost: 1, tags: ['speed', 'displace'], effects: [{ kind: 'speed', amount: 1 }, { kind: 'pull', target: EPOS([3]) }] },
    { rarity: 'green', cost: 2, tags: ['speed', 'displace'], effects: [{ kind: 'speed', amount: 2 }, { kind: 'pull', target: EPOS([3]) }, { kind: 'applyStatus', target: SELF, status: 'strength', stacks: 3, duration: 2 }] },
    { rarity: 'blue', cost: 2, tags: ['speed', 'displace'], effects: [{ kind: 'speed', amount: 2 }, { kind: 'pull', target: EPOS([3]) }, { kind: 'applyStatus', target: EPOS([1]), status: 'vulnerable', stacks: 1, duration: -1 }] },
    { rarity: 'orange', cost: 3, tags: ['speed', 'displace'], effects: [{ kind: 'speed', amount: 3 }, { kind: 'pull', target: EPOS([3]) }, { kind: 'applyStatus', target: EPOS([1]), status: 'vulnerable', stacks: 2, duration: -1 }, { kind: 'applyStatus', target: SELF, status: 'critUp', stacks: 1, duration: 1, valuePerSpeed: 0.03 }] },
  ], '锁链的另一头，拴着他最想砍的东西。'),
  // ---- 刽子手凝视 ----
  ...mkCards('morgan', 'morgan_gaze', '刽子手凝视', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'fear', stacks: 1, duration: -1, value: 0.2 }] },
    { rarity: 'green', cost: 1, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'fear', stacks: 2, duration: -1, value: 0.2 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'fear', stacks: 1, duration: -1, value: 0.2 }, { kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: -1 }] },
    { rarity: 'orange', cost: 2, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'fear', stacks: 1, duration: 3, value: 0.2 }, { kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: 3, value: 2 }] },
  ], '被行刑者盯上的人，脖子上会先感到凉意。'),
  // ---- 血祭狂欢 ----
  ...mkCards('morgan', 'morgan_carnival', '血祭狂欢', [
    { rarity: 'white', cost: 1, tags: ['aoe'], effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [3, 5], plusPerDark: 1 }] },
    { rarity: 'green', cost: 2, tags: ['aoe'], effects: [{ kind: 'damage', target: EPOS([1, 2]), amount: [4, 6], plusPerDark: 1.5 }] },
    { rarity: 'blue', cost: 3, tags: ['aoe'], effects: [{ kind: 'damage', target: EPOS([1, 2, 3]), amount: [5, 7], plusPerDark: 2 }] },
    { rarity: 'orange', cost: 4, tags: ['aoe'], effects: [{ kind: 'damage', target: EALL, amount: [6, 9], plusPerDark: 3, consumeDark: true }] },
  ], '暗蚀能量灌满刀锋的那一刻，就是狂欢的开始。'),
];

// ============================================================
// 三、塞拉芬娜 · 鸣钟者（治疗/狂气调控师）
// ============================================================
const serafinaCards: CardDef[] = [
  // ---- 治愈钟鸣 ----
  ...mkCards('serafina', 'serafina_healbell', '治愈钟鸣', [
    { rarity: 'white', cost: 1, tags: ['heal'], effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: [6, 8] }] },
    { rarity: 'green', cost: 2, tags: ['heal'], effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: [8, 10] }] },
    { rarity: 'blue', cost: 2, tags: ['heal'], effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: [10, 12] }, { kind: 'clearStatus', target: ALLY_LOWEST, stacks: 1 }] },
    { rarity: 'orange', cost: 3, tags: ['heal'], effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: [14, 18] }, { kind: 'clearStatus', target: ALLY_LOWEST }, { kind: 'madnessClear', target: ALLY_LOWEST, amount: 10 }] },
  ], '钟声落下，伤口像被时间轻轻抚平。'),
  // ---- 护佑圣歌 ----
  ...mkCards('serafina', 'serafina_hymn', '护佑圣歌', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'block', target: ALLY_ALL, amount: 4 }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'block', target: ALLY_ALL, amount: 6 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'block', target: ALLY_ALL, amount: 8 }, { kind: 'applyStatus', target: ALLY_ALL, status: 'tenacity', stacks: 1, duration: -1 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'block', target: ALLY_ALL, amount: 10 }, { kind: 'applyStatus', target: ALLY_ALL, status: 'tenacity', stacks: 2, duration: -1 }, { kind: 'speed', amount: 1 }] },
  ], '圣歌响起，连蚀雾都暂时不敢靠近车厢。'),
  // ---- 赎罪之铃 ----
  ...mkCards('serafina', 'serafina_atonement', '赎罪之铃', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'damage', target: EPOS([4]), amount: [3, 5] }, { kind: 'applyStatus', target: EPOS([4]), status: 'healReduction', stacks: 1, duration: -1, value: 0.5 }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'damage', target: EPOS([4]), amount: [5, 7] }, { kind: 'applyStatus', target: EPOS([4]), status: 'healReduction', stacks: 1, duration: -1, value: 0.75 }] },
    { rarity: 'blue', cost: 3, effects: [{ kind: 'damage', target: EPOS([4]), amount: [6, 8] }, { kind: 'applyStatus', target: EPOS([4]), status: 'healReduction', stacks: 1, duration: -1, value: 1 }, { kind: 'soulfireSteal', amount: 5 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'damage', target: EPOS([4]), amount: [8, 10] }, { kind: 'applyStatus', target: EPOS([4]), status: 'healReduction', stacks: 1, duration: -1, value: 1 }, { kind: 'soulfireSteal', amount: 10 }, { kind: 'shufflePos', target: EALL }] },
  ], '这口钟原本只为亡者而鸣，现在也为敌人而鸣。'),
  // ---- 安魂弥撒 ----
  ...mkCards('serafina', 'serafina_requiem', '安魂弥撒', [
    { rarity: 'white', cost: 1, tags: ['madness'], effects: [{ kind: 'madnessTransfer', amount: 5 }] },
    { rarity: 'green', cost: 2, tags: ['madness'], effects: [{ kind: 'madnessTransfer', amount: 8 }, { kind: 'heal', target: SELF, amount: 3 }] },
    { rarity: 'blue', cost: 2, tags: ['madness'], effects: [{ kind: 'madnessTransfer', amount: 10 }, { kind: 'heal', target: ALLY_ALL, amount: 5 }] },
    { rarity: 'orange', cost: 3, tags: ['madness'], effects: [{ kind: 'madnessTransfer', amount: 15, drawIfEmpty: 2 }, { kind: 'heal', target: ALLY_ALL, amount: 8 }] },
  ], '她把疯狂装进钟里，敲给敌人听。'),
  // ---- 毁灭之钟 ----
  ...mkCards('serafina', 'serafina_doombell', '毁灭之钟', [
    { rarity: 'white', cost: 1, tags: ['aoe', 'madness'], effects: [{ kind: 'damage', target: EALL, amount: [2, 4] }, { kind: 'madnessGain', target: SELF, amount: 5 }] },
    { rarity: 'green', cost: 2, tags: ['aoe', 'madness'], effects: [{ kind: 'damage', target: EALL, amount: [3, 5] }, { kind: 'madnessGain', target: SELF, amount: 8 }] },
    { rarity: 'blue', cost: 3, tags: ['aoe', 'madness'], effects: [{ kind: 'damage', target: EALL, amount: [5, 7], selfMadnessAbove50Mult: 1 }, { kind: 'madnessGain', target: SELF, amount: 10 }] },
    { rarity: 'orange', cost: 4, tags: ['aoe', 'madness'], effects: [{ kind: 'damage', target: EALL, amount: [7, 10] }, { kind: 'madnessGain', target: SELF, amount: 15, replayIfAwakened: true }] },
  ], '这口钟响起的时候，世界只剩下耳鸣。'),
];

// ============================================================
// 四、奥瑞斯 · 观星者（远程法术/连锁启动器）
// ============================================================
const aurisCards: CardDef[] = [
  // ---- 暗蚀射击 ----
  ...mkCards('auris', 'auris_darkshot', '暗蚀射击', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'damage', target: EPOS([3, 4]), amount: [5, 8] }] },
    { rarity: 'green', cost: 2, effects: [{ kind: 'damage', target: EPOS([3, 4]), amount: [7, 10] }] },
    { rarity: 'blue', cost: 3, effects: [{ kind: 'damage', target: EPOS([3, 4]), amount: [9, 12], overkillMult: 2 }] },
    { rarity: 'orange', cost: 4, effects: [{ kind: 'damage', target: EPOS([3, 4]), amount: [12, 16], allToDarkMult: 1.5 }] },
  ], '星辰坠落的方向，就是蚀雾最稀薄的地方。'),
  // ---- 蚀刻标记 ----
  ...mkCards('auris', 'auris_etch', '蚀刻标记', [
    { rarity: 'white', cost: 1, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: 1 }] },
    { rarity: 'green', cost: 1, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: 1 }, { kind: 'applyStatus', target: EFRONT, status: 'vulnerable', stacks: 1, duration: -1 }] },
    { rarity: 'blue', cost: 2, effects: [{ kind: 'applyStatus', target: EFRONT, status: 'mark', stacks: 1, duration: 2 }, { kind: 'applyStatus', target: EFRONT, status: 'vulnerable', stacks: 2, duration: -1 }] },
    { rarity: 'orange', cost: 3, effects: [{ kind: 'applyStatus', target: EALL, status: 'mark', stacks: 1, duration: 2, value: 1 }] },
  ], '他在敌人的灵魂上刻下星座，以便群星瞄准。'),
  // ---- 相位转移 ----
  ...mkCards('auris', 'auris_phase', '相位转移', [
    { rarity: 'white', cost: 1, tags: ['speed'], effects: [{ kind: 'speed', amount: -1 }, { kind: 'applyStatus', target: SELF, status: 'dodge', stacks: 1, duration: -1, value: 1 }] },
    { rarity: 'green', cost: 1, tags: ['speed'], effects: [{ kind: 'speed', amount: -1 }, { kind: 'applyStatus', target: SELF, status: 'dodge', stacks: 1, duration: -1, value: 1 }, { kind: 'heal', target: SELF, amount: 2 }] },
    { rarity: 'blue', cost: 2, tags: ['speed'], effects: [{ kind: 'speed', amount: -2 }, { kind: 'applyStatus', target: SELF, status: 'dodge', stacks: 1, duration: -1, value: 1 }, { kind: 'draw', amount: 1 }] },
    { rarity: 'orange', cost: 3, tags: ['speed'], effects: [{ kind: 'speed', amount: -2, clearMadnessIfSpeedZero: true }, { kind: 'applyStatus', target: SELF, status: 'dodge', stacks: 2, duration: -1, value: 1 }] },
  ], '他让列车后退一步，自己就离星辰更近一步。'),
  // ---- 群星陨落 ----
  ...mkCards('auris', 'auris_starfall', '群星陨落', [
    { rarity: 'white', cost: 1, tags: ['aoe'], effects: [{ kind: 'damage', target: ERANDOM, amount: 3, times: 3 }] },
    { rarity: 'green', cost: 2, tags: ['aoe'], effects: [{ kind: 'damage', target: ERANDOM, amount: 3, times: 4 }] },
    { rarity: 'blue', cost: 3, tags: ['aoe'], effects: [{ kind: 'damage', target: ERANDOM, amount: 4, times: 4, critMult: 2 }] },
    { rarity: 'orange', cost: 4, tags: ['aoe'], effects: [{ kind: 'damage', target: ERANDOM, amount: 5, times: 5, reduceBlockPerHit: 1, lastHitCrit: true }] },
  ], '蚀雾之上，星星们排成了审判的队列。'),
  // ---- 禁忌知识 ----
  ...mkCards('auris', 'auris_forbidden', '禁忌知识', [
    { rarity: 'white', cost: 1, tags: ['draw', 'madness'], effects: [{ kind: 'draw', amount: 2 }, { kind: 'madnessGain', target: SELF, amount: 15 }] },
    { rarity: 'green', cost: 2, tags: ['draw', 'madness'], effects: [{ kind: 'draw', amount: 2 }, { kind: 'madnessGain', target: SELF, amount: 12 }] },
    { rarity: 'blue', cost: 2, tags: ['draw', 'madness'], effects: [{ kind: 'draw', amount: 3 }, { kind: 'madnessGain', target: SELF, amount: 15 }, { kind: 'critGain', amount: 0.03, critScope: 'battle', duration: -1 }] },
    { rarity: 'orange', cost: 3, tags: ['draw', 'madness'], effects: [{ kind: 'draw', amount: 3 }, { kind: 'madnessGain', target: SELF, amount: 20 }, { kind: 'critGain', amount: 0.02, critScope: 'run' }] },
  ], '知道的越多，越无法假装自己还清醒。'),
];

export const HERO_CARDS: CardDef[] = [
  ...warwickCards,
  ...morganCards,
  ...serafinaCards,
  ...aurisCards,
];
