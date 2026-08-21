// 营地面板：英雄执念灌注 / 卡牌品质升级 / 铭刻融合 / 列车科技（四页签）
import { registry } from '../../core/registry';
import { RARITY_NAME, type HeroId } from '../../core/types';
import { RunController } from '../../game/RunController';
import { describeEffect } from '../../core/effectText';
import { appRef } from '../../app/appRef';
import { SaveSystem } from '../../systems/run/SaveSystem';

export class CampPanel {
  private tab: 'heroes' | 'cards' | 'fusion' | 'tech' = 'heroes';
  private fusionA: string | null = null;
  private fusionB: string | null = null;

  constructor(
    private rc: RunController,
    private onClose: () => void,
  ) {}

  render(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'map-overlay';
    el.innerHTML = `
      <div class="map-modal camp-modal">
        <div class="camp-head">
          <h2>🏕️ 列车营地</h2>
          <div class="camp-res">
            <span>💠${this.rc.run.resources.shards}</span>
            <span>🕯️${this.rc.run.resources.obsession}</span>
            <span>🧪${this.rc.run.resources.etchant}</span>
            <span>⛓️${this.rc.run.resources.darkIron}</span>
            <span>🔥${this.rc.run.resources.soulfire}</span>
          </div>
        </div>
        ${this.rc.run.avatarForm ? '<div class="avatar-banner">🌑 灾厄化身已激活：每回合抽牌+2 · 所有牌费-1 · 溢伤连锁×2.5</div>' : ''}
        <div class="camp-tabs">
          <button data-tab="heroes" class="${this.tab === 'heroes' ? 'active' : ''}">英雄 · 执念</button>
          <button data-tab="cards" class="${this.tab === 'cards' ? 'active' : ''}">卡牌 · 升级</button>
          <button data-tab="fusion" class="${this.tab === 'fusion' ? 'active' : ''}">铭刻融合</button>
          <button data-tab="tech" class="${this.tab === 'tech' ? 'active' : ''}">列车科技</button>
        </div>
        <div class="camp-body">${this.tabBody()}</div>
        <div class="camp-foot">
          <button class="btn-camp-end" title="结束本次旅程并保存进度">结束旅程</button>
          <button class="btn-camp-leave">离开营地</button>
        </div>
      </div>`;

    el.querySelectorAll<HTMLElement>('.camp-tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as never;
        this.refresh();
      });
    });
    this.bindBody(el);
    el.querySelector('.btn-camp-leave')?.addEventListener('click', this.onClose);
    el.querySelector('.btn-camp-end')?.addEventListener('click', () => {
      this.rc.dispose();
      SaveSystem.saveRun(this.rc.run); // 进度已由自动存档保存，这里兜底
      appRef.current!.run = null;
      appRef.current?.go('title');
    });
    return el;
  }

  private refresh(): void {
    const host = document.querySelector('.camp-modal');
    if (host) host.replaceWith(this.render());
  }

  private tabBody(): string {
    switch (this.tab) {
      case 'heroes': return this.heroesTab();
      case 'cards': return this.cardsTab();
      case 'fusion': return this.fusionTab();
      case 'tech': return this.techTab();
    }
  }

  // ---------- 英雄 ----------
  private heroesTab(): string {
    return Object.values(this.rc.run.heroes).map((h) => {
      const def = registry.heroes.get(h.heroId)!;
      const thresholds = def.obsession.thresholds
        .map((t) => `${h.obsessionCount >= t.at ? '✨' : '🔒'}${t.name}`)
        .join(' ');
      return `
        <div class="camp-hero ${h.alive ? '' : 'dead'}">
          <div class="camp-hero-head">
            <span class="hero-avatar" style="background:${def.color}">${def.name[0]}</span>
            <b>${def.name}</b><span class="dim">· ${def.title}</span>
            <span class="hp-text">${h.alive ? `${h.hp}/${h.maxHp}` : '残影化'}</span>
            <span class="dim">灌注${h.obsessionCount}次 · ${thresholds}</span>
          </div>
          <div class="camp-hero-body">
            <div class="infuse-row">
              <span class="dim">灌注（${RunController.INFUSE_COST}🕯️）：</span>
              ${def.obsession.options.map((o) => `
                <button class="btn-infuse" data-hero="${h.heroId}" data-option="${o.id}" title="${o.desc}">${o.name}</button>`).join('')}
            </div>
            ${!h.alive ? `<div class="revive-row"><button class="btn-revive" data-hero="${h.heroId}">灵柩唤醒（50🔥）</button></div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ---------- 卡牌 ----------
  private cardsTab(): string {
    const counts = new Map<string, number>();
    for (const c of [...this.rc.run.deck.drawPile, ...this.rc.run.deck.hand, ...this.rc.run.deck.discardPile]) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([cardId, count]) => ({ def: registry.cards.get(cardId)!, count }))
      .filter(({ def }) => def.kind === 'hero')
      .sort((a, b) => (a.def.heroId ?? '').localeCompare(b.def.heroId ?? ''))
      .map(({ def, count }) => {
        const up = registry.nextRarity(def);
        const cost = RunController.UPGRADE_COST[def.rarity];
        const canUp = up && this.rc.run.resources.shards >= (cost ?? 0);
        return `
          <div class="camp-card rarity-${def.rarity}">
            <div class="camp-card-info">
              <b>${def.name}</b> <span class="dim">×${count} · ${RARITY_NAME[def.rarity]}</span>
              <div class="dim">${def.effects.map(describeEffect).join('；')}</div>
            </div>
            ${up ? `<button class="btn-upgrade ${canUp ? '' : 'poor'}" data-card="${def.id}">升${RARITY_NAME[up.rarity]}（${cost}💠）</button>` : '<span class="dim">已满级</span>'}
          </div>`;
      }).join('') || '<div class="dim">牌组中没有可升级的专属牌</div>';
  }

  // ---------- 融合 ----------
  private fusionTab(): string {
    const relicIds = new Set(
      [...this.rc.run.deck.drawPile, ...this.rc.run.deck.hand, ...this.rc.run.deck.discardPile]
        .filter((c) => registry.cards.get(c)?.kind === 'relic'),
    );
    const list = [...relicIds].map((id) => {
      const def = registry.cards.get(id)!;
      const sel = this.fusionA === id || this.fusionB === id ? 'selected' : '';
      return `<button class="fusion-card ${sel}" data-relic="${id}">${def.name}（${RARITY_NAME[def.rarity]}·${def.cost}费）</button>`;
    }).join('');
    const ready = this.fusionA && this.fusionB;
    return `
      <div class="dim">选择两张遗物牌进行铭刻融合：效果串联、费用A+B-1（上限4）、品质取高</div>
      <div class="fusion-list">${list || '<div class="dim">牌组中没有遗物牌</div>'}</div>
      <div class="fusion-pick">已选：${this.fusionA ? registry.cards.get(this.fusionA)?.name : '？'} ＋ ${this.fusionB ? registry.cards.get(this.fusionB)?.name : '？'}</div>
      <div class="fusion-actions">
        <button class="btn-fuse ${ready ? '' : 'poor'}" data-via="etchant">融合（1🧪蚀刻剂）</button>
        <button class="btn-fuse ${ready ? '' : 'poor'}" data-via="soulfire">车钩重铸（30🔥）</button>
      </div>`;
  }

  // ---------- 科技 ----------
  private techTab(): string {
    const tierUnlocked = Number(this.rc.run.flags['techTierUnlocked'] ?? 0);
    return [...registry.techs.values()].map((t) => {
      const owned = this.rc.run.techUnlocked.includes(t.id);
      const tierLocked = t.tier > tierUnlocked;
      const afford = this.rc.run.resources.darkIron >= t.cost;
      return `
        <div class="camp-tech ${owned ? 'owned' : ''}">
          <div class="camp-tech-info">
            <b>${t.name}</b> <span class="dim">第${t.tier}层 · ${t.cost}⛓️蚀铁</span>
            <div class="dim">${t.desc}</div>
          </div>
          ${owned ? '<span class="owned-tag">已解锁</span>'
            : `<button class="btn-tech ${tierLocked || !afford ? 'poor' : ''}" data-tech="${t.id}" ${tierLocked ? 'disabled' : ''}>${tierLocked ? `需击败第${t.tier}区Boss` : '解锁'}</button>`}
        </div>`;
    }).join('');
  }

  // ---------- 交互 ----------
  private bindBody(el: HTMLElement): void {
    const toast = (msg: string) => {
      const t = document.createElement('div');
      t.className = 'camp-toast';
      t.textContent = msg;
      el.appendChild(t);
      setTimeout(() => t.remove(), 2000);
    };

    el.querySelectorAll<HTMLElement>('.btn-infuse').forEach((b) => {
      b.addEventListener('click', () => {
        const r = this.rc.infuseHero(b.dataset.hero!, b.dataset.option!);
        toast(r.text);
        if (r.ok) this.refresh();
      });
    });
    el.querySelectorAll<HTMLElement>('.btn-revive').forEach((b) => {
      b.addEventListener('click', () => {
        const r = this.rc.reviveHero(b.dataset.hero! as HeroId);
        toast(r.text);
        if (r.ok) this.refresh();
      });
    });
    el.querySelectorAll<HTMLElement>('.btn-upgrade').forEach((b) => {
      b.addEventListener('click', () => {
        const r = this.rc.upgradeCardQuality(b.dataset.card!);
        toast(r.text);
        if (r.ok) this.refresh();
      });
    });
    el.querySelectorAll<HTMLElement>('.fusion-card').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.relic!;
        if (this.fusionA === id) this.fusionA = null;
        else if (this.fusionB === id) this.fusionB = null;
        else if (!this.fusionA) this.fusionA = id;
        else if (!this.fusionB) this.fusionB = id;
        this.refresh();
      });
    });
    el.querySelectorAll<HTMLElement>('.btn-fuse').forEach((b) => {
      b.addEventListener('click', () => {
        if (!this.fusionA || !this.fusionB) {
          toast('请选择两张遗物牌');
          return;
        }
        const r = this.rc.fuseCards(this.fusionA, this.fusionB, b.dataset.via as 'etchant' | 'soulfire');
        toast(r.text);
        if (r.ok) {
          this.fusionA = null;
          this.fusionB = null;
          this.refresh();
        }
      });
    });
    el.querySelectorAll<HTMLElement>('.btn-tech').forEach((b) => {
      b.addEventListener('click', () => {
        const r = this.rc.buyTech(b.dataset.tech!);
        toast(r.text);
        if (r.ok) this.refresh();
      });
    });
  }
}
