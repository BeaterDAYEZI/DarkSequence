// 单局状态：RunState 工厂与英雄实例创建
import type { HeroId, HeroInstance, RunState } from '../../core/types';
import { registry } from '../../core/registry';
import { Rng } from '../../core/rng';
import { STARTING_DECKS, STARTING_RELIC_BONUS, type DeckChoice } from '../../data/startingDecks';

export const RUN_VERSION = '0.1';

/** 初始能量上限 */
export const BASE_ENERGY_MAX = 3;

/** 起始遗物牌（卡牌优化v1：P-01锈蚀齿轮 + P-02蚀铁护甲片） */
export const STARTING_RELIC_CARDS = STARTING_RELIC_BONUS;

export function createHeroInstance(heroId: HeroId, baseHp: number): HeroInstance {
  return {
    heroId,
    hp: baseHp,
    maxHp: baseHp,
    pos: registry.heroes.get(heroId)?.defaultCarriage ?? 1,
    block: 0,
    madness: 0,
    statuses: [],
    awakeningTurns: 0,
    alive: true,
    runaway: false,
    critChance: 0.05,
    runCritBonus: 0,
    obsessionCount: 0,
    infused: {},
    hasRevenge: false,
  };
}

/** 新开一局（可指定每英雄的A/B起始卡组，默认A套） */
export function createNewRun(seed: number, deckChoices?: Record<HeroId, DeckChoice>): RunState {
  const rng = new Rng(seed);
  const heroIds: HeroId[] = ['warwick', 'morgan', 'serafina', 'auris'];
  const heroes = {} as Record<HeroId, HeroInstance>;
  for (const id of heroIds) {
    heroes[id] = createHeroInstance(id, registry.heroes.get(id)!.baseHp);
  }

  // 起始牌库：每英雄所选卡组（5张×4） + 2张泛用遗物，洗牌
  const drawPile: string[] = [];
  for (const id of heroIds) {
    const choice = deckChoices?.[id] ?? 'A';
    drawPile.push(...(STARTING_DECKS[id][choice] ?? STARTING_DECKS[id].A));
  }
  drawPile.push(...STARTING_RELIC_CARDS);
  rng.shuffle(drawPile);

  return {
    version: RUN_VERSION,
    seed,
    zoneIndex: 0,
    map: [],
    currentNodeId: 'start',
    deck: { drawPile, hand: [], discardPile: [], resting: { warwick: [], morgan: [], serafina: [], auris: [] } },
    customCards: {},
    permStrength: { warwick: 0, morgan: 0, serafina: 0, auris: 0 },
    permSpeedMod: 0,
    usedLimitCards: [],
    heroes,
    resources: { shards: 0, etchant: 0, obsession: 0, soulfire: 0, darkIron: 0 },
    techUnlocked: [],
    energyMax: BASE_ENERGY_MAX,
    forkMemory: {},
    avatarForm: false,
    stats: { kills: 0, damage: 0, turns: 0 },
    flags: {},
  };
}
