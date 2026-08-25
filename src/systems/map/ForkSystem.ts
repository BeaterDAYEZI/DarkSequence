// 岔道系统：左轨（记忆之轨）/右轨（遗忘之轨）选择结算
import type { RunState, ZoneDef } from '../../core/types';
import { Rng } from '../../core/rng';
import { registry } from '../../core/registry';

export type ForkRail = 'memory' | 'oblivion';

export interface ForkResult {
  rail: ForkRail;
  logs: { text: string; kind: 'info' | 'soulfire' | 'madness' }[];
  /** 被选中的分支节点id */
  chosenNodeId: string;
}

export function settleFork(run: RunState, zone: ZoneDef, forkNodeId: string, rail: ForkRail, rng: Rng): ForkResult {
  run.forkMemory[zone.id] = rail;
  const logs: ForkResult['logs'] = [];

  // 找到岔道节点
  const forkNode = run.map.find((n) => n.id === forkNodeId)!;
  const chosenNodeId = rail === 'memory' ? forkNode.next[0] : forkNode.next[1];
  run.flags[`fork_${forkNodeId}`] = rail;

  // 遗物牌池（牌库+手牌+弃牌堆）
  const deck = run.deck;
  const allPiles = [...deck.drawPile, ...deck.hand, ...deck.discardPile, ...Object.values(deck.resting).flat()];
  const targetCards = allPiles.filter((c) => registry.cards.get(c)?.kind === 'hero');

  if (rail === 'memory') {
    // 左轨：删除一张随机遗物牌 + 本区域全队力量+3
    if (targetCards.length === 0) {
      logs.push({ text: '牌组中没有遗物牌可删除——记忆之轨收不到代价', kind: 'info' });
    } else {
      const target = rng.pick(targetCards);
      // 从各堆中移除一张
      for (const pile of [deck.drawPile, deck.hand, deck.discardPile, ...Object.values(deck.resting)]) {
        const i = pile.indexOf(target);
        if (i >= 0) {
          pile.splice(i, 1);
          break;
        }
      }
      const name = registry.cards.get(target)?.name ?? target;
      logs.push({ text: `记忆之轨吞噬了一张卡牌【${name}】`, kind: 'info' });
    }
    logs.push({ text: '本区域全队力量+3（每场战斗开始时生效）', kind: 'info' });
  } else {
    // 右轨：复制一张随机遗物牌 + 本区域全队壁垒-2
    if (targetCards.length === 0) {
      logs.push({ text: '牌组中没有遗物牌可复制——遗忘之轨给不出收益', kind: 'info' });
    } else {
      const target = rng.pick(targetCards);
      deck.drawPile.push(target);
      rng.shuffle(deck.drawPile);
      const name = registry.cards.get(target)?.name ?? target;
      logs.push({ text: `遗忘之轨复制了一张卡牌【${name}】`, kind: 'info' });
    }
    logs.push({ text: '本区域全队壁垒-2（格挡获取-2）', kind: 'info' });
  }

  return { rail, logs, chosenNodeId };
}
