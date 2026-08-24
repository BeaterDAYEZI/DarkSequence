// 开局卡组选择面板：四英雄 A套（稳健）/B套（爆发）选择
import { registry } from '../../core/registry';
import { STARTING_DECK_INFO, type DeckChoice } from '../../data/startingDecks';
import type { HeroId } from '../../core/types';

export class DeckSelectPanel {
  private choices: Record<HeroId, DeckChoice> = {
    warwick: 'A', morgan: 'A', serafina: 'A', auris: 'A',
  };

  constructor(private onConfirm: (choices: Record<HeroId, DeckChoice>) => void) {}

  render(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'deck-overlay';
    el.innerHTML = `
      <div class="deck-modal">
        <h2>⚔️ 选择初始卡组</h2>
        <p class="deck-note">每位英雄各有两套起始卡组：<b>A套稳健</b>（新手推荐）/ <b>B套爆发</b>（老手挑战）</p>
        <div class="deck-list">
          ${(['warwick', 'morgan', 'serafina', 'auris'] as HeroId[]).map((hid) => {
            const def = registry.heroes.get(hid)!;
            const info = STARTING_DECK_INFO[hid];
            return `
              <div class="deck-hero" style="--hero-color:${def.color}">
                <div class="deck-hero-head">
                  <span class="hero-avatar" style="background:${def.color}">${def.name[0]}</span>
                  <b>${def.name}</b><span class="dim">· ${def.title}</span>
                </div>
                <div class="deck-options">
                  ${(['A', 'B'] as DeckChoice[]).map((c) => `
                    <button class="deck-opt ${this.choices[hid] === c ? 'active' : ''}" data-hero="${hid}" data-choice="${c}">
                      <b>${info[c].name}</b>
                      <span class="dim">${info[c].desc}</span>
                      <span class="deck-strategy">${info[c].strategy}</span>
                    </button>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="deck-foot">
          <span class="dim">起始赠卡：锈蚀齿轮 + 蚀铁护甲片</span>
          <button class="btn-deck-confirm">启程 🚂</button>
        </div>
      </div>`;

    el.querySelectorAll<HTMLElement>('.deck-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.choices[b.dataset.hero as HeroId] = b.dataset.choice as DeckChoice;
        const hero = b.dataset.hero!;
        el.querySelectorAll<HTMLElement>(`.deck-opt[data-hero="${hero}"]`).forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    el.querySelector('.btn-deck-confirm')?.addEventListener('click', () => {
      this.onConfirm({ ...this.choices });
    });
    return el;
  }
}
