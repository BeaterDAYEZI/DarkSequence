// 状态效果系统：施加/清除/tick（流血、持续回合、眩晕、嘲讽衰减）
import type { BattleEngine } from './BattleEngine';
import type { HeroId, HeroInstance, EnemyInstance, StatusInstance, StatusId } from '../../core/types';

export type StatusTarget = HeroInstance | EnemyInstance;

const DEBUFFS: StatusId[] = ['bleed', 'vulnerable', 'fear', 'imprison', 'healReduction', 'stun', 'mark', 'silenceHeal', 'swallowed'];

export class BuffSystem {
  constructor(private engine: BattleEngine) {}

  /** 施加状态（叠加规则：同名+同duration合并层数，否则追加） */
  apply(target: StatusTarget, id: StatusId, stacks = 1, duration = -1, value?: number): void {
    if (stacks <= 0) return;
    const existing = target.statuses.find((s) => s.id === id);
    if (existing) {
      existing.stacks += stacks;
      existing.duration = Math.max(existing.duration, duration);
      if (value !== undefined) existing.value = value;
    } else {
      target.statuses.push({ id, stacks, duration, value });
    }
  }

  /** 移除状态 */
  remove(target: StatusTarget, id: StatusId): void {
    const i = target.statuses.findIndex((s) => s.id === id);
    if (i >= 0) target.statuses.splice(i, 1);
  }

  /** 清除所有负面状态（清除1层则各减1层） */
  clearDebuffs(target: StatusTarget, oneLayer = false): void {
    if (!oneLayer) {
      target.statuses = target.statuses.filter((s) => !DEBUFFS.includes(s.id));
      return;
    }
    for (const s of target.statuses) {
      if (DEBUFFS.includes(s.id)) {
        s.stacks -= 1;
        if (s.stacks <= 0) this.remove(target, s.id);
      }
    }
  }

  has(target: StatusTarget, id: StatusId): StatusInstance | undefined {
    return target.statuses.find((s) => s.id === id && s.stacks > 0);
  }

  /** 状态层数总和 */
  count(target: StatusTarget, id: StatusId): number {
    return target.statuses.filter((s) => s.id === id).reduce((a, s) => a + s.stacks, 0);
  }

  // ---------- 回合结束 tick ----------
  /** 回合结束：流血结算、持续时间衰减、回合性状态清除 */
  tickEnd(): void {
    const battle = this.engine.ctx.battle;
    for (const hero of Object.values(battle.heroes)) this.tickUnit(hero, hero.alive);
    for (const enemy of battle.enemies) this.tickUnit(enemy, enemy.hp > 0);
  }

  private tickUnit(target: StatusTarget, active: boolean): void {
    if (!active) return;
    // 流血：每层2点伤害
    const bleed = this.has(target, 'bleed');
    if (bleed) {
      this.engine.rawDamage(target, bleed.stacks * 2, { source: 'bleed', bypassBlock: true });
      this.decay(target, bleed);
    }
    // 其余持续时间衰减
    for (const s of [...target.statuses]) {
      if (s.duration > 0) {
        s.duration -= 1;
        if (s.duration <= 0) this.remove(target, s.id);
      }
    }
  }

  private decay(target: StatusTarget, status: StatusInstance): void {
    if (status.duration > 0) {
      status.duration -= 1;
      if (status.duration <= 0) this.remove(target, status.id);
    }
  }

  /** 眩晕剩余回合 -1（回合开始时由引擎调用） */
  tickStun(target: StatusTarget): void {
    const stun = this.has(target, 'stun');
    if (stun && stun.duration > 0) {
      stun.duration -= 1;
      if (stun.duration <= 0) this.remove(target, 'stun');
    }
  }

  /** 击杀治疗标记（value=2）：被标记目标死亡时全队恢复10点生命 */
  markDeathTriggers(enemy: EnemyInstance): void {
    if (!this.has(enemy, 'mark')) return;
    const mark = this.has(enemy, 'mark')!;
    if (mark.value === 2) {
      this.engine.log(`被标记的目标死亡，全队恢复10点生命`, 'heal');
      for (const hero of Object.values(this.engine.ctx.battle.heroes)) {
        if (hero.alive) this.engine.healHero(hero.heroId, 10);
      }
    }
  }

  /** 标记联动（value=1）：被标记目标受伤时奥瑞斯+1临时力量 */
  markHitTrigger(enemy: EnemyInstance): void {
    const mark = this.has(enemy, 'mark');
    if (mark && mark.value === 1) {
      const auris = this.engine.ctx.battle.heroes['auris'];
      if (auris && auris.alive && !this.has(auris, 'swallowed')) {
        this.apply(auris, 'strength', 1, 1);
      }
    }
  }

  /** 嘲讽联动（value>0）：持嘲讽者被攻击时全队获得魂火 */
  tauntHitTrigger(target: StatusTarget): void {
    const taunt = this.has(target, 'taunt');
    if (taunt && taunt.value && taunt.value > 0) {
      this.engine.gainSoulfire(taunt.value);
    }
  }

  /** 唤醒英雄检查（serafina 阈值"丧钟"等钩子在引擎中处理） */
  heroStatuses(heroId: HeroId): StatusInstance[] {
    return this.engine.ctx.battle.heroes[heroId].statuses;
  }
}
