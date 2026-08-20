// Headless 调试战斗：控制台 runDebugBattle('zone1_encounter1')
// 自动贪心策略跑完整场遭遇，输出回合流水与数值断言
import { registry } from '../core/registry';
import { Rng } from '../core/rng';
import { createNewRun } from '../systems/run/RunState';
import { BattleEngine, type BattleOutcome } from '../systems/battle/BattleEngine';
import type { HeroId } from '../core/types';

/** 贪心自动规划：按站位顺序，每英雄打出能量允许的第一张可打牌 */
export function autoPlan(engine: BattleEngine): { heroId: HeroId; cardId: string }[] {
  const plan: { heroId: HeroId; cardId: string }[] = [];
  let energy = engine.battle.energy;
  const heroes = Object.values(engine.battle.heroes)
    .filter((h) => h.alive)
    .sort((a, b) => a.pos - b.pos);
  for (const h of heroes) {
    if (plan.length >= 4) break;
    const hand = engine.deck.deck.hand;
    const heroCards = hand.filter((c) => registry.cards.get(c)?.heroId === h.heroId);
    const relicCards = hand.filter((c) => !registry.cards.get(c)?.heroId);
    for (const cardId of [...heroCards, ...relicCards]) {
      if (plan.length >= 4) break;
      const card = registry.cards.get(cardId)!;
      const cost = engine.cardCost(h.heroId, card);
      if (cost <= energy && engine.canPlay(h.heroId, cardId) === null) {
        plan.push({ heroId: h.heroId, cardId });
        energy -= cost;
      }
    }
  }
  return plan;
}

export function runDebugBattle(encounterId = 'zone1_encounter1', maxTurns = 60): BattleOutcome {
  const zone = registry.zones.get('zone1');
  if (!zone) throw new Error('区域一数据未加载');
  const encounter = zone.encounters?.find((e) => e.id === encounterId) ?? zone.encounters![0];
  const run = createNewRun(12345);
  const engine = new BattleEngine(run, zone, new Rng(424242), new Set());

  console.log(`\n===== DEBUG战斗开始：${encounter.id}（${encounter.monsters.map((m) => `${m.defId}×${m.count}`).join('、')}）=====`);
  engine.startEncounter(encounter.monsters);

  while (engine.outcome.result === 'ongoing' && engine.battle.turn < maxTurns) {
    engine.beginTurn();
    const plan = autoPlan(engine);
    engine.executePlan(plan);
  }

  const outcome = engine.outcome;
  const heroes = Object.values(engine.battle.heroes);
  console.log(`===== DEBUG战斗结束：${outcome.result}（${outcome.turns}回合）=====`);
  console.log(`英雄状态：${heroes.map((h) => `${engine.heroName(h.heroId)} ${h.hp}/${h.maxHp}${h.alive ? '' : '✝'} 狂气${h.madness}`).join(' | ')}`);
  console.log(`列车：速度${engine.battle.trainSpeed} · 魂火${engine.battle.soulfire} · 暗蚀${engine.battle.darkEnergy}`);
  console.log(`击杀${engine.stats.kills} · 牌库${engine.deck.deck.drawPile.length} 手牌${engine.deck.deck.hand.length} 弃牌${engine.deck.deck.discardPile.length}`);

  // 数值健全性断言
  const checks: [string, boolean][] = [
    ['无NaN血量', heroes.every((h) => !Number.isNaN(h.hp))],
    ['无NaN狂气', heroes.every((h) => !Number.isNaN(h.madness))],
    ['速度在0-5', engine.battle.trainSpeed >= 0 && engine.battle.trainSpeed <= 5],
    ['无幽灵敌人', engine.battle.enemies.every((e) => e.hp <= 0 || e.hp <= e.maxHp)],
    ['战斗在回合上限内结束', outcome.result !== 'ongoing'],
  ];
  let allPass = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗ FAIL'} ${name}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? '✅ 数值健全性检查通过' : '❌ 数值健全性检查失败');
  return outcome;
}

declare global {
  interface Window {
    runDebugBattle: typeof runDebugBattle;
    autoPlan: typeof autoPlan;
  }
}
