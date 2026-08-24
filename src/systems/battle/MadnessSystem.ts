// 狂气系统：狂气增减、觉醒触发、暴走失控
import type { BattleEngine } from './BattleEngine';
import type { HeroId } from '../../core/types';
import { eventBus } from '../../core/eventBus';

const MADNESS_MAX = 100;

export class MadnessSystem {
  constructor(private engine: BattleEngine) {}

  /** 狂气+（达到100触发觉醒/暴走），返回是否觉醒 */
  gain(heroId: HeroId, amount: number, note?: string): boolean {
    const hero = this.engine.ctx.battle.heroes[heroId];
    if (!hero || !hero.alive) return false;
    const before = hero.madness;
    hero.madness = Math.min(MADNESS_MAX, hero.madness + amount);
    this.engine.log(`${this.engine.heroName(heroId)} 狂气 ${before} → ${hero.madness}`, 'madness');
    if (hero.madness >= MADNESS_MAX) {
      if (hero.awakeningTurns > 0) {
        this.rampage(heroId, note);
        return false;
      }
      this.awaken(heroId);
      return true;
    }
    return false;
  }

  /** 狂气-（塞拉芬娜转移/奥瑞斯安全刹车） */
  reduce(heroId: HeroId, amount: number): number {
    const hero = this.engine.ctx.battle.heroes[heroId];
    if (!hero || !hero.alive) return 0;
    const reduced = Math.min(hero.madness, amount);
    hero.madness -= reduced;
    this.engine.log(`${this.engine.heroName(heroId)} 狂气 -${reduced}（剩余 ${hero.madness}）`, 'madness');
    return reduced;
  }

  /** 清空狂气 */
  clear(heroId: HeroId): void {
    const hero = this.engine.ctx.battle.heroes[heroId];
    if (!hero) return;
    if (hero.madness > 0) {
      hero.madness = 0;
      this.engine.log(`${this.engine.heroName(heroId)} 的狂气被清空`, 'madness');
    }
  }

  /** 觉醒：可控爆发窗口 */
  private awaken(heroId: HeroId): void {
    const hero = this.engine.ctx.battle.heroes[heroId];
    const def = this.engine.registry.heroes.get(heroId)!;
    const firstThisBattle = !this.engine.battleAwakenedThisBattle(heroId);
    let duration = def.awakening.duration;
    // 回响增幅科技：每场战斗首次觉醒 +1回合
    if (firstThisBattle && this.engine.ctx.techs.has('echoAmplify')) duration += 1;
    hero.madness = 0;
    hero.awakeningTurns = duration;
    this.engine.buffs.apply(hero, 'awakened', 1, duration);
    this.engine.log(`⚡ ${this.engine.heroName(heroId)} 觉醒！持续${duration}回合（伤害+50%，受伤-25%，专属牌费-1）`, 'system');
    this.engine.markAwakened(heroId);
    eventBus.emit('awaken', { heroId });
    // 塞拉芬娜阈值"丧钟"：自身觉醒时全队恢复8点生命
    if (this.engine.hasThreshold(heroId, 'deathKnell')) {
      this.engine.log('丧钟触发：全队恢复8点生命', 'heal');
      for (const h of Object.values(this.engine.ctx.battle.heroes)) {
        if (h.alive) this.engine.healHero(h.heroId, 8);
      }
    }
  }

  /** 暴走：觉醒中狂气再次爆表——失控惩罚 */
  private rampage(heroId: HeroId, note?: string): void {
    const hero = this.engine.ctx.battle.heroes[heroId];
    hero.awakeningTurns = 0;
    hero.madness = 0;
    hero.runaway = true;
    this.engine.buffs.remove(hero, 'awakened');
    this.engine.log(`💥 ${this.engine.heroName(heroId)} 暴走！觉醒中断，受到20点真实伤害，本回合无法行动`, 'system');
    this.engine.rawDamage(hero, 20, { source: 'rampage', bypassBlock: true });
  }

  /** 觉醒剩余回合 tick（回合结束 -1） */
  tickEnd(): void {
    for (const hero of Object.values(this.engine.ctx.battle.heroes)) {
      if (hero.awakeningTurns > 0) {
        hero.awakeningTurns -= 1;
        if (hero.awakeningTurns <= 0) {
          this.engine.buffs.remove(hero, 'awakened');
          this.engine.log(`${this.engine.heroName(hero.heroId)} 的觉醒消退`, 'system');
          eventBus.emit('awakenEnd', { heroId: hero.heroId });
        }
      }
      hero.runaway = false;
    }
  }
}
