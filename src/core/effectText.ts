// EffectSpec → 中文描述（纯函数，无DOM）：调试页与卡牌UI共用
import type { EffectSpec, TargetSelector } from './types';

const STATUS_NAME: Record<string, string> = {
  bleed: '流血', vulnerable: '易伤', fear: '恐惧', tenacity: '坚韧',
  imprison: '禁锢', healReduction: '减疗', dodge: '闪避', stun: '眩晕',
  mark: '标记', taunt: '嘲讽', strength: '力量', revenge: '复仇',
  guard: '援护', silenceHeal: '低语', awakened: '觉醒', critUp: '暴击强化',
  enraged: '暴走', swallowed: '吞噬', corrosion: '腐蚀', exhaust: '虚脱',
};

function targetText(t?: TargetSelector): string {
  if (!t) return '自身';
  const sideName = t.side === 'enemy' ? '敌人' : '队友';
  switch (t.mode) {
    case 'pos': return `${t.pos!.join('-')}号位${sideName}`;
    case 'front': return `最前排${sideName}`;
    case 'back': return `最后排${sideName}`;
    case 'random': return `随机${sideName}`;
    case 'all': return t.side === 'enemy' ? '所有敌人' : '全队';
    case 'lowestHp': return '生命最低的敌人';
    case 'marked': return '被标记的敌人';
    case 'lowestHpAlly': return '生命最低的队友';
    case 'highestMadnessAlly': return '狂气最高的队友';
    case 'self': return '自身';
    case 'random2': return '两名随机单位';
    default: return sideName;
  }
}

function amountText(a?: number | [number, number]): string {
  if (a === undefined) return '';
  if (Array.isArray(a)) return `${a[0]}-${a[1]}`;
  return `${a}`;
}

export function describeEffect(e: EffectSpec): string {
  const t = targetText(e.target);
  switch (e.kind) {
    case 'damage': {
      let s = `对${t}造成${amountText(e.amount)}点伤害`;
      if (e.times && e.times > 1) s += `（攻击${e.times}次）`;
      if (e.hpBelow50Bonus) s += `，目标生命<50%时伤害+${Math.round(e.hpBelow50Bonus * 100)}%`;
      if (e.selfMadnessAbove50Mult) s += `，自身狂气>50时伤害翻倍`;
      if (e.madnessOnHit) s += `，并施加+${e.madnessOnHit}狂气`;
      if (e.pierceBlock) s += '，无视格挡';
      if (e.plusPerDark) s += `，每层暗蚀能量伤害+${e.plusPerDark}`;
      if (e.overkillMult && e.overkillMult !== 1) s += `，溢出伤害×${e.overkillMult}转为暗蚀`;
      if (e.allToDarkMult) s += `，伤害×${e.allToDarkMult}转为暗蚀`;
      if (e.consumeDark) s += '，并清空暗蚀能量';
      if (e.onKillExtra) s += '，击杀后立刻获得一次额外行动';
      if (e.critMult) s += '，本次暴击率翻倍';
      if (e.lastHitCrit) s += '，最后一击必定暴击';
      if (e.reduceBlockPerHit) s += `，每次命中降低${e.reduceBlockPerHit}点格挡`;
      if (e.chance !== undefined) s += `（${Math.round(e.chance * 100)}%概率）`;
      return s;
    }
    case 'block': return `${t}获得${amountText(e.amount)}点格挡`;
    case 'heal': return `${t}恢复${amountText(e.amount)}点生命`;
    case 'draw': return `抽${e.amount}张牌`;
    case 'energyGain': return `获得${e.amount}点能量`;
    case 'taunt': return `嘲讽所有敌人${e.duration && e.duration > 1 ? `（持续${e.duration}回合）` : ''}${e.value ? `，每次被攻击全队+${e.value}魂火` : ''}`;
    case 'speed': {
      const d = typeof e.amount === 'number' ? e.amount : 0;
      let s = `列车速度${d >= 0 ? '+' : ''}${d}`;
      if (e.clearMadnessIfSpeedZero) s += '，若速度归零则清除全队狂气';
      return s;
    }
    case 'pull': return `将${t}拉拽至1号位`;
    case 'push': return `${t}后退1格`;
    case 'shufflePos': return `随机交换${t}站位`;
    case 'madnessGain': {
      let s = `${t}狂气+${e.amount}`;
      if (e.replayIfAwakened) s += '，若因此觉醒则本牌无消耗且再打一次';
      return s;
    }
    case 'madnessTransfer': {
      let s = `将自身${e.amount}点狂气转移给敌方全体（造成压力伤害）`;
      if (e.drawIfEmpty) s += `，若自身狂气归零则额外抽${e.drawIfEmpty}张牌`;
      return s;
    }
    case 'madnessClear': return e.amount ? `${t}狂气-${e.amount}` : `清除${t}所有狂气`;
    case 'soulfireSteal': {
      let s = `窃取${e.amount}点魂火`;
      if (e.fallbackDamage) s += `（魂火不足则改为造成${e.fallbackDamage}点伤害）`;
      return s;
    }
    case 'soulfireGain': return `获得${e.amount}点魂火`;
    case 'soulfireClear': return '清空列车所有魂火';
    case 'applyStatus': {
      const sn = STATUS_NAME[e.status ?? ''] ?? e.status;
      let s = `${t}施加${e.stacks ?? 1}层${sn}`;
      if (e.duration !== undefined && e.duration !== -1) s += `（${e.duration}回合）`;
      if (e.value && e.status === 'fear') s = s.replace('层恐惧', '层恐惧（伤害-20%）');
      if (e.valuePerSpeed) s += `，数值随列车速度提升`;
      if (e.chance !== undefined) s += `（${Math.round(e.chance * 100)}%概率）`;
      return s;
    }
    case 'clearStatus': return `清除${t}的负面标记`;
    case 'extraAction': return '获得一次额外行动';
    case 'costOverride': return '本牌无消耗';
    case 'summon': return `召唤${e.summonId}至${e.summonPos}号位`;
    case 'critGain': return `暴击率+${Math.round(((typeof e.amount === 'number' ? e.amount : 0) ?? 0) * 100)}%（${e.critScope === 'run' ? '全局' : '本场战斗'}）`;
    case 'swallow': return '吞噬1号位英雄（累计造成15点伤害可救回）';
    default: return `[未知效果:${(e as { kind: string }).kind}]`;
  }
}
