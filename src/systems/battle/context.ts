// 战斗公共上下文：子系统通过 engine 相互协作，避免循环依赖
import type { HeroId, RunState, BattleState, ZoneDef, HeroInstance, EnemyInstance } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { BattleEngine } from './BattleEngine';

export interface BattleCtx {
  run: RunState;
  battle: BattleState;
  rng: Rng;
  zone: ZoneDef;
  /** 本场生效的科技 effectId 集合 */
  techs: Set<string>;
  /** 灾厄化身是否激活 */
  avatar: boolean;
}

export type UnitRef =
  | { side: 'hero'; heroId: HeroId }
  | { side: 'enemy'; uid: string };

/** 已解锁科技判断 */
export function hasTech(ctx: BattleCtx, effectId: string): boolean {
  return ctx.techs.has(effectId);
}

/** 魂火上限（魂火冷凝科技 100→150） */
export function soulfireCap(ctx: BattleCtx): number {
  return hasTech(ctx, 'soulfireCondense') ? 150 : 100;
}

/** 溢伤转化魂火比例（基础10%，魂火冷凝15%，魂火引擎遗物+10%） */
export function soulfireRatio(ctx: BattleCtx): number {
  const base = hasTech(ctx, 'soulfireCondense') ? 0.15 : 0.1;
  return base + (ctx.run.relics.includes('relic_engine') ? 0.1 : 0);
}

export type Engine = BattleEngine;

/** 便捷：取英雄/敌人实例引用 */
export function heroOf(ctx: BattleCtx, heroId: HeroId): HeroInstance | undefined {
  return ctx.battle.heroes[heroId];
}

export function enemyOf(ctx: BattleCtx, uid: string): EnemyInstance | undefined {
  return ctx.battle.enemies.find((e) => e.uid === uid);
}
