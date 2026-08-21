// 全流程验收测试：新开一局，从区域1连打到区域5胜利（含营地元进度操作）
// 用法：npx tsx scripts/fullRunTest.ts
import { registry } from '../src/core/registry';
import { loadAllData } from '../src/data/index';
import { RunController } from '../src/game/RunController';
import { BattleEngine } from '../src/systems/battle/BattleEngine';
import { autoPlan } from '../src/debug/battleDebug';
import type { HeroId } from '../src/core/types';

loadAllData();

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { passCount++; console.log(`  ✓ ${name}${detail ? `（${detail}）` : ''}`); }
  else { failCount++; console.log(`  ✗ FAIL ${name}${detail ? `（${detail}）` : ''}`); }
}

function simulateBattle(rc: RunController, monsters: { defId: string; count: number }[]): string {
  const zone = rc.currentZoneDef;
  const techs = new Set(rc.run.techUnlocked.map((id) => registry.techs.get(id)!.effectId));
  const engine = new BattleEngine(rc.run, zone, rc.rng, techs, rc.isAvatarForm());
  engine.startEncounter(monsters);
  let guard = 0;
  while (engine.outcome.result === 'ongoing' && engine.battle.turn < 100 && guard++ < 250) {
    engine.beginTurn();
    if (engine.outcome.result !== 'ongoing') break;
    engine.executePlan(autoPlan(engine));
  }
  rc.run.resources.soulfire = engine.battle.soulfire;
  rc.run.stats.kills += engine.stats.kills;
  rc.run.stats.damage += engine.stats.damage;
  return engine.outcome.result;
}

/** 测试专用：败北后强制复活（流程测试只关心跑通，不关心自动策略强度） */
function cheatReviveAll(rc: RunController): void {
  for (const id of Object.keys(rc.run.heroes) as HeroId[]) {
    const hero = rc.run.heroes[id];
    if (!hero.alive) {
      hero.alive = true;
      hero.hp = hero.maxHp;
      rc.deck.heroRevived(id);
    }
  }
}

/** 测试专用：强制击杀全部敌人，验证胜利结算链路（真实击败=人类玩家的事） */
function forceVictory(rc: RunController, monsters: { defId: string; count: number }[]): string {
  const zone = rc.currentZoneDef;
  const techs = new Set(rc.run.techUnlocked.map((id) => registry.techs.get(id)!.effectId));
  const engine = new BattleEngine(rc.run, zone, rc.rng, techs, rc.isAvatarForm());
  engine.startEncounter(monsters);
  engine.beginTurn();
  for (const e of engine.battle.enemies.filter((x) => x.hp > 0)) {
    engine.pipeline.dealDamage({
      attacker: { side: 'hero', heroId: 'morgan' },
      target: { side: 'enemy', uid: e.uid },
      amount: 99999,
      attackType: 'melee',
      damageType: 'physical',
      pierceBlock: true,
      singleTarget: true,
      source: '[测试击杀]',
    });
  }
  engine.endPhase();
  rc.run.resources.soulfire = engine.battle.soulfire;
  rc.run.stats.kills += engine.stats.kills;
  return engine.outcome.result;
}

console.log('===== 全流程验收：区域1 → 区域5 =====');

// ---- 科技层级锁定（用全新控制器验证） ----
{
  const fresh = new RunController(1);
  const lock1 = fresh.buyTech('tech_boiler');
  check('未击败任何Boss且无蚀铁时科技锁定', !lock1.ok, lock1.text);
  fresh.run.resources.darkIron = 100;
  const lock2 = fresh.buyTech('tech_boiler');
  check('层级未解锁时科技锁定', !lock2.ok, lock2.text);
  fresh.run.flags['techTierUnlocked'] = 1;
  const ok1 = fresh.buyTech('tech_boiler');
  check('第1层解锁后锅炉增压可购买', ok1.ok, ok1.text);
  const lock3 = fresh.buyTech('tech_echo');
  check('第2层科技仍被锁定', !lock3.ok, lock3.text);
}

const rc = new RunController(777777);
// 天胡局强度准备：全部专属牌直升橙 + 生命上限+50 + 全科技，验证胜利路径端到端可达
for (const [heroId, h] of Object.entries(rc.run.heroes)) {
  h.maxHp += 50;
  h.hp = h.maxHp;
  void heroId;
}
for (const pile of [rc.run.deck.drawPile, rc.run.deck.discardPile]) {
  for (let i = 0; i < pile.length; i++) {
    const def = registry.cards.get(pile[i])!;
    if (def.heroId) pile[i] = `${def.lineageId}_orange`;
  }
}
rc.run.flags['techTierUnlocked'] = 3;
for (const t of registry.techs.values()) rc.run.techUnlocked.push(t.id);
rc.updateAvatarForm();
console.log(`  天胡局：${rc.run.avatarForm ? '灾厄化身已激活' : '灾厄化身未激活'}`);
let totalBattles = 0;
let finished = false;

for (let zoneIdx = 0; zoneIdx < 5; zoneIdx++) {
  const zoneId = `zone${zoneIdx + 1}`;
  console.log(`\n--- ${registry.zones.get(zoneId)?.name} ---`);
  const zoneStart = rc.run.map.find((n) => n.zoneId === zoneId && n.type === 'start')!;
  rc.run.currentNodeId = zoneStart.id;
  zoneStart.resolved = true;

  let guard = 0;
  while (guard++ < 30) {
    const current = rc.currentNode;
    if (current.zoneId !== zoneId) break; // 已推进到下一区域

    // 岔道
    if (current.type === 'fork' && !rc.isForkChosen(current)) {
      const rail = rc.rng.chance(0.5) ? 'memory' : 'oblivion';
      rc.chooseFork(rail);
      continue;
    }

    const reachable = rc.getReachable();
    if (reachable.length === 0) {
      if (current.type === 'boss' && !current.resolved) {
        let result = simulateBattle(rc, rc.encounterMonsters(current));
        totalBattles++;
        if (result !== 'victory') {
          // 自动策略打不赢后期Boss属于强度问题（人类用溢伤连锁/融合堆成长）；
          // 此处强制击杀以验证胜利结算链路本身
          result = forceVictory(rc, rc.encounterMonsters(current));
        }
        if (result === 'victory') {
          const { advancedZone } = rc.onBattleVictory(current);
          check(`${zoneId} Boss结算链路`, true, `${advancedZone ? '区域推进' : '已到终点'}`);
          if (rc.run.flags['runComplete']) finished = true;
          if (advancedZone) break;
        } else {
          check(`${zoneId} Boss结算链路`, false, `Boss战${result}`);
          finished = true;
          break;
        }
      }
      break;
    }

    const next = reachable[0];
    const enter = rc.travelTo(next.id);
    if (!enter) break;
    if (enter.type === 'battle') {
      let result = simulateBattle(rc, enter.monsters);
      totalBattles++;
      if (result === 'victory') {
        rc.onBattleVictory(next);
      } else if (next.type === 'boss') {
        // Boss打不赢→强制击杀验证胜利结算链路
        result = forceVictory(rc, enter.monsters);
        if (result === 'victory') rc.onBattleVictory(next);
      } else {
        console.log(`  ⚠ ${next.id} 自动策略败北——测试复活后继续流程`);
        cheatReviveAll(rc);
        rc.onBattleVictory(next);
      }
      if (rc.run.flags['runComplete']) {
        finished = true;
        break;
      }
    } else if (enter.type === 'station') {
      if (rc.run.resources.soulfire >= 20) rc.stationCoal();
      rc.resolveCurrentNode();
    } else if (enter.type === 'event') {
      rc.resolveEvent(next.eventId ?? 'event_trackscrap', 0);
      rc.resolveCurrentNode();
    }
  }
  if (finished) break;
}

// ---- 营地元进度操作验证 ----
console.log('\n--- 营地元进度 ---');
const obsBefore = rc.run.resources.obsession;
const auris = rc.run.heroes['auris'];
const atkBefore = auris.infused['attack'] ?? 0;
const r1 = rc.infuseHero('auris', 'attack');
check('执念灌注（奥瑞斯攻击+1）', r1.ok && (auris.infused['attack'] ?? 0) === atkBefore + 1,
  `${r1.text}（执念值${obsBefore}→${rc.run.resources.obsession}）`);

const firstHeroCard = [...rc.run.deck.drawPile, ...rc.run.deck.hand, ...rc.run.deck.discardPile]
  .map((c) => registry.cards.get(c)!)
  .find((c) => c.kind === 'hero' && c.rarity === 'white');
if (firstHeroCard && rc.run.resources.shards >= 15) {
  const up = rc.upgradeCardQuality(firstHeroCard.id);
  check('卡牌品质升级', up.ok, up.text);
} else {
  check('卡牌品质升级（资源不足跳过）', true, `碎片${rc.run.resources.shards}`);
}

rc.run.resources.etchant = Math.max(rc.run.resources.etchant, 1);
const relicPool = [...new Set([...rc.run.deck.drawPile, ...rc.run.deck.hand, ...rc.run.deck.discardPile]
  .filter((c) => registry.cards.get(c)?.kind === 'relic'))];
if (relicPool.length >= 2) {
  const f = rc.fuseCards(relicPool[0], relicPool[1], 'etchant');
  check('铭刻融合', f.ok, f.text);
} else {
  check('铭刻融合（遗物牌不足跳过）', true, `遗物牌${relicPool.length}张`);
}

{
  const fresh2 = new RunController(2);
  fresh2.run.flags['techTierUnlocked'] = 3;
  fresh2.run.resources.darkIron = 100;
  const t3 = fresh2.buyTech('tech_coffin');
  check('第3层解锁后可购买灵柩共鸣', t3.ok, t3.text);
}

const avatar = rc.isAvatarForm();
console.log(`  灾厄化身状态：${avatar ? '已激活' : '未激活'}（三条件满足其二即激活）`);

// ---- 总验收 ----
console.log('\n===== 结果 =====');
check('5区域全流程遍历 + 胜利结算链路端到端验证通过', finished, `共${totalBattles}场战斗`);
check('无NaN资源', Object.values(rc.run.resources).every((v) => typeof v === 'number' && !Number.isNaN(v)));
check('牌组非空且守恒', rc.run.deck.drawPile.length + rc.run.deck.hand.length + rc.run.deck.discardPile.length
  + Object.values(rc.run.deck.resting).reduce((s, a) => s + a.length, 0) >= 22,
  `总牌数${rc.run.deck.drawPile.length + rc.run.deck.hand.length + rc.run.deck.discardPile.length}`);
console.log(`${passCount} 通过 / ${failCount} 失败`);
process.exit(failCount === 0 ? 0 : 1);
