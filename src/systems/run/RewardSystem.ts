// 战后三选一奖励系统（大更新2）：战斗胜利后从四类奖励中随机生成3个选项
import type { RunState } from '../../core/types';
import type { Rng } from '../../core/rng';
import { registry } from '../../core/registry';

export type RewardKind = 'card' | 'relic' | 'resource' | 'special';

export interface RewardOption {
  kind: RewardKind;
  title: string;
  desc: string;
  icon: string;
  apply: () => string;
}

/** 全局遗物池（被动效果） */
export const GLOBAL_RELICS = [
  { id: 'relic_gear', name: '锈蚀齿轮', icon: '⚙️', desc: '列车初始速度+1，每回合抽牌+1' },
  { id: 'relic_armor', name: '蚀铁护甲片', icon: '🛡️', desc: '全队每回合获得3点格挡' },
  { id: 'relic_engine', name: '魂火引擎', icon: '🔥', desc: '溢伤转化魂火比例+10%' },
  { id: 'relic_pact', name: '恶魔契约', icon: '😈', desc: '生命低于30%时，伤害×1.5' },
  { id: 'relic_bloodsac', name: '血祭献祭', icon: '🩸', desc: '战斗开始+20魂火，第一名英雄-10生命' },
] as const;

/** 公共卡牌池（三选一卡牌奖励来源） */
export function publicCardPool(): string[] {
  return [...registry.cards.values()]
    .filter((c) => c.kind === 'relic' && c.id.startsWith('p0') || c.id.startsWith('c0') || c.id.startsWith('r0'))
    .map((c) => c.id);
}

/** 生成3个奖励选项（从四类中随机取3类） */
export function generateRewards(run: RunState, rng: Rng): RewardOption[] {
  const kinds: RewardKind[] = ['card', 'relic', 'resource', 'special'];
  const picked = rng.shuffle([...kinds]).slice(0, 3);
  return picked.map((k) => generateOne(run, rng, k));
}

function generateOne(run: RunState, rng: Rng, kind: RewardKind): RewardOption {
  switch (kind) {
    case 'card': {
      const pool = publicCardPool();
      const cardId = rng.pick(pool);
      const def = registry.cards.get(cardId)!;
      return {
        kind, icon: '🃏', title: def.name,
        desc: `获得公共牌【${def.name}】（加入牌库）`,
        apply: () => {
          run.deck.drawPile.push(cardId);
          return `获得公共牌【${def.name}】`;
        },
      };
    }
    case 'relic': {
      const owned = new Set(run.relics);
      const available = GLOBAL_RELICS.filter((r) => !owned.has(r.id));
      const pick = available.length > 0 ? rng.pick(available) : GLOBAL_RELICS[0];
      return {
        kind, icon: pick.icon, title: pick.name,
        desc: `获得全局遗物【${pick.name}】——${pick.desc}${run.relics.length >= run.relicSlots ? '（槽位已满！）' : ''}`,
        apply: () => {
          if (run.relics.length >= run.relicSlots) return `遗物槽位已满，无法装备【${pick.name}】`;
          run.relics.push(pick.id);
          return `装备全局遗物【${pick.name}】`;
        },
      };
    }
    case 'resource': {
      const choices = [
        { icon: '🔥', title: '魂火×15', desc: '获得15点魂火', apply: () => { run.resources.soulfire += 15; return '魂火+15'; } },
        { icon: '💠', title: '残响碎片×10', desc: '获得10点残响碎片', apply: () => { run.resources.shards += 10; return '残响碎片+10'; } },
        { icon: '🧪', title: '蚀刻剂×1', desc: '获得1瓶蚀刻剂', apply: () => { run.resources.etchant += 1; return '蚀刻剂+1'; } },
      ];
      return { ...rng.pick(choices), kind };
    }
    case 'special': {
      const choices = [
        { icon: '🗑️', title: '删除手牌', desc: '从牌组中删除1张牌（可在下一节点选择）', apply: () => '触发删牌（暂由玩家在营地操作）' },
        { icon: '💚', title: '全队恢复50%', desc: '全队恢复50%最大生命', apply: () => {
          let healed = 0;
          for (const h of Object.values(run.heroes)) {
            if (h.alive) {
              const gain = Math.round(h.maxHp * 0.5);
              h.hp = Math.min(h.maxHp, h.hp + gain);
              healed += gain;
            }
          }
          return `全队恢复${healed}点生命`;
        } },
        { icon: '🌪️', title: '随机英雄+10狂气', desc: '随机一名英雄狂气+10', apply: () => {
          const alive = Object.values(run.heroes).filter((h) => h.alive);
          const h = rng.pick(alive);
          h.madness = Math.min(100, h.madness + 10);
          return `随机英雄狂气+10`;
        } },
      ];
      return { ...rng.pick(choices), kind };
    }
  }
}
