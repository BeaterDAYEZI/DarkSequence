// 战斗场景：车厢战场 + 手牌规划 + 意图 + 日志 + 压力表/魂火/狂气灯
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { combatLog } from '../../core/log';
import { eventBus } from '../../core/eventBus';
import { Rng, randomSeed } from '../../core/rng';
import { createNewRun } from '../../systems/run/RunState';
import { BattleController } from '../../game/BattleController';
import { createCardEl } from '../components/CardView';
import { createSteamGauge } from '../components/SteamGauge';
import type { HeroId, HeroInstance, EnemyInstance, StatusInstance } from '../../core/types';

const STATUS_CHIP: Record<string, { icon: string; name: string }> = {
  bleed: { icon: '🩸', name: '流血' }, vulnerable: { icon: '💔', name: '易伤' },
  fear: { icon: '😨', name: '恐惧' }, tenacity: { icon: '🛡️', name: '坚韧' },
  imprison: { icon: '⛓️', name: '禁锢' }, healReduction: { icon: '🚫', name: '减疗' },
  dodge: { icon: '💨', name: '闪避' }, stun: { icon: '💫', name: '眩晕' },
  mark: { icon: '🎯', name: '标记' }, taunt: { icon: '📣', name: '嘲讽' },
  strength: { icon: '💪', name: '力量' }, revenge: { icon: '🔥', name: '复仇' },
  guard: { icon: '🛡️', name: '援护' }, silenceHeal: { icon: '🤫', name: '低语' },
  awakened: { icon: '⚡', name: '觉醒' }, critUp: { icon: '✨', name: '暴击强化' },
  enraged: { icon: '😡', name: '暴走' }, swallowed: { icon: '🪱', name: '吞噬' },
};

export class BattleScene implements Scene {
  private root!: HTMLElement;
  private controller!: BattleController;
  private selected: string | null = null;
  private plan: { heroId: HeroId; cardId: string }[] = [];
  private offs: (() => void)[] = [];

  onEnter(root: HTMLElement, params?: unknown): void {
    this.root = root;
    const encounterId = (params as { encounterId?: string } | undefined)?.encounterId ?? 'zone1_encounter1';
    const zone = registry.zones.get('zone1')!;
    const encounter = zone.encounters?.find((e) => e.id === encounterId) ?? zone.encounters![0];
    const run = createNewRun(randomSeed());
    this.controller = new BattleController(run, zone, new Rng(randomSeed()), []);
    this.plan = [];
    this.selected = null;
    this.offs.push(eventBus.on('battleEvent', (e) => this.appendLogLine(e)));
    this.controller.beginBattle(encounter.monsters);
    this.render();
  }

  onExit(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  // ================= 渲染 =================
  private render(): void {
    const { controller, plan } = this;
    const battle = controller.battle;
    const gauge = createSteamGauge();
    gauge.setSpeed(battle.trainSpeed);

    this.root.innerHTML = `
      <div class="battle-scene">
        <div class="battle-top">
          <div class="hud-soulfire" title="魂火：溢伤转化而来，用于列车服务">🔥 <b>${battle.soulfire}</b></div>
          <div class="hud-energy" title="能量：每回合重置">⚡ <b>${battle.energy}</b>/${battle.energyMax}</div>
          <div class="hud-dark ${battle.darkEnergy > 0 ? 'active' : ''}" title="暗蚀能量：本场战斗的连锁资源">🌑 ${Math.round(battle.darkEnergy * 10) / 10}</div>
          <div class="hud-zone">${controller.zone.name}</div>
          <div class="hud-gauge-slot"></div>
          <div class="hud-turn">第 ${battle.turn} 回合</div>
        </div>
        <div class="battlefield">
          <div class="enemy-row">${this.renderEnemies()}</div>
          <div class="rail-line"><span>⬤</span><span>⬤</span><span>⬤</span><span>⬤</span></div>
          <div class="carriage-row">${this.renderCarriages()}</div>
        </div>
        <div class="battle-bottom">
          <div class="plan-row">
            <div class="plan-label">牌序规划</div>
            <div class="plan-slots">${[0, 1, 2, 3].map((i) => this.renderPlanSlot(i)).join('')}</div>
            <button class="btn-confirm" ${plan.length === 0 ? '' : 'style="border-color:var(--accent)"'}>${plan.length === 0 ? '结束回合' : `确认出牌（${plan.length}/4）`}</button>
            <button class="btn-soulfire ${controller.canUseFurnace() ? '' : 'disabled'}" title="炉火升温：10魂火，本回合起全队攻击+20%（可叠加）">🔥炉火 10</button>
            <button class="btn-soulfire ${controller.canUseHorn() ? '' : 'disabled'}" title="鸣笛威慑：30魂火，强制所有敌人后退1格">📯鸣笛 30</button>
          </div>
          <div class="hand-row">${this.renderHand()}</div>
        </div>
        <div class="log-panel">
          <div class="log-title">战斗日志</div>
          <div class="log-list">${combatLog.getEntries().slice(-200).map((e) => `<div class="log-line log-${e.kind}">${escapeHtml(e.text)}</div>`).join('')}</div>
        </div>
        <div class="toast hidden" id="toast"></div>
        ${this.outcomeOverlay()}
      </div>
    `;

    this.root.querySelector<HTMLElement>('.hud-gauge-slot')!.appendChild(gauge.el);
    this.bindEvents();
    // 日志滚到底部
    const logList = this.root.querySelector<HTMLElement>('.log-list')!;
    logList.scrollTop = logList.scrollHeight;
  }

  private renderEnemies(): string {
    const battle = this.controller.battle;
    const alive = battle.enemies.filter((e) => e.hp > 0);
    if (alive.length === 0) return '<div class="enemy-empty">敌人已被肃清</div>';
    const slots = [1, 2, 3, 4].map((pos) => {
      const list = alive.filter((e) => e.pos === pos);
      if (list.length === 0) return `<div class="enemy-slot empty" data-pos="${pos}"></div>`;
      return `<div class="enemy-slot" data-pos="${pos}">${list.map((e) => this.enemyCard(e)).join('')}</div>`;
    }).join('');
    return `<div class="enemy-slots">${slots}</div>`;
  }

  private enemyCard(e: EnemyInstance): string {
    const hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
    const intent = e.intent;
    const isBoss = registry.monsters.get(e.defId)?.bossAdvance;
    const stunned = this.controller.engine.buffs.has(e, 'stun');
    return `
      <div class="enemy-card ${isBoss ? 'boss' : ''} ${e.hp <= 0 ? 'dead' : ''}">
        <div class="enemy-head"><span class="enemy-name">${e.name}</span><span class="enemy-speed">速${e.speed}</span></div>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div><span class="hp-text">${e.hp}/${e.maxHp}</span></div>
        ${e.block > 0 ? `<div class="block-badge">🛡️${e.block}</div>` : ''}
        <div class="enemy-intent ${stunned ? 'stunned' : ''}">${stunned ? '💫 眩晕' : (intent ? `${intent.icon} ${intent.name}` : '……')}</div>
        ${e.statuses.length ? `<div class="status-row">${e.statuses.map((s) => this.statusChip(s)).join('')}</div>` : ''}
      </div>`;
  }

  private renderCarriages(): string {
    const battle = this.controller.battle;
    const carriageNames = ['', '煤水车', '客厢', '瞭望台', '车尾平台'];
    const carriageNotes = ['', '近战+10% 远程-20%', '', '远程+10% 近战-20%', '攻击-10% 治疗+20%'];
    return [1, 2, 3, 4].map((pos) => {
      const heroes = Object.values(battle.heroes).filter((h) => h.pos === pos);
      return `
        <div class="carriage-slot" data-pos="${pos}">
          <div class="carriage-head"><span>${pos}号·${carriageNames[pos]}</span><span class="carriage-note">${carriageNotes[pos]}</span></div>
          <div class="carriage-heroes">${heroes.map((h) => this.heroCard(h)).join('') || '<div class="hero-empty">·</div>'}</div>
        </div>`;
    }).join('');
  }

  private heroCard(h: HeroInstance): string {
    const def = this.controller.heroDef(h.heroId);
    const hpPct = Math.max(0, (h.hp / h.maxHp) * 100);
    const madness = h.madness;
    const lamp = h.awakeningTurns > 0 ? 'lamp-awakened' : madness >= 75 ? 'lamp-red' : madness >= 50 ? 'lamp-orange' : 'lamp-yellow';
    const dead = !h.alive;
    const swallowed = this.controller.engine.buffs.has(h, 'swallowed');
    return `
      <div class="hero-card ${dead ? 'dead' : ''} ${swallowed ? 'swallowed' : ''}" style="--hero-color:${def.color}">
        <div class="hero-head">
          <span class="hero-avatar">${def.name[0]}</span>
          <span class="hero-name">${def.name}</span>
          <span class="madness-lamp ${lamp}" title="狂气 ${madness}/100">${h.awakeningTurns > 0 ? '⚡' : '●'}</span>
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div><span class="hp-text">${dead ? '残影化' : `${h.hp}/${h.maxHp}`}</span></div>
        ${h.block > 0 ? `<div class="block-badge">🛡️${h.block}</div>` : ''}
        <div class="hero-madness ${h.awakeningTurns > 0 ? 'awakening' : ''}">狂气 ${madness}${h.awakeningTurns > 0 ? ` · 觉醒${h.awakeningTurns}回合` : ''}${h.runaway ? ' · 暴走!' : ''}</div>
        ${h.statuses.length ? `<div class="status-row">${h.statuses.map((s) => this.statusChip(s)).join('')}</div>` : ''}
      </div>`;
  }

  private statusChip(s: StatusInstance): string {
    const meta = STATUS_CHIP[s.id] ?? { icon: '❓', name: s.id };
    return `<span class="status-chip" title="${meta.name}×${s.stacks}${s.duration > 0 ? `（${s.duration}回合）` : ''}">${meta.icon}${s.stacks > 1 ? s.stacks : ''}</span>`;
  }

  private renderHand(): string {
    const hand = this.controller.hand.map((cardId) => {
      const card = this.controller.cardDef(cardId)!;
      const owner = card.heroId ? this.controller.engine.battle.heroes[card.heroId] : null;
      const selectedCls = this.selected === cardId ? 'selected' : '';
      const ownerTag = card.heroId
        ? `<span class="hand-owner">${this.controller.heroDef(card.heroId).name}</span>`
        : '<span class="hand-owner relic">遗物</span>';
      const dim = owner && (!owner.alive || owner.runaway);
      return `<div class="hand-slot ${selectedCls} ${dim ? 'dim' : ''}" data-card="${cardId}">${ownerTag}${createCardEl(card, { disabled: !!dim }).outerHTML}</div>`;
    }).join('');
    return hand || '<div class="hand-empty">手牌为空</div>';
  }

  private renderPlanSlot(i: number): string {
    const entry = this.plan[i];
    if (!entry) return `<div class="plan-slot empty" data-slot="${i}"><span class="slot-num">${i + 1}</span></div>`;
    const card = this.controller.cardDef(entry.cardId)!;
    const cost = this.controller.engine.cardCost(entry.heroId, card);
    return `<div class="plan-slot filled" data-slot="${i}"><span class="slot-num">${i + 1}</span>
      <div class="slot-card">${this.controller.heroDef(entry.heroId).name} · ${card.name}（${cost}费）</div></div>`;
  }

  private outcomeOverlay(): string {
    const o = this.controller.outcome;
    if (o.result === 'ongoing') return '';
    const battle = this.controller.battle;
    const heroes = Object.values(battle.heroes);
    return `
      <div class="battle-overlay">
        <div class="overlay-box ${o.result}">
          <h2>${o.result === 'victory' ? '🏆 遭遇战胜利' : '💀 列车停摆'}</h2>
          ${o.reason ? `<p>${o.reason}</p>` : ''}
          <p class="overlay-stats">${o.turns} 回合 · 击杀 ${this.controller.engine.stats.kills} · 魂火 ${battle.soulfire}</p>
          <p class="overlay-heroes">${heroes.map((h) => `${this.controller.engine.heroName(h.heroId)} ${h.hp}/${h.maxHp}${h.alive ? '' : '✝'}`).join(' · ')}</p>
          <button class="btn-back">返回标题</button>
        </div>
      </div>`;
  }

  // ================= 交互 =================
  private bindEvents(): void {
    const q = (sel: string) => this.root.querySelectorAll<HTMLElement>(sel);

    // 手牌选择
    q('.hand-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.card!;
        if (this.selected === cardId) {
          this.selected = null;
        } else {
          this.selected = cardId;
        }
        this.render();
      });
    });

    // 规划槽：放置/移除
    q('.plan-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.slot);
        if (this.plan[idx]) {
          this.plan.splice(idx, 1);
          this.render();
          return;
        }
        if (!this.selected) {
          this.toast('先选择一张手牌');
          return;
        }
        const cardId = this.selected;
        const card = this.controller.cardDef(cardId)!;
        // 遗物牌自动分配给第一个可打出的英雄
        let heroId: HeroId | undefined = card.heroId;
        if (!heroId) {
          for (const hid of ['warwick', 'morgan', 'serafina', 'auris'] as HeroId[]) {
            if (this.tryPlanError(hid, cardId) === null) {
              heroId = hid;
              break;
            }
          }
          if (!heroId) {
            this.toast('没有英雄能打出这张遗物牌');
            return;
          }
        }
        const err = this.tryPlanError(heroId, cardId);
        if (err) {
          this.toast(err);
          return;
        }
        this.plan.push({ heroId, cardId });
        this.selected = null;
        this.render();
      });
    });

    // 确认出牌
    this.root.querySelector('.btn-confirm')?.addEventListener('click', () => {
      if (this.controller.outcome.result !== 'ongoing') return;
      this.controller.submitPlan(this.plan);
      this.plan = [];
      this.selected = null;
      // 魂火回写
      if (this.controller.outcome.result !== 'ongoing') {
        this.controller.run.resources.soulfire = this.controller.battle.soulfire;
      }
      this.render();
    });

    // 魂火服务
    this.root.querySelectorAll('.btn-soulfire').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.classList.contains('disabled')) {
          this.toast('魂火不足');
          return;
        }
        const isFurnace = el.textContent!.includes('炉火');
        const ok = isFurnace ? this.controller.useFurnace() : this.controller.useHorn();
        if (!ok) this.toast('魂火不足');
        this.render();
      });
    });

    this.root.querySelector('.btn-back')?.addEventListener('click', () => {
      appRef.current?.go('title');
    });
  }

  /** 含已规划费用核算的校验 */
  private tryPlanError(heroId: HeroId, cardId: string): string | null {
    const err = this.controller.planError(heroId, cardId);
    if (err) return err;
    // 能量核算：已规划的消耗 + 本张
    let remaining = this.controller.battle.energy;
    for (const p of this.plan) {
      remaining -= this.controller.engine.cardCost(p.heroId, this.controller.cardDef(p.cardId)!);
    }
    const card = this.controller.cardDef(cardId)!;
    const cost = this.controller.engine.cardCost(heroId, card);
    if (cost > remaining) return `能量不足（剩余${remaining}，需要${cost}）`;
    return null;
  }

  private appendLogLine(e: { text: string; kind: string }): void {
    const list = this.root.querySelector('.log-list');
    if (!list) return;
    const div = document.createElement('div');
    div.className = `log-line log-${e.kind}`;
    div.textContent = e.text;
    list.appendChild(div);
    // 截断
    while (list.children.length > 300) list.removeChild(list.firstChild!);
    list.scrollTop = list.scrollHeight;
  }

  private toast(msg: string): void {
    const t = this.root.querySelector<HTMLElement>('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 1600);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
