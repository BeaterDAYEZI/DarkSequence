// 单局状态：RunState 工厂与英雄实例创建
import type { HeroId, HeroInstance, RunState } from '../../core/types';
import { registry } from '../../core/registry';
import { Rng } from '../../core/rng';

export const RUN_VERSION = '0.1';

/** 初始能量上限 */
export const BASE_ENERGY_MAX = 3;

/** 每英雄起始牌库 = 5张白色专属牌 */
export function startingHeroCards(heroId: HeroId): string[] {
  return [...registry.cards.values()]
    .filter((c) => c.heroId === heroId && c.rarity === 'white')
    .map((c) => c.id);
}

/** 起始遗物牌 */
export const STARTING_RELIC_CARDS = ['relic_railpatrol', 'relic_rustwrench'];

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

/** 新开一局 */
export function createNewRun(seed: number): RunState {
  const rng = new Rng(seed);
  const heroIds: HeroId[] = ['warwick', 'morgan', 'serafina', 'auris'];
  const heroes = {} as Record<HeroId, HeroInstance>;
  for (const id of heroIds) {
    heroes[id] = createHeroInstance(id, registry.heroes.get(id)!.baseHp);
  }

  // 起始牌库：20张白色专属 + 2张白色遗物，洗牌
  const drawPile: string[] = [];
  for (const id of heroIds) drawPile.push(...startingHeroCards(id));
  drawPile.push(...STARTING_RELIC_CARDS);
  rng.shuffle(drawPile);

  return {
    version: RUN_VERSION,
    seed,
    zoneIndex: 0,
    map: [],
    currentNodeId: 'start',
    deck: { drawPile, hand: [], discardPile: [], resting: { warwick: [], morgan: [], serafina: [], auris: [] } },
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
