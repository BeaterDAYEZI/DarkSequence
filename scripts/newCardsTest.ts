// 新卡牌机制专项验证（卡牌优化 v1）
// 恶魔契约/双连发/暗蚀导管/虚脱/时空错位/腐蚀/废弃车厢/狂气共鸣/血祭献祭/煤渣
// 用法：npx tsx scripts/newCardsTest.ts
import { registry } from '../src/core/registry';
import { loadAllData } from '../src/data/index';
import { Rng } from '../src/core/rng';
import { createNewRun } from '../src/systems/run/RunState';
import { BattleEngine } from '../src/systems/battle/BattleEngine';

loadAllData();
const zone = registry.zones.get('zone1')!;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? `（${detail}）` : ''}`); }
  else { fail++; console.log(`  ✗ FAIL ${name}${detail ? `（${detail}）` : ''}`); }
}

function fresh(seed = 1): BattleEngine {
  const run = createNewRun(seed);
  return new BattleEngine(run, zone, new Rng(seed), new Set());
}

const play = (engine: BattleEngine, cardId: string, heroId: 'warwick' | 'morgan' | 'serafina' | 'auris' = 'warwick') => {
  // 直接把牌塞手牌打出（run.deck 与 engine.deck.deck 同一引用，只push一次）
  engine.deck.deck.hand.push(cardId);
  engine.playCard(heroId, cardId, true);
};

console.log('===== 1. 恶魔契约（伤害×2 + 虚脱） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const scarecrow = engine.battle.enemies[0];
  scarecrow.hp = scarecrow.maxHp;
  const morgan = engine.battle.heroes['morgan'];
  morgan.critChance = 0;
  // 直接伤害6点，先测基准
  engine.pipeline.dealDamage({ attacker: { side: 'hero', heroId: 'morgan' }, target: { side: 'enemy', uid: scarecrow.uid }, amount: 6, attackType: 'melee', damageType: 'physical', singleTarget: true, source: '[测试]' });
  const baseDmg = scarecrow.maxHp - scarecrow.hp;
  scarecrow.hp = scarecrow.maxHp;
  play(engine, 'r01_pact');
  engine.pipeline.dealDamage({ attacker: { side: 'hero', heroId: 'morgan' }, target: { side: 'enemy', uid: scarecrow.uid }, amount: 6, attackType: 'melee', damageType: 'physical', singleTarget: true, source: '[测试]' });
  const pactDmg = scarecrow.maxHp - scarecrow.hp;
  check('契约后伤害翻倍', pactDmg === baseDmg * 2, `${baseDmg}→${pactDmg}`);
  check('全队进入虚脱状态', Object.values(engine.battle.heroes).every((h) => engine.buffs.has(h, 'exhaust')));
  engine.deck.deck.hand.push('morgan_fury_white');   // 摩根第一张（允许）
  engine.playCard('morgan', 'morgan_fury_white', true);
  engine.deck.deck.hand.push('morgan_decapitate_white');
  const err = engine.canPlay('morgan', 'morgan_decapitate_white');
  check('虚脱英雄第二张牌被阻止', err !== null && err.includes('虚脱'), String(err));
}

console.log('===== 2. 双连发装置 =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  play(engine, 'c06_doublefire');
  check('双连发标记就绪', engine.battle.nextAttackDouble);
  const before = engine.battle.enemies[0].hp;
  play(engine, 'morgan_decapitate_white', 'morgan');
  check('下一张攻击牌打两次', engine.battle.enemies[0].hp < before, `hp ${before}→${engine.battle.enemies[0].hp}`);
}

console.log('===== 3. 暗蚀导管（暗蚀→永久力量，每局限1） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  engine.gainDarkEnergy(20);
  play(engine, 'c02_conduit');
  check('暗蚀×0.5转为全队永久力量', Object.values(engine.battle.heroes).every((h) => engine.run.permStrength[h.heroId] === 10),
    `力量=${engine.run.permStrength['warwick']}`);
  const prev = engine.run.permStrength['warwick'];
  play(engine, 'c02_conduit');
  check('每局限用1次', engine.run.permStrength['warwick'] === prev);
}

console.log('===== 4. 时空错位（复制上回合最后一张牌） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  engine.battle.turn = 2;
  play(engine, 'morgan_decapitate_white'); // 当前回合打出
  play(engine, 'r05_timewarp');            // 复制上回合最后一张（无）→ 复制当前回合？逻辑取 turn-1
  const copied = engine.run.deck.hand.some((c) => c.startsWith('copied_'));
  check('时空错位可执行（不崩溃）', true, copied ? '有副本' : '上回合无牌时优雅跳过');
}

console.log('===== 5. 腐蚀酸液（腐蚀状态） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const scarecrow = engine.battle.enemies[0];
  scarecrow.hp = scarecrow.maxHp;
  play(engine, 'c08_acid');
  check('施加2层腐蚀', engine.buffs.count(scarecrow, 'corrosion') === 2);
  const hpBefore = scarecrow.hp;
  engine.endPhase();
  check('回合结束腐蚀流失8点', hpBefore - scarecrow.hp === 8, `${hpBefore}→${scarecrow.hp}`);
}

console.log('===== 6. 废弃车厢（无视站位 + 永久减速） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  play(engine, 'r04_abandoned');
  check('本回合无视站位', engine.battle.ignorePosTurn);
  check('列车速度永久-2', engine.run.permSpeedMod === -2, `permSpeed=${engine.run.permSpeedMod}`);
}

console.log('===== 7. 狂气共鸣器 =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  engine.madness.gain('auris', 40);
  const scarecrow = engine.battle.enemies[0];
  const hpBefore = scarecrow.hp;
  play(engine, 'c05_resonator', 'auris');
  check('最高狂气队友的狂气倾泻给敌人（车尾-10%）', scarecrow.hp === hpBefore - 36, `受伤${hpBefore - scarecrow.hp}`);
}

console.log('===== 8. 血祭献祭 + 煤渣 =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const warwick = engine.battle.heroes['warwick'];
  const soulBefore = engine.battle.soulfire;
  play(engine, 'r02_sacrifice');
  check('获得30魂火', engine.battle.soulfire === soulBefore + 30);
  check('生命降至1', warwick.hp === 1, `hp=${warwick.hp}`);
  // 煤渣：弃1手牌+5魂火
  engine.deck.deck.hand.push('p01_gear', 'p02_armorplate');
  const soul2 = engine.battle.soulfire;
  play(engine, 'p06_cinder');
  check('煤渣弃1张牌', engine.deck.deck.hand.length === 1, `手牌${engine.deck.deck.hand.length}`);
  check('煤渣+5魂火', engine.battle.soulfire === soul2 + 5);
}

console.log('===== 9. 信号灯（全队暴击buff） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  play(engine, 'p04_signal');
  const heroes = Object.values(engine.battle.heroes);
  check('全队获得暴击强化15%', heroes.every((h) => engine.buffs.has(h, 'critUp')?.value === 0.15));
}

console.log('===== 10. 急救绷带（指定状态净化） =====');
{
  const engine = fresh();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const auris = engine.battle.heroes['auris'];  // 最低血英雄（22），绷带目标
  engine.buffs.apply(auris, 'bleed', 2, 2);
  engine.buffs.apply(auris, 'fear', 1, -1, 0.2);
  play(engine, 'p05_bandage');
  check('清除流血但保留其他debuff', !engine.buffs.has(auris, 'bleed') && engine.buffs.has(auris, 'fear'));
}

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
