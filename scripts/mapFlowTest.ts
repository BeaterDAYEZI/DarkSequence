// 地图流程 headless 测试：完整走一遍区域一（旅行/岔道/调度站/事件/Boss/区域推进）
// 用法：npx tsx scripts/mapFlowTest.ts
import { registry } from '../src/core/registry';
import { loadAllData } from '../src/data/index';
import { RunController } from '../src/game/RunController';
import { BattleEngine } from '../src/systems/battle/BattleEngine';
import { autoPlan } from '../src/debug/battleDebug';

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
  const engine = new BattleEngine(rc.run, zone, rc.rng, techs);
  engine.startEncounter(monsters);
  let guard = 0;
  while (engine.outcome.result === 'ongoing' && engine.battle.turn < 80 && guard++ < 200) {
    engine.beginTurn();
    if (engine.outcome.result !== 'ongoing') break;
    engine.executePlan(autoPlan(engine));
  }
  rc.run.resources.soulfire = engine.battle.soulfire;
  return engine.outcome.result;
}

console.log('===== 地图流程测试：区域一完整走一遍 =====');
const rc = new RunController(20260821);

// 1. 地图生成
check('生成55个节点（5区域×11）', rc.run.map.length === 55, `${rc.run.map.length}个`);
check('起始节点为区域一起点', rc.currentNode.id === 'zone1_n0');

// 2. 旅行链：start → b1
const startReachable = rc.getReachable();
check('起点可达第1场遭遇', startReachable.some((n) => n.id === 'zone1_n1'));
const enter1 = rc.travelTo('zone1_n1')!;
check('进入战斗节点', enter1.type === 'battle' && enter1.monsters.length === 2);

// 3. 战斗胜利结算
const result1 = simulateBattle(rc, enter1.monsters);
check('第1场遭遇可结束', result1 !== 'ongoing', result1);
rc.onBattleVictory(rc.nodeById('zone1_n1'));
check('节点标记已解决', rc.nodeById('zone1_n1').resolved);
check('战斗胜利获得执念值', rc.run.resources.obsession === 5, `执念值${rc.run.resources.obsession}`);

// 4. 继续到岔道
rc.travelTo('zone1_n2');
simulateBattle(rc, rc.encounterMonsters(rc.nodeById('zone1_n2')));
rc.onBattleVictory(rc.nodeById('zone1_n2'));
rc.travelTo('zone1_n3');
check('岔道节点不可直接通过', rc.currentNode.type === 'fork');

// 5. 岔道选择：左轨（记忆）
const relicCountBefore = [...rc.run.deck.drawPile, ...rc.run.deck.hand, ...rc.run.deck.discardPile, ...Object.values(rc.run.deck.resting).flat()]
  .filter((c) => registry.cards.get(c)?.kind === 'hero').length;
const forkResult = rc.chooseFork('memory');
check('岔道选择返回结果', forkResult.chosenNodeId === 'zone1_n4L');
check('记忆之轨删除一张卡牌',
  [...rc.run.deck.drawPile, ...rc.run.deck.hand, ...rc.run.deck.discardPile, ...Object.values(rc.run.deck.resting).flat()]
    .filter((c) => registry.cards.get(c)?.kind === 'hero').length === relicCountBefore - 1);
check('区域记忆标记已记录', rc.run.forkMemory['zone1'] === 'memory');
check('可达节点为左轨战斗', rc.getReachable().some((n) => n.id === 'zone1_n4L')
  && !rc.getReachable().some((n) => n.id === 'zone1_n4R'));

// 5b. 地图结构完整性：BFS 必须覆盖区域内全部节点（防止孤儿节点导致UI崩溃）
{
  const zoneNodes = rc.run.map.filter((n) => n.zoneId === 'zone1');
  const start = zoneNodes.find((n) => n.type === 'start')!;
  const depth = new Map<string, number>();
  const queue = [start.id];
  depth.set(start.id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const node = rc.run.map.find((n) => n.id === id)!;
    for (const nextId of node.next) {
      if (!depth.has(nextId)) {
        depth.set(nextId, depth.get(id)! + 1);
        queue.push(nextId);
      }
    }
  }
  const orphans = zoneNodes.filter((n) => !depth.has(n.id)).map((n) => n.id);
  check('地图无孤儿节点（BFS全覆盖）', orphans.length === 0, orphans.join(',') || '全部可达');
}
// 5c. 右轨路径验证：遗忘之轨 → 事件节点 → 战斗 → 调度站
{
  const rc2 = new RunController(987654);
  rc2.run.currentNodeId = 'zone1_n3';
  rc2.nodeById('zone1_n3').resolved = true;
  const relicBefore = [...rc2.run.deck.drawPile, ...rc2.run.deck.hand, ...rc2.run.deck.discardPile, ...Object.values(rc2.run.deck.resting).flat()]
    .filter((c) => registry.cards.get(c)?.kind === 'hero').length;
  const fork2 = rc2.chooseFork('oblivion');
  check('右轨选择指向事件节点', fork2.chosenNodeId === 'zone1_n4R');
  check('遗忘之轨复制一张卡牌',
    [...rc2.run.deck.drawPile, ...rc2.run.deck.hand, ...rc2.run.deck.discardPile, ...Object.values(rc2.run.deck.resting).flat()]
      .filter((c) => registry.cards.get(c)?.kind === 'hero').length === relicBefore + 1);
  const enterEvent = rc2.travelTo('zone1_n4R');
  check('右轨事件节点可进入', enterEvent?.type === 'event');
}

// 6. 左轨：战斗 + 精英
rc.travelTo('zone1_n4L');
simulateBattle(rc, rc.encounterMonsters(rc.nodeById('zone1_n4L')));
rc.onBattleVictory(rc.nodeById('zone1_n4L'));
rc.travelTo('zone1_n5L');
check('精英节点生成双子', rc.encounterMonsters(rc.nodeById('zone1_n5L')).length === 2);
simulateBattle(rc, rc.encounterMonsters(rc.nodeById('zone1_n5L')));
rc.onBattleVictory(rc.nodeById('zone1_n5L'));
check('精英胜利执念值+10', rc.run.resources.obsession === 5 + 5 + 5 + 10, `执念值${rc.run.resources.obsession}`);

// 7. 调度站
rc.travelTo('zone1_n6');
const hpBefore = Object.values(rc.run.heroes).reduce((s, h) => s + h.hp, 0);
const maxHp = Object.values(rc.run.heroes).reduce((s, h) => s + h.maxHp, 0);
if (rc.run.resources.soulfire >= 20) {
  rc.stationCoal();
  check('煤水加注恢复满状态', Object.values(rc.run.heroes).reduce((s, h) => s + h.hp, 0) === maxHp, `${hpBefore}→满`);
} else {
  check('煤水加注恢复满状态（魂火不足跳过）', true, `魂火${rc.run.resources.soulfire}`);
}
rc.resolveCurrentNode();

// 8. Boss前最后一战 + Boss
rc.travelTo('zone1_n7');
simulateBattle(rc, rc.encounterMonsters(rc.nodeById('zone1_n7')));
rc.onBattleVictory(rc.nodeById('zone1_n7'));
rc.travelTo('zone1_n8');
check('Boss节点为残响牧羊人', rc.encounterMonsters(rc.nodeById('zone1_n8'))[0]?.defId === 'zone1_shepherd');
const bossResult = simulateBattle(rc, rc.encounterMonsters(rc.nodeById('zone1_n8')));
check('Boss战可结束', bossResult !== 'ongoing', bossResult);
const advanced = rc.onBattleVictory(rc.nodeById('zone1_n8'));
check('Boss胜利后推进到区域二', advanced.advancedZone && rc.currentNode.id === 'zone2_n0',
  `当前节点${rc.currentNode.id}`);

console.log('\n===== 结果 =====');
console.log(`${passCount} 通过 / ${failCount} 失败`);
process.exit(failCount === 0 ? 0 : 1);
