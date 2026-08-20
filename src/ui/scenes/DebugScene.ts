// 数据浏览调试页（?debug=data）：浏览全部卡牌/怪物/科技/事件
import type { Scene } from '../../app/SceneManager';
import { registry } from '../../core/registry';
import { describeEffect } from '../../core/effectText';
import { RARITY_NAME } from '../../core/types';
import type { CardDef, MonsterDef } from '../../core/types';

export class DebugScene implements Scene {
  onEnter(root: HTMLElement): void {
    const cards = [...registry.cards.values()];
    const monsters = [...registry.monsters.values()];
    const heroCards = cards.filter((c) => c.kind === 'hero');
    const relicCards = cards.filter((c) => c.kind === 'relic');
    const zones = [...registry.zones.values()];

    const cardRow = (c: CardDef) => `
      <tr>
        <td class="rarity-${c.rarity}">${RARITY_NAME[c.rarity]}</td>
        <td>${c.heroId ?? '遗物'}</td>
        <td><b>${c.name}</b>${c.isFused ? ' <span class="fused">融合</span>' : ''}</td>
        <td>${c.cost}费</td>
        <td>${c.tags.join(' ')}</td>
        <td>${c.effects.map(describeEffect).join('<br/>')}</td>
      </tr>`;

    const monsterRow = (m: MonsterDef) => `
      <tr>
        <td>${m.isPlaceholder ? '占位' : ''}</td>
        <td><b>${m.name}</b></td>
        <td>${m.hp}HP / 速${m.speed} / ${m.pos.join(',')}号位</td>
        <td>${(m.traits ?? []).map((t) => t.id).join(' ') || '-'}</td>
        <td>${[...m.actions, ...(m.phases ?? []).flatMap((p) => p.actions)].map((a) => `${a.icon}${a.name}`).join(' ') || (m.endTurnEffects ? '🔁共振' : '')}</td>
      </tr>`;

    root.innerHTML = `
      <div class="debug-page">
        <h1>数据浏览 · 暗蚀牌序</h1>
        <button onclick="location.href='/'">返回标题</button>
        <section>
          <h2>英雄（${registry.heroes.size}）</h2>
          <table><tr><th>英雄</th><th>称号</th><th>生命</th><th>车厢</th><th>觉醒</th></tr>
            ${[...registry.heroes.values()].map((h) => `<tr><td><b>${h.name}</b></td><td>${h.title}</td><td>${h.baseHp}</td><td>${h.defaultCarriage}号</td><td>${h.awakening.duration}回合</td></tr>`).join('')}
          </table>
        </section>
        <section>
          <h2>专属卡牌（${heroCards.length}）</h2>
          <table><tr><th>品质</th><th>英雄</th><th>牌名</th><th>费</th><th>标签</th><th>效果</th></tr>
            ${heroCards.map(cardRow).join('')}
          </table>
        </section>
        <section>
          <h2>遗物牌（${relicCards.length}）</h2>
          <table><tr><th>品质</th><th>英雄</th><th>牌名</th><th>费</th><th>标签</th><th>效果</th></tr>
            ${relicCards.map(cardRow).join('')}
          </table>
        </section>
        <section>
          <h2>怪物（${monsters.length}）</h2>
          ${zones.map((z) => `
            <h3>${z.name}${z.isPlaceholder ? '（占位）' : ''} · ${z.environmentRule.name}</h3>
            <table><tr><th></th><th>怪物</th><th>属性</th><th>特性</th><th>行动</th></tr>
              ${monsters.filter((m) => m.zoneId === z.id).map(monsterRow).join('')}
            </table>`).join('')}
        </section>
        <section>
          <h2>列车科技（${registry.techs.size}）</h2>
          <table><tr><th>科技</th><th>蚀铁</th><th>层</th><th>效果</th></tr>
            ${[...registry.techs.values()].map((t) => `<tr><td><b>${t.name}</b></td><td>${t.cost}</td><td>${t.tier}</td><td>${t.desc}</td></tr>`).join('')}
          </table>
        </section>
        <section>
          <h2>调度站（${registry.stations.size}）</h2>
          <table><tr><th>服务</th><th>魂火</th><th>效果</th></tr>
            ${[...registry.stations.values()].map((s) => `<tr><td><b>${s.name}</b></td><td>${s.cost}</td><td>${s.desc}</td></tr>`).join('')}
          </table>
        </section>
        <section>
          <h2>事件（${registry.events.size}）</h2>
          ${[...registry.events.values()].map((e) => `<div class="event-card"><b>${e.title}</b><p>${e.text}</p><ul>${e.choices.map((c) => `<li>${c.text}${c.note ? ` <i>—— ${c.note}</i>` : ''}</li>`).join('')}</ul></div>`).join('')}
        </section>
      </div>
    `;
  }
}
