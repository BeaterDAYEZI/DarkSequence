// 卡牌DOM工厂：数据驱动渲染，4品质样式（绿/蓝/橙用美术底框，白色保持代码边框）
import type { CardDef } from '../../core/types';
import { describeEffect } from '../../core/effectText';
import { ASSETS } from '../../core/assets';

export interface CardViewOptions {
  /** 是否显示费用折扣后的实际费用 */
  effectiveCost?: number;
  disabled?: boolean;
  dim?: boolean;
}

const FRAME_ART: Partial<Record<CardDef['rarity'], string>> = {
  green: ASSETS.cardFrame.green,
  blue: ASSETS.cardFrame.blue,
  orange: ASSETS.cardFrame.orange,
};

export function createCardEl(card: CardDef, opts: CardViewOptions = {}): HTMLElement {
  const el = document.createElement('div');
  el.className = `card rarity-${card.rarity}${opts.disabled ? ' disabled' : ''}${opts.dim ? ' dim' : ''}`;
  el.dataset.cardId = card.id;

  const cost = opts.effectiveCost ?? card.cost;
  const heroColor = card.heroId ? `var(--hero-${card.heroId})` : 'var(--relic-color)';
  const frame = FRAME_ART[card.rarity];
  const frameStyle = frame ? ` style="background-image:url('${frame}')"` : '';

  el.innerHTML = `
    <div class="card-frame${frame ? ' art' : ''}"${frameStyle}>
    <div class="card-cost">${cost === 0 ? '✦' : cost}</div>
    <div class="card-hero" style="color:${heroColor}">${card.heroId ? card.heroId.slice(0, 2).toUpperCase() : '遗物'}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-effects">${card.effects.map((e) => `<div>${describeEffect(e)}</div>`).join('')}</div>
    ${card.flavor ? `<div class="card-flavor">${card.flavor}</div>` : ''}
    <div class="card-reqs">
      ${card.tags.map((t) => `<span class="tag tag-${t}">${tagName(t)}</span>`).join('')}
      ${card.speedDelta !== undefined ? `<span class="tag tag-speed">${card.speedDelta >= 0 ? '▲' : '▼'}${Math.abs(card.speedDelta)}速</span>` : ''}
      ${card.carriageReq ? `<span class="tag tag-req">车厢${card.carriageReq.pos.join('/')}号</span>` : ''}
      ${card.speedReq?.min !== undefined ? `<span class="tag tag-req">速度≥${card.speedReq.min}</span>` : ''}
      ${card.resonance ? `<span class="tag tag-res">共鸣·${card.resonance.tag}</span>` : ''}
    </div>
    </div>
  `;
  return el;
}

const TAG_NAMES: Record<string, string> = {
  speed: '加速', displace: '位移', heal: '治疗', madness: '狂气',
  aoe: '群攻', arcane: '法术', melee: '近战', ranged: '远程',
  physical: '物理', draw: '抽牌', resonance: '共鸣', defense: '防御',
  attack: '攻击', mark: '标记', crit: '暴击', overkill: '溢伤',
  soulfire: '魂火', dot: '持续', risk: '风险',
};

function tagName(tag: string): string {
  return TAG_NAMES[tag] ?? tag;
}
