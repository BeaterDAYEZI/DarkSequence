// 战斗控制器：UI ↔ 引擎 的桥（UI 只读状态 + 发命令）
import type { RunState, ZoneDef, BattleState, HeroId } from '../core/types';
import { Rng } from '../core/rng';
import { registry } from '../core/registry';
import { BattleEngine } from '../systems/battle/BattleEngine';

export class BattleController {
  engine: BattleEngine;
  techs: Set<string>;

  constructor(
    public run: RunState,
    public zone: ZoneDef,
    rng: Rng,
    techEffects: string[],
    avatarForm = false,
  ) {
    this.techs = new Set(techEffects);
    this.engine = new BattleEngine(run, zone, rng, this.techs, avatarForm);
  }

  /** 从战斗快照恢复（读档回到回合开始） */
  static restore(
    run: RunState,
    zone: ZoneDef,
    rng: Rng,
    techEffects: string[],
    avatarForm: boolean,
    battle: BattleState,
  ): BattleController {
    const c = new BattleController(run, zone, rng, techEffects, avatarForm);
    c.engine = BattleEngine.restore(run, zone, rng, c.techs, avatarForm, battle);
    return c;
  }

  get battle() {
    return this.engine.battle;
  }

  get hand(): string[] {
    return this.run.deck.hand;
  }

  /** 开战 */
  beginBattle(monsters: { defId: string; count: number }[]): void {
    this.engine.startEncounter(monsters);
    this.beginTurn();
  }

  /** 开始回合（意图揭示+抽牌） */
  beginTurn(): void {
    this.engine.beginTurn();
  }

  /** 提交规划（≤4张有序） */
  submitPlan(plan: { heroId: HeroId; cardId: string }[]): void {
    this.engine.executePlan(plan);
    // 执行完毕后若战斗未结束，自动进入下一回合
    if (this.engine.outcome.result === 'ongoing') {
      this.beginTurn();
    }
  }

  /** 规划校验错误信息 */
  planError(heroId: HeroId, cardId: string): string | null {
    return this.engine.canPlay(heroId, cardId);
  }

  useFurnace(): boolean { return this.engine.useFurnace(); }
  useHorn(): boolean { return this.engine.useHorn(); }
  canUseFurnace(): boolean { return this.engine.canUseFurnace(); }
  canUseHorn(): boolean { return this.engine.canUseHorn(); }

  get outcome() { return this.engine.outcome; }

  cardDef(cardId: string) { return registry.cards.get(cardId); }
  heroDef(heroId: HeroId) { return registry.heroes.get(heroId)!; }
}
