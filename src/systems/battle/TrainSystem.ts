// 列车系统：列车速度、英雄车厢轮转、敌方拉拽/后退/换位、Boss推进
import type { BattleEngine } from './BattleEngine';
import type { CarriagePos, HeroId, EnemyInstance } from '../../core/types';

const SPEED_MIN = 0;
const SPEED_MAX = 5;
const POS_MIN = 1;
const POS_MAX = 4;

export class TrainSystem {
  constructor(private engine: BattleEngine) {}

  get speed(): number {
    return this.engine.ctx.battle.trainSpeed;
  }

  /** 列车变速：加速=英雄整体前进1格（1号→车尾轮转）+ Boss被推开；减速相反 */
  changeSpeed(delta: number): void {
    if (delta === 0) return;
    const battle = this.engine.ctx.battle;
    const before = battle.trainSpeed;
    battle.trainSpeed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, battle.trainSpeed + delta));
    const actual = battle.trainSpeed - before;
    if (actual === 0) {
      this.engine.log(`列车速度已到极限（${battle.trainSpeed}）`, 'info');
      return;
    }
    this.engine.log(`🚂 列车速度 ${before} → ${battle.trainSpeed}${actual > 0 ? '（加速）' : '（减速）'}`, 'system');
    if (actual > 0) {
      // 英雄整体前进：1号车厢的英雄被挤到车尾（4号位）
      for (const hero of Object.values(battle.heroes)) {
        hero.pos = this.forward(hero.pos);
      }
      // Boss被推开回位（向车尾）
      for (const e of battle.enemies) {
        if (this.isBoss(e)) e.pos = Math.min(POS_MAX, e.pos + actual);
      }
    } else {
      // 减速：英雄整体后退
      for (const hero of Object.values(battle.heroes)) {
        hero.pos = this.backward(hero.pos);
      }
    }
    battle.speedPlayedThisTurn += actual;
  }

  /** 前进：pos1 → pos4，其余 -1 */
  forward(pos: number): CarriagePos {
    return ((pos - 2 + 4) % 4 + 1) as CarriagePos;
  }

  /** 后退：pos4 → pos1，其余 +1 */
  backward(pos: number): CarriagePos {
    return ((pos % 4) + 1) as CarriagePos;
  }

  /** 拉拽：指定位置敌人拖到1号位，其余前移 */
  pull(targetPos: number): void {
    const battle = this.engine.ctx.battle;
    const enemies = battle.enemies.filter((e) => e.hp > 0);
    const target = enemies.find((e) => e.pos === targetPos);
    if (!target) {
      this.engine.log(`拉拽落空：${targetPos}号位没有敌人`, 'info');
      return;
    }
    if (this.isRooted(target)) {
      this.engine.log(`${target.name} 扎根在原地，无法被拉拽`, 'info');
      return;
    }
    this.engine.log(`⛓️ ${target.name} 被拉拽至1号位`, 'system');
    for (const e of enemies) {
      if (e.uid === target.uid) continue;
      if (e.pos < targetPos) e.pos = Math.min(POS_MAX, e.pos + 1);
    }
    target.pos = 1;
  }

  /** 后退1格（敌方/英雄通用） */
  pushBack(target: EnemyInstance): void {
    if (this.isRooted(target)) {
      this.engine.log(`${target.name} 扎根在原地，无法被推开`, 'info');
      return;
    }
    target.pos = Math.min(POS_MAX, target.pos + 1);
    this.engine.log(`${target.name} 被推开（现在${target.pos}号位）`, 'info');
  }

  /** 全体敌人后退1格（鸣笛威慑/列车冲锋橙） */
  pushAllEnemies(): void {
    for (const e of this.engine.ctx.battle.enemies) {
      if (e.hp > 0) this.pushBack(e);
    }
  }

  /** 全体英雄后退1格（Boss蚀雾挽歌，允许同车厢压缩） */
  pushAllHeroes(): void {
    for (const hero of Object.values(this.engine.ctx.battle.heroes)) {
      hero.pos = Math.min(POS_MAX, hero.pos + 1) as CarriagePos;
    }
    this.engine.log('全体英雄被向后推1格（阵型压缩）', 'info');
  }

  /** 交换两名英雄车厢 */
  swapHeroes(a: HeroId, b: HeroId): void {
    const battle = this.engine.ctx.battle;
    const ha = battle.heroes[a];
    const hb = battle.heroes[b];
    const tmp = ha.pos;
    ha.pos = hb.pos;
    hb.pos = tmp;
    this.engine.log(`🔀 ${this.engine.heroName(a)} 与 ${this.engine.heroName(b)} 交换了车厢位置`, 'system');
  }

  /** 扰乱敌人站位（随机交换位置） */
  shuffleEnemies(): void {
    const alive = this.engine.ctx.battle.enemies.filter((e) => e.hp > 0 && !this.isRooted(e));
    const positions = alive.map((e) => e.pos);
    this.engine.ctx.rng.shuffle(positions);
    alive.forEach((e, i) => {
      e.pos = positions[i];
    });
    this.engine.log('🔀 敌人的站位被打乱', 'system');
  }

  /** Boss每回合推进1格；抵达1号位触发脱轨团灭 */
  bossAdvance(): boolean {
    const battle = this.engine.ctx.battle;
    for (const e of battle.enemies) {
      if (this.isBoss(e) && e.hp > 0) {
        e.pos = Math.max(POS_MIN, e.pos - 1);
        this.engine.log(`🪱 Boss向车头推进！现在${e.pos}号车厢`, 'system');
        if (e.pos <= POS_MIN) {
          this.engine.log('🚨 Boss抵达车头——列车脱轨！', 'system');
          return true; // 团灭
        }
      }
    }
    return false;
  }

  /** 当前站位检查：英雄是否在指定车厢 */
  heroAtPos(heroId: HeroId, pos: number): boolean {
    return this.engine.ctx.battle.heroes[heroId].pos === pos;
  }

  isBoss(e: EnemyInstance): boolean {
    return !!this.engine.registry.monsters.get(e.defId)?.bossAdvance;
  }

  private isRooted(e: EnemyInstance): boolean {
    return (this.engine.registry.monsters.get(e.defId)?.traits ?? []).some((t) => t.id === 'rooted');
  }
}
