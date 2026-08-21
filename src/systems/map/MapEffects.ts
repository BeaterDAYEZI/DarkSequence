// 地图级效果解析：事件选项在地图场景结算（治疗/狂气/魂火等，无战斗上下文）
import type { EffectSpec, RunState } from '../../core/types';
import type { Rng } from '../../core/rng';

export interface MapEffectLog {
  text: string;
  kind: 'heal' | 'madness' | 'soulfire' | 'info';
}

export function resolveMapEffect(run: RunState, effect: EffectSpec, rng: Rng): MapEffectLog | null {
  const heroes = Object.values(run.heroes);
  const roll = (a: number | [number, number] | undefined): number => {
    if (a === undefined) return 0;
    return Array.isArray(a) ? rng.range(a[0], a[1]) : a;
  };

  switch (effect.kind) {
    case 'heal': {
      const amount = roll(effect.amount);
      const targets = effect.target?.mode === 'lowestHpAlly'
        ? heroes.filter((h) => h.alive).sort((a, b) => a.hp - b.hp).slice(0, 1)
        : heroes.filter((h) => h.alive);
      let healed = 0;
      for (const h of targets) {
        const gain = Math.min(h.maxHp - h.hp, amount);
        h.hp += gain;
        healed += gain;
      }
      return healed > 0 ? { text: `全队恢复 ${healed} 点生命`, kind: 'heal' } : null;
    }
    case 'madnessGain': {
      const amount = roll(effect.amount);
      const target = effect.target?.mode === 'random'
        ? rng.pick(heroes.filter((h) => h.alive))
        : heroes.find((h) => h.alive);
      if (target) {
        target.madness = Math.min(100, target.madness + amount);
        return { text: `${target.heroId} 狂气+${amount}`, kind: 'madness' };
      }
      return null;
    }
    case 'madnessClear': {
      let cleared = 0;
      for (const h of heroes) {
        cleared += h.madness;
        h.madness = 0;
      }
      return cleared > 0 ? { text: '全队狂气被清空', kind: 'madness' } : null;
    }
    case 'soulfireSteal': {
      const amount = effect.amount as number;
      const paid = Math.min(run.resources.soulfire, amount);
      run.resources.soulfire -= paid;
      return { text: `付出 ${paid} 点魂火（剩余 ${run.resources.soulfire}）`, kind: 'soulfire' };
    }
    case 'soulfireGain': {
      const amount = effect.amount as number;
      run.resources.soulfire = Math.min(150, run.resources.soulfire + amount);
      return { text: `获得 ${amount} 点魂火`, kind: 'soulfire' };
    }
    default:
      return null;
  }
}
