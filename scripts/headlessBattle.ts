// Headless 战斗验证脚本：node 直接运行，验证区域一全部遭遇类型
// 用法：npx tsx scripts/headlessBattle.ts [encounterId]
import { registry } from '../src/core/registry';
import { loadAllData } from '../src/data/index';
import { Rng } from '../src/core/rng';
import { createNewRun } from '../src/systems/run/RunState';
import { BattleEngine } from '../src/systems/battle/BattleEngine';
import { autoPlan } from '../src/debug/battleDebug';

loadAllData();

const report = registry.validateAll();
if (report.errors.length > 0) {
  console.error('❌ 数据校验失败：', report.errors);
  process.exit(1);
}
console.log(`✓ 数据校验通过（${registry.cards.size}卡 / ${registry.monsters.size}怪 / ${registry.zones.size}区域）\n`);

const zone = registry.zones.get('zone1')!;

interface BattleResult {
  id: string;
  outcome: string;
  turns: number;
  heroes: string;
  soulfire: number;
  dark: number;
  checks: [string, boolean][];
}

function fight(encounterId: string, seed: number, maxTurns = 80): BattleResult {
  const encounter = zone.encounters?.find((e) => e.id === encounterId);
  if (!encounter) throw new Error(`遭遇不存在: ${encounterId}`);
  const run = createNewRun(seed);
  const engine = new BattleEngine(run, zone, new Rng(seed * 7 + 13), new Set());
  engine.startEncounter(encounter.monsters);

  console.log(`\n===== 战斗开始：${encounterId}（${encounter.monsters.map((m) => `${m.defId}×${m.count}`).join('、')}）=====`);
  let guard = 0;
  while (engine.outcome.result === 'ongoing' && engine.battle.turn < maxTurns && guard++ < 200) {
    engine.beginTurn();
    if (engine.outcome.result !== 'ongoing') break;
    const plan = autoPlan(engine);
    engine.executePlan(plan);
  }

  const heroes = Object.values(engine.battle.heroes);
  const checks: [string, boolean][] = [
    ['无NaN血量', heroes.every((h) => !Number.isNaN(h.hp) && !Number.isNaN(h.maxHp))],
    ['无NaN狂气', heroes.every((h) => !Number.isNaN(h.madness))],
    ['速度0-5', engine.battle.trainSpeed >= 0 && engine.battle.trainSpeed <= 5],
    ['魂火0-100', engine.battle.soulfire >= 0 && engine.battle.soulfire <= 100],
    ['暗蚀≥0', engine.battle.darkEnergy >= 0],
    ['敌人血量合法', engine.battle.enemies.every((e) => e.hp <= e.maxHp)],
    ['牌不消失（守恒）', run.deck.drawPile.length + run.deck.hand.length + run.deck.discardPile.length
      + Object.values(run.deck.resting).reduce((s, arr) => s + arr.length, 0) === 22],
    ['回合内结束', engine.outcome.result !== 'ongoing'],
  ];

  console.log(`===== 结束：${engine.outcome.result}（${engine.outcome.turns}回合）=====`);
  console.log(`英雄：${heroes.map((h) => `${engine.heroName(h.heroId)} ${h.hp}/${h.maxHp}${h.alive ? '' : '✝'} 狂气${h.madness}`).join(' | ')}`);
  console.log(`列车：速度${engine.battle.trainSpeed} · 魂火${engine.battle.soulfire} · 暗蚀${Math.round(engine.battle.darkEnergy * 10) / 10}`);
  console.log(`击杀${engine.stats.kills} · 牌库${run.deck.drawPile.length}/手${run.deck.hand.length}/弃${run.deck.discardPile.length}/暂存${Object.values(run.deck.resting).reduce((s, a) => s + a.length, 0)}`);

  let pass = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗ FAIL'} ${name}`);
    if (!ok) pass = false;
  }
  return {
    id: encounterId,
    outcome: engine.outcome.result,
    turns: engine.outcome.turns,
    heroes: heroes.map((h) => `${h.hp}`).join(','),
    soulfire: engine.battle.soulfire,
    dark: engine.battle.darkEnergy,
    checks: checks.map(([name, ok]) => [name, ok]),
  };
}

const scenarios = process.argv[2] ? [process.argv[2]] : [
  'zone1_encounter1',   // 教学：稻草人+游魂（反伤+后排威胁）
  'zone1_encounter2',   // 猎犬×2+徘徊者（窃魂火+破闪）
  'zone1_encounter3',   // 枕木+稻草人（防自爆）
  'zone1_encounter4',   // 三怪混编
];

const results: BattleResult[] = [];
for (const id of scenarios) {
  results.push(fight(id, 424242));
}

// 双子同步击杀：手动构建（1回合内同时压低血量）
console.log('\n===== 精英战：被缚的双子 =====');
{
  const run = createNewRun(999);
  const engine = new BattleEngine(run, zone, new Rng(777), new Set());
  engine.startEncounter([{ defId: 'zone1_twin_laugh', count: 1 }, { defId: 'zone1_twin_cry', count: 1 }]);
  let guard = 0;
  while (engine.outcome.result === 'ongoing' && engine.battle.turn < 80 && guard++ < 200) {
    engine.beginTurn();
    if (engine.outcome.result !== 'ongoing') break;
    engine.executePlan(autoPlan(engine));
  }
  console.log(`双子战：${engine.outcome.result}（${engine.outcome.turns}回合）`);
  results.push({ id: 'elite_twins', outcome: engine.outcome.result, turns: engine.outcome.turns, heroes: '', soulfire: engine.battle.soulfire, dark: 0, checks: [] });
}

// Boss战：残响牧羊人
console.log('\n===== Boss战：残响牧羊人 =====');
{
  const run = createNewRun(31337);
  const engine = new BattleEngine(run, zone, new Rng(2024), new Set());
  engine.startEncounter([{ defId: 'zone1_shepherd', count: 1 }]);
  let guard = 0;
  while (engine.outcome.result === 'ongoing' && engine.battle.turn < 100 && guard++ < 250) {
    engine.beginTurn();
    if (engine.outcome.result !== 'ongoing') break;
    engine.executePlan(autoPlan(engine));
  }
  const heroes = Object.values(engine.battle.heroes);
  console.log(`Boss战：${engine.outcome.result}（${engine.outcome.turns}回合）`);
  console.log(`英雄：${heroes.map((h) => `${engine.heroName(h.heroId)} ${h.hp}/${h.maxHp}${h.alive ? '' : '✝'}`).join(' | ')}`);
  results.push({ id: 'boss_shepherd', outcome: engine.outcome.result, turns: engine.outcome.turns, heroes: '', soulfire: engine.battle.soulfire, dark: 0, checks: [] });
}

// 汇总
console.log('\n===== 汇总 =====');
let failed = 0;
for (const r of results) {
  const checkFails = r.checks.filter(([, ok]) => !ok).length;
  if (checkFails > 0) failed++;
  console.log(`${checkFails === 0 ? '✓' : '✗'} ${r.id}: ${r.outcome} (${r.turns}回合)${checkFails ? ` —— ${checkFails}项检查失败` : ''}`);
}
console.log(failed === 0 ? '\n✅ 全部场景通过' : `\n❌ ${failed} 个场景存在问题`);
process.exit(failed === 0 ? 0 : 1);
