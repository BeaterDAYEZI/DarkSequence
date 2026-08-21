// 机制聚焦验证：直接驱动引擎断言每个核心机制
// 用法：npx tsx scripts/mechanicChecks.ts
import { registry } from '../src/core/registry';
import { loadAllData } from '../src/data/index';
import { Rng } from '../src/core/rng';
import { createNewRun } from '../src/systems/run/RunState';
import { BattleEngine } from '../src/systems/battle/BattleEngine';

loadAllData();
const zone = registry.zones.get('zone1')!;

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${name}${detail ? `（${detail}）` : ''}`);
  } else {
    failCount++;
    console.log(`  ✗ FAIL ${name}${detail ? `（${detail}）` : ''}`);
  }
}

function freshEngine(seed = 1): BattleEngine {
  const run = createNewRun(seed);
  return new BattleEngine(run, zone, new Rng(seed), new Set());
}

console.log('===== 1. 狂气：觉醒与暴走 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const hero = engine.battle.heroes['serafina'];
  engine.madness.gain('serafina', 100);
  check('狂气达到100立即觉醒', hero.awakeningTurns === 2 && engine.buffs.has(hero, 'awakened') !== undefined,
    `觉醒剩余${hero.awakeningTurns}回合`);
  check('觉醒后狂气清零', hero.madness === 0);
  engine.madness.gain('serafina', 100);
  check('觉醒中再满100触发暴走', hero.runaway && hero.awakeningTurns === 0 && !engine.buffs.has(hero, 'awakened'));
  check('暴走承受20点真实伤害', hero.hp === hero.maxHp - 20, `hp=${hero.hp}`);
}

console.log('===== 2. 列车速度与车厢轮转 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_scarecrow', count: 1 }]);
  const before = Object.values(engine.battle.heroes).map((h) => h.pos).join('');
  engine.train.changeSpeed(1);
  const after = Object.values(engine.battle.heroes).map((h) => h.pos).join('');
  check('加速后英雄整体前进（1→4轮转）', before === '1234' && after === '4123', `${before} → ${after}`);
  engine.train.changeSpeed(-1);
  const back = Object.values(engine.battle.heroes).map((h) => h.pos).join('');
  check('减速后英雄整体后退', back === '1234', back);
}

console.log('===== 3. 溢伤连锁：暗蚀能量与魂火 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_hound', count: 1 }]);
  const hound = engine.battle.enemies[0];
  hound.hp = 1;
  const darkBefore = engine.battle.darkEnergy;
  const soulBefore = engine.battle.soulfire;
  engine.pipeline.dealDamage({
    attacker: { side: 'hero', heroId: 'morgan' },
    target: { side: 'enemy', uid: hound.uid },
    amount: 20,
    attackType: 'melee',
    damageType: 'physical',
    singleTarget: true,
    source: '[测试]',
  });
  check('溢出伤害转化为暗蚀能量', engine.battle.darkEnergy >= darkBefore + 19,
    `暗蚀+${engine.battle.darkEnergy - darkBefore}`);
  check('溢伤10%转化为魂火', engine.battle.soulfire >= soulBefore + 1,
    `魂火+${engine.battle.soulfire - soulBefore}`);
  check('目标死亡', hound.hp <= 0);
}

console.log('===== 4. 枕木自爆与魂火清空 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_sleeper', count: 1 }]);
  const sleeper = engine.battle.enemies[0];
  engine.gainSoulfire(30);
  const heroHpBefore = Object.values(engine.battle.heroes).reduce((s, h) => s + h.hp, 0);
  sleeper.hp = Math.floor(sleeper.maxHp * 0.3);
  engine.endPhase();
  check('低于30%血量触发自爆', sleeper.hp <= 0, `hp=${sleeper.hp}`);
  check('自爆对全队造成伤害', Object.values(engine.battle.heroes).reduce((s, h) => s + h.hp, 0) < heroHpBefore);
  check('自爆清空魂火', engine.battle.soulfire === 0);
}

console.log('===== 5. Boss推进与脱轨团灭 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_shepherd', count: 1 }]);
  const boss = engine.battle.enemies[0];
  check('Boss从4号位（车尾）出发', boss.pos === 4, `pos=${boss.pos}`);
  engine.endPhase();
  check('回合结束Boss推进1格', boss.pos === 3, `pos=${boss.pos}`);
  engine.endPhase();
  engine.endPhase();
  check('抵达1号位触发脱轨败北', engine.outcome.result === 'defeat', `pos=${boss.pos}, 结果=${engine.outcome.result}`);
}

console.log('===== 6. 嘲讽重定向与援护 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_wraith', count: 1 }]);
  const warwick = engine.battle.heroes['warwick'];
  const auris = engine.battle.heroes['auris'];
  engine.buffs.apply(warwick, 'taunt', 1, 1);
  const aurisHp = auris.hp;
  // 游魂哀嚎穿刺（随机目标）应被嘲讽重定向到沃里克
  const wraith = engine.battle.enemies[0];
  const wailAction = registry.monsters.get('zone1_wraith')!.actions[0];
  engine.resolver.resolve(wailAction.effects, { source: { side: 'enemy', enemyUid: wraith.uid } });
  check('嘲讽将单体攻击重定向到沃里克', auris.hp === aurisHp && warwick.hp < warwick.maxHp,
    `奥瑞斯血量${auris.hp}/${aurisHp}`);
}

console.log('===== 7. 蠕虫吞噬与救回 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_shepherd', count: 1 }]);
  const warwick = engine.battle.heroes['warwick'];
  engine.swallowFrontHero();
  check('1号位英雄被吞噬', engine.battle.swallow?.heroId === 'warwick' && engine.buffs.has(warwick, 'swallowed') !== undefined);
  // 对Boss造成累计15伤害
  const boss = engine.battle.enemies[0];
  engine.pipeline.dealDamage({
    attacker: { side: 'hero', heroId: 'morgan' },
    target: { side: 'enemy', uid: boss.uid },
    amount: 15,
    attackType: 'melee',
    damageType: 'physical',
    singleTarget: true,
    source: '[测试]',
  });
  check('对Boss累计15伤害后救回', engine.battle.swallow === undefined && !engine.buffs.has(warwick, 'swallowed'),
    `swallow=${JSON.stringify(engine.battle.swallow)}`);
}

console.log('===== 8. 车厢修正与灵体特性 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_wraith', count: 1 }]);
  const wraith = engine.battle.enemies[0];
  const morgan = engine.battle.heroes['morgan'];
  const auris = engine.battle.heroes['auris'];
  morgan.critChance = 0;
  auris.critChance = 0;
  // 摩根在2号车厢（无修正），物理打灵体×0.7
  wraith.hp = wraith.maxHp;
  engine.pipeline.dealDamage({
    attacker: { side: 'hero', heroId: 'morgan' },
    target: { side: 'enemy', uid: wraith.uid },
    amount: 10,
    attackType: 'melee',
    damageType: 'physical',
    singleTarget: true,
    source: '[测试]',
  });
  const dmg1 = wraith.maxHp - wraith.hp;
  check('灵体受物理伤害-30%', dmg1 === 7, `10→${dmg1}`);
  // 奥瑞斯法术打灵体：车尾平台×0.9 × 灵体法术×1.5 = 13.5→14
  wraith.hp = wraith.maxHp;
  engine.pipeline.dealDamage({
    attacker: { side: 'hero', heroId: 'auris' },
    target: { side: 'enemy', uid: wraith.uid },
    amount: 10,
    attackType: 'ranged',
    damageType: 'arcane',
    singleTarget: true,
    source: '[测试]',
  });
  const dmg2 = wraith.maxHp - wraith.hp;
  check('灵体受法术伤害+50%（含车尾-10%）', dmg2 === 14, `10→${dmg2}`);
}

console.log('===== 9. 力量与格挡 =====');
{
  const engine = freshEngine();
  engine.startEncounter([{ defId: 'zone1_hound', count: 1 }]);
  const hound = engine.battle.enemies[0];
  const warwick = engine.battle.heroes['warwick'];
  warwick.critChance = 0;
  engine.buffs.apply(warwick, 'strength', 3, 2);
  hound.hp = hound.maxHp;
  engine.pipeline.dealDamage({
    attacker: { side: 'hero', heroId: 'warwick' },
    target: { side: 'enemy', uid: hound.uid },
    amount: 6,
    attackType: 'melee',
    damageType: 'physical',
    singleTarget: true,
    source: '[测试]',
  });
  // 6+3力量=9，1号车厢近战×1.1 → 9.9→10
  check('力量+3与车厢修正：(6+3)×1.1=10', hound.maxHp - hound.hp === 10, `${hound.maxHp - hound.hp}`);
  warwick.block = 5;
  const hpBefore = warwick.hp;
  engine.pipeline.dealDamage({
    attacker: { side: 'enemy', uid: hound.uid },
    target: { side: 'hero', heroId: 'warwick' },
    amount: 8,
    attackType: 'melee',
    damageType: 'physical',
    singleTarget: true,
    source: '[测试]',
  });
  check('格挡吸收后仅3点穿透', hpBefore - warwick.hp === 3, `受伤${hpBefore - warwick.hp}`);
}

console.log('\n===== 结果 =====');
console.log(`${passCount} 通过 / ${failCount} 失败`);
process.exit(failCount === 0 ? 0 : 1);
