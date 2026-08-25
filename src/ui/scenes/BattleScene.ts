// 战斗场景：车厢战场 + 手牌规划 + 意图 + 日志 + 压力表/魂火/狂气灯
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { combatLog } from '../../core/log';
import { eventBus } from '../../core/eventBus';
import { Rng, randomSeed } from '../../core/rng';
import { createNewRun } from '../../systems/run/RunState';
import { BattleController } from '../../game/BattleController';
import type { RunController } from '../../game/RunController';
import { SaveSystem } from '../../systems/run/SaveSystem';
import { createCardEl } from '../components/CardView';
import { createSteamGauge } from '../components/SteamGauge';
import type { HeroId, HeroInstance, EnemyInstance, StatusInstance, MapNode, BattleState } from '../../core/types';
import { ASSETS, bossPhaseArt } from '../../core/assets';
import { audio } from '../fx/AudioManager';
import { RewardPanel } from '../components/RewardPanel';
import { generateRewards, type RewardOption } from '../../systems/run/RewardSystem';

interface BattleParams {
  /** 整局流程模式（地图进入） */
  rc?: RunController;
  nodeId?: string;
  monsters?: { defId: string; count: number }[];
  /** 读档恢复 */
  resume?: boolean;
  battleSnapshot?: BattleState;
  /** 调试模式（标题试玩） */
  encounterId?: string;
}

const STATUS_CHIP: Record<string, { icon: string; name: string; tip: string }> = {
  bleed: { icon: '🩸', name: '流血', tip: '流血：每回合流失2点生命' },
  vulnerable: { icon: '💔', name: '易伤', tip: '易伤：受到的伤害+30%/层' },
  fear: { icon: '😨', name: '恐惧', tip: '恐惧：造成的伤害-20%/层' },
  tenacity: { icon: '🛡️', name: '坚韧', tip: '坚韧：下次受到的伤害减半（次数耗尽消失）' },
  imprison: { icon: '⛓️', name: '禁锢', tip: '禁锢：本回合无法使用位移/加速牌' },
  healReduction: { icon: '🚫', name: '减疗', tip: '减疗：受到的治疗降低（50%/75%/100%）' },
  dodge: { icon: '💨', name: '闪避', tip: '闪避：抵挡一次攻击（次数耗尽消失）' },
  stun: { icon: '💫', name: '眩晕', tip: '眩晕：跳过本回合行动' },
  mark: { icon: '🎯', name: '标记', tip: '标记：受到的伤害+30%（部分标记有特殊联动）' },
  taunt: { icon: '📣', name: '嘲讽', tip: '嘲讽：强制敌人攻击自己（部分嘲讽被攻击时全队+魂火）' },
  strength: { icon: '💪', name: '力量', tip: '力量：攻击时附加力量值伤害' },
  revenge: { icon: '🔥', name: '复仇', tip: '复仇：复活后本场战斗伤害+50%' },
  guard: { icon: '🛡️', name: '援护', tip: '援护：替所有队友承受伤害' },
  silenceHeal: { icon: '🤫', name: '低语', tip: '低语：本回合无法使用治疗牌' },
  awakened: { icon: '⚡', name: '觉醒', tip: '觉醒：伤害+50%、受伤-25%、专属牌费-1（持续2回合）' },
  critUp: { icon: '✨', name: '暴击强化', tip: '暴击强化：提升暴击率（层数×数值）' },
  enraged: { icon: '😡', name: '暴走', tip: '暴走（敌）：伤害+50%' },
  swallowed: { icon: '🪱', name: '吞噬', tip: '吞噬：被Boss吞入腹中，对Boss累计15点伤害可救回' },
  corrosion: { icon: '🧪', name: '腐蚀', tip: '腐蚀：每回合流失4点生命（持续3回合）' },
  exhaust: { icon: '🫠', name: '虚脱', tip: '虚脱：本回合只能打出1张牌' },
  undying: { icon: '💀', name: '不灭', tip: '不灭：本回合免疫死亡（生命最低为1）' },
  madnessImmune: { icon: '🧘', name: '静心', tip: '静心：本回合免疫狂气增长' },
  slow: { icon: '🐌', name: '减速', tip: '减速：目标速度-2/层（影响行动顺序）' },
};

export class BattleScene implements Scene {
  private root!: HTMLElement;
  private controller!: BattleController;
  private runController: RunController | null = null;
  private battleNode: MapNode | null = null;
  private selected: string | null = null;
  private plan: { heroId: HeroId; cardId: string }[] = [];
  private offs: (() => void)[] = [];
  private rewardDone = false;
  private lastReward = '';

  onEnter(root: HTMLElement, params?: unknown): void {
    this.root = root;
    this.plan = [];
    this.selected = null;
    const p = (params ?? {}) as BattleParams;
    this.offs.push(eventBus.on('battleEvent', (e) => this.appendLogLine(e)));
    this.offs.push(eventBus.on('fx', (e) => this.handleFx(e)));
    this.offs.push(eventBus.on('awaken', (e) => this.handleFx({ type: 'awaken', side: 'hero', heroId: e.heroId })));

    if (p.rc && p.nodeId) {
      // 整局流程模式
      this.runController = p.rc;
      this.battleNode = p.rc.nodeById(p.nodeId);
      // Boss战切换Boss音乐
      if (this.battleNode.type === 'boss') audio.playBgm('boss');
      else audio.playBgm('battle');
      const zone = p.rc.zoneOf(p.nodeId);
      const monsters = p.monsters ?? p.rc.encounterMonsters(this.battleNode);
      const techEffects = p.rc.run.techUnlocked
        .map((id) => registry.techs.get(id)?.effectId)
        .filter((x) => !!x) as string[];
      if (p.resume && p.battleSnapshot) {
        // 读档：恢复到快照回合的规划阶段
        this.controller = BattleController.restore(
          p.rc.run, zone, p.rc.rng, techEffects, p.rc.isAvatarForm(), p.battleSnapshot,
        );
        this.controller.battle.phase = 'planning';
      } else {
        this.controller = new BattleController(p.rc.run, zone, p.rc.rng, techEffects, p.rc.isAvatarForm());
        this.controller.beginBattle(monsters);
      }
      this.saveBattleSnapshot();
    } else {
      // 调试模式
      const encounterId = p.encounterId ?? 'zone1_encounter1';
      const zone = registry.zones.get('zone1')!;
      const encounter = zone.encounters?.find((e) => e.id === encounterId) ?? zone.encounters![0];
      const run = createNewRun(randomSeed());
      this.controller = new BattleController(run, zone, new Rng(randomSeed()), []);
      this.controller.beginBattle(encounter.monsters);
    }
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
          <div class="hud-soulfire" title="魂火：溢伤转化而来，用于列车服务"><img src="${ASSETS.iconSoulfire}" class="hud-icon"/> <b>${battle.soulfire}</b></div>
          <div class="hud-energy" title="能量：每回合重置"><img src="${ASSETS.iconEnergy}" class="hud-icon"/> <b>${battle.energy}</b>/${battle.energyMax}</div>
          <div class="hud-dark ${battle.darkEnergy > 0 ? 'active' : ''}" title="暗蚀能量：本场战斗的连锁资源">🌑 ${Math.round(battle.darkEnergy * 10) / 10}</div>
          <div class="hud-zone">${controller.zone.name}</div>
          <div class="hud-gauge-slot" data-tip="列车速度：0-5
决定先手：速度 ≥ 敌方速度总和 → 我方先手
部分卡牌需要特定速度才能打出（如速度≥3眩晕）
加速牌会让英雄整体前进、怪物被甩向车尾"></div>
          <div class="hud-turn">第 ${battle.turn} 回合</div>
        </div>
        <div class="battlefield">
          ${this.bossTrack()}
          <div class="enemy-row">${this.renderEnemies()}</div>
          <div class="rail-line"><span>⬤</span><span>⬤</span><span>⬤</span><span>⬤</span></div>
          <div class="carriage-row">${this.renderCarriages()}</div>
        </div>
        <div class="battle-bottom">
          <div class="plan-row">
            <div class="plan-label">牌序规划</div>
            <div class="plan-slots">${[0, 1, 2, 3].map((i) => this.renderPlanSlot(i)).join('')}</div>
            <button class="btn-confirm" ${plan.length === 0 ? '' : 'style="border-color:var(--accent)"'}>${plan.length === 0 ? '结束回合' : `确认出牌（${plan.length}/4）`}</button>
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

  /** 战斗特效：受击/暴击/治疗/击杀/打牌动画 + 飘字 */
  private handleFx(e: { type: 'hit' | 'crit' | 'heal' | 'kill' | 'block' | 'play' | 'awaken'; side?: 'enemy' | 'hero'; heroId?: string; uid?: string; amount?: number }): void {
    const root = this.root;
    if (!root.isConnected) return;
    let el: HTMLElement | null = null;
    if (e.side === 'enemy' && e.uid) el = root.querySelector(`[data-uid="${e.uid}"]`);
    if (e.side === 'hero' && e.heroId) el = root.querySelector(`[data-hero="${e.heroId}"]`);

    if (e.type === 'play') {
      // 打牌特效：最近打出的手牌闪金光
      const hand = root.querySelectorAll('.hand-slot');
      const last = hand[hand.length - 1];
      if (last) {
        last.classList.remove('fx-play');
        void (last as HTMLElement).offsetWidth;
        last.classList.add('fx-play');
      }
      return;
    }
    if (e.type === 'awaken' && e.heroId) {
      const heroEl = root.querySelector(`[data-hero="${e.heroId}"]`);
      if (heroEl) {
        heroEl.classList.remove('fx-awaken');
        void (heroEl as HTMLElement).offsetWidth;
        heroEl.classList.add('fx-awaken');
      }
      return;
    }
    if (!el) return;
    const cls = `fx-${e.type}`;
    el.classList.remove('fx-hit', 'fx-crit', 'fx-heal', 'fx-kill', 'fx-block');
    void (el as HTMLElement).offsetWidth; // 重启动画
    el.classList.add(cls);
    // 飘字
    if (e.amount && e.amount > 0 && (e.type === 'hit' || e.type === 'crit' || e.type === 'heal')) {
      this.spawnFloat(el, e.amount, e.type);
    }
  }

  /** 伤害/治疗飘字 */
  private spawnFloat(el: HTMLElement, amount: number, type: string): void {
    const f = document.createElement('div');
    f.className = `float-text float-${type}`;
    f.textContent = `${type === 'heal' ? '+' : '-'}${amount}`;
    el.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  /** Boss推进轨道：车头→车尾4格，显示Boss位置与脱轨警告 */
  private bossTrack(): string {
    const battle = this.controller.battle;
    const boss = battle.enemies.find((e) => e.hp > 0 && registry.monsters.get(e.defId)?.bossAdvance);
    if (!boss) return '';
    const def = registry.monsters.get(boss.defId)!;
    const phase = def.phases?.[boss.phaseIndex];
    const distance = boss.pos - 1; // 距车头格数
    const danger = distance <= 1;
    const slots = [1, 2, 3, 4].map((pos) => {
      const isBossHere = boss.pos === pos;
      return `<div class="boss-track-slot ${pos === 1 ? 'front' : ''} ${isBossHere ? 'boss-here' : ''}" data-pos="${pos}">
        ${pos === 1 ? '🚂车头' : pos === 4 ? '车尾' : `${pos}号`}
        ${isBossHere ? '<div class="boss-marker">👑</div>' : ''}
      </div>`;
    }).join('');
    return `
      <div class="boss-track ${danger ? 'danger' : ''}">
        <div class="boss-track-head">
          <span>👑 ${boss.name} · ${phase?.name ?? ''}阶段</span>
          <span class="boss-warning">${danger ? `⚠️ 距车头仅${distance}格——加速牌可将其推回！` : `Boss在${boss.pos}号车厢`}</span>
        </div>
        <div class="boss-track-slots">${slots}</div>
      </div>`;
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
    const art = bossPhaseArt(e.defId, e.phaseIndex);
    return `
      <div class="enemy-unit ${isBoss ? 'boss' : ''} ${e.hp <= 0 ? 'dead' : ''}" data-uid="${e.uid}">
        <img class="enemy-art" src="${art}" alt="${e.name}" draggable="false"/>
        <div class="enemy-tag">
          <div class="enemy-name">${e.name}</div>
          <div class="enemy-intent ${stunned ? 'stunned' : ''}">${stunned ? '💫 眩晕' : (intent ? `${intent.icon} ${intent.name}` : '……')}</div>
        </div>
        <div class="enemy-hpbar"><div class="hp-fill" style="width:${hpPct}%"></div><span class="hp-text">${e.hp}/${e.maxHp}</span></div>
        ${e.block > 0 ? `<div class="block-badge">🛡️${e.block}</div>` : ''}
        ${e.statuses.length ? `<div class="status-row">${e.statuses.map((s) => this.statusChip(s)).join('')}</div>` : ''}
      </div>`;
  }

  private renderCarriages(): string {
    const battle = this.controller.battle;
    // 4节车厢连成一条列车带，英雄按1/4位置浮在对应车厢上
    const slots = [1, 2, 3, 4].map((pos) => {
      const heroes = Object.values(battle.heroes).filter((h) => h.pos === pos);
      return `<div class="carriage-pos" style="left:${((pos - 0.5) / 4) * 100}%">
        ${heroes.map((h) => this.heroCard(h)).join('') || '<div class="hero-empty">·</div>'}
      </div>`;
    }).join('');
    return `<div class="carriage-row">
      <img class="carriage-track-img" src="${ASSETS.carriageRow}" alt="列车" draggable="false"/>
      ${slots}
    </div>`;
  }

  private heroCard(h: HeroInstance): string {
    const def = this.controller.heroDef(h.heroId);
    const hpPct = Math.max(0, (h.hp / h.maxHp) * 100);
    const madness = h.madness;
    const lamp = h.awakeningTurns > 0 ? 'lamp-awakened' : madness >= 75 ? 'lamp-red' : madness >= 50 ? 'lamp-orange' : 'lamp-yellow';
    const dead = !h.alive;
    const swallowed = this.controller.engine.buffs.has(h, 'swallowed');
    return `
      <div class="hero-unit ${dead ? 'dead' : ''} ${swallowed ? 'swallowed' : ''}" data-hero="${h.heroId}" style="--hero-color:${def.color}">
        <img class="hero-art" src="${ASSETS.heroes[h.heroId]}" alt="${def.name}" draggable="false"/>
        <div class="hero-tag">
          <div class="hero-head">
            <span class="hero-name">${def.name}</span>
            <span class="madness-lamp ${lamp}" data-tip="狂气：${madness}/100
达到100触发觉醒（伤害+50%、受伤-25%、专属牌费-1）
觉醒中再满100 → 暴走" >${h.awakeningTurns > 0 ? '⚡' : '●'}</span>
          </div>
          <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div><span class="hp-text">${dead ? '残影化' : `${h.hp}/${h.maxHp}`}</span></div>
          ${h.block > 0 ? `<div class="block-badge">🛡️${h.block}</div>` : ''}
          <div class="hero-madness ${h.awakeningTurns > 0 ? 'awakening' : ''}">狂气 ${madness}${h.awakeningTurns > 0 ? ` · 觉醒${h.awakeningTurns}回合` : ''}${h.runaway ? ' · 暴走!' : ''}</div>
          ${h.statuses.length ? `<div class="status-row">${h.statuses.map((s) => this.statusChip(s)).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  private statusChip(s: StatusInstance): string {
    const meta = STATUS_CHIP[s.id] ?? { icon: '❓', name: s.id, tip: s.id };
    return `<span class="status-chip" data-tip="${meta.tip}（${meta.name}×${s.stacks}${s.duration > 0 ? `，${s.duration}回合` : ''}）">${meta.icon}${s.stacks > 1 ? s.stacks : ''}</span>`;
  }

  private renderHand(): string {
    const hand = this.controller.hand.map((cardId) => {
      const card = this.controller.cardDef(cardId)!;
      const owner = card.heroId ? this.controller.engine.battle.heroes[card.heroId] : null;
      const planIdx = this.plan.findIndex((p) => p.cardId === cardId);
      const inPlan = planIdx >= 0;
      const selectedCls = inPlan ? 'planned' : '';
      const ownerTag = card.heroId
        ? `<span class="hand-owner">${this.controller.heroDef(card.heroId).name}</span>`
        : '<span class="hand-owner relic">遗物</span>';
      const dim = owner && (!owner.alive || owner.runaway);
      const badge = inPlan
        ? `<span class="plan-badge">${planIdx + 1}</span>`
        : '';
      return `<div class="hand-slot ${selectedCls} ${dim ? 'dim' : ''}" data-card="${cardId}">${badge}${ownerTag}${createCardEl(card, { disabled: !!dim }).outerHTML}</div>`;
    }).join('');
    return hand || '<div class="hand-empty">手牌为空</div>';
  }

  /** 点击卡牌直接加入规划（或取消） */
  private togglePlan(cardId: string): void {
    const existing = this.plan.findIndex((p) => p.cardId === cardId);
    if (existing >= 0) {
      this.plan.splice(existing, 1);
      this.render();
      return;
    }
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
    this.render();
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
    const isBoss = this.battleNode?.type === 'boss';
    const victoryReward = o.result === 'victory'
      ? (isBoss ? '区域Boss被击溃——前往下一区域' : (this.battleNode?.type === 'elite' ? '精英被击溃' : '遭遇战胜利'))
      : '';
    // 本场战斗基础奖励（返回地图时结算）
    const baseReward = o.result === 'victory' && this.runController
      ? `本场奖励：执念+${isBoss ? 20 : this.battleNode?.type === 'elite' ? 10 : 5} · 残响碎片+${isBoss ? 30 : this.battleNode?.type === 'elite' ? 15 : 8}`
      : '';
    const backBtn = o.result === 'victory' && this.runController && !this.rewardDone
      ? '<button class="btn-back btn-reward">领取奖励 🎁</button>'
      : o.result === 'victory' && this.runController
        ? '<button class="btn-back">返回地图</button>'
        : '<button class="btn-back">返回标题</button>';
    return `
      <div class="battle-overlay">
        <div class="overlay-box ${o.result}">
          <h2>${o.result === 'victory' ? '🏆 ' + victoryReward : '💀 列车停摆'}</h2>
          ${o.reason ? `<p>${o.reason}</p>` : ''}
          <p class="overlay-stats">${o.turns} 回合 · 击杀 ${this.controller.engine.stats.kills} · 魂火 ${battle.soulfire}</p>
          ${baseReward ? `<p class="overlay-reward">💰 ${baseReward}</p>` : ''}
          ${this.lastReward ? `<p class="overlay-reward">🎁 ${this.lastReward}</p>` : ''}
          <p class="overlay-heroes">${heroes.map((h) => `${this.controller.engine.heroName(h.heroId)} ${h.hp}/${h.maxHp}${h.alive ? '' : '✝'}`).join(' · ')}</p>
          ${backBtn}
        </div>
      </div>`;
  }

  // ================= 交互 =================
  private bindEvents(): void {
    const q = (sel: string) => this.root.querySelectorAll<HTMLElement>(sel);

    // 手牌点击 = 直接加入/取消规划
    q('.hand-slot').forEach((el) => {
      el.addEventListener('click', () => {
        this.togglePlan(el.dataset.card!);
      });
    });

    // 规划槽：点击移除对应卡牌
    q('.plan-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.slot);
        if (this.plan[idx]) {
          this.plan.splice(idx, 1);
          this.render();
        }
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
      this.saveBattleSnapshot(); // 下一回合开始快照
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

    this.root.querySelector('.btn-reward')?.addEventListener('click', () => {
      const run = this.runController?.run;
      if (!run || this.rewardDone) return;
      // 立即锁定，防止场景重建后重复领取
      this.rewardDone = true;
      const options = generateRewards(run, this.controller.engine.ctx.rng);
      const panel = new RewardPanel(options, (opt, result) => {
        this.lastReward = result;
      }, () => {
        this.render();
      });
      this.root.appendChild(panel.render());
    });

    this.root.querySelector('.btn-back')?.addEventListener('click', () => {
      const o = this.controller.outcome;
      // 魂火回写
      this.controller.run.resources.soulfire = this.controller.battle.soulfire;
      if (o.result === 'victory' && this.runController && this.battleNode) {
        const { rewards } = this.runController.onBattleVictory(this.battleNode);
        const isBoss = this.battleNode.type === 'boss';
        const isLastZone = this.runController.run.flags['runComplete'];
        if (isBoss && isLastZone) {
          appRef.current?.go('end', { kind: 'victory' });
          return;
        }
        const banner = [isBoss ? `Boss被击溃！${rewards.join('；')}` : '', this.lastReward].filter(Boolean).join('；');
        appRef.current?.go('map', { banner });
      } else {
        appRef.current?.go('end', { kind: 'gameover', reason: o.reason });
      }
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

  /** 战斗级存档：回合开始快照（刷新页面可恢复） */
  private saveBattleSnapshot(): void {
    if (!this.runController || !this.battleNode) return;
    if (this.controller.outcome.result !== 'ongoing') return;
    SaveSystem.saveBattle(this.runController.run, this.controller.battle, this.battleNode.id);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
