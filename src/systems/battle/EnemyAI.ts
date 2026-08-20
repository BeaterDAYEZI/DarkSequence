// 敌人AI：意图决定（pattern/条件/冷却）+ 行动执行 + 特殊行动
import type { BattleEngine } from './BattleEngine';
import type { EnemyInstance, MonsterActionDef } from '../../core/types';

export class EnemyAI {
  constructor(private engine: BattleEngine) {}

  /** 当前阶段可用行动表 */
  availableActions(enemy: EnemyInstance): MonsterActionDef[] {
    const def = this.engine.registry.monsters.get(enemy.defId)!;
    if (def.phases && def.phases.length > 0) {
      const ratio = enemy.hp / enemy.maxHp;
      // 阶段 = hpThreshold >= 当前血量比例 的最小阈值阶段
      const phase = [...def.phases].reverse().find((p) => p.hpThreshold >= ratio) ?? def.phases[0];
      enemy.phaseIndex = def.phases.indexOf(phase);
      return phase.actions;
    }
    return def.actions;
  }

  /** 判定行动可用性（冷却/首回合/条件） */
  isActionAvailable(enemy: EnemyInstance, action: MonsterActionDef, turn: number): boolean {
    if (action.cooldown && (enemy.cooldowns[action.id] ?? 0) > 0) return false;
    if (action.firstUseTurn && turn < action.firstUseTurn) return false;
    if (action.condition) return this.engine.checkEnemyCondition(enemy, action.condition);
    return true;
  }

  /** 选择本回合意图 */
  pickIntent(enemy: EnemyInstance): MonsterActionDef | null {
    const def = this.engine.registry.monsters.get(enemy.defId)!;
    const turn = this.engine.ctx.battle.turn;
    const actions = this.availableActions(enemy);
    const available = actions.filter((a) => this.isActionAvailable(enemy, a, turn));
    if (available.length === 0) return null;

    let action: MonsterActionDef;
    if (def.ai.pattern === 'cycle') {
      // 从游标开始找下一个可用
      for (let step = 0; step < actions.length; step++) {
        const idx = (enemy.aiIndex + step) % actions.length;
        const candidate = actions[idx];
        if (this.isActionAvailable(enemy, candidate, turn)) {
          enemy.aiIndex = (idx + 1) % actions.length;
          action = candidate;
          break;
        }
      }
      action = available[0];
    } else if (def.ai.pattern === 'priority') {
      const weights = def.ai.weights ?? available.map(() => 1);
      const idx = this.engine.ctx.rng.weightedIndex(weights);
      action = available[Math.min(idx, available.length - 1)];
    } else {
      action = this.engine.ctx.rng.pick(available);
    }
    enemy.intent = { actionId: action.id, name: action.name, icon: action.icon, desc: action.desc ?? '' };
    return action;
  }

  /** 执行意图行动 */
  executeIntent(enemy: EnemyInstance): void {
    const action = this.enemyActionById(enemy, enemy.intent?.actionId);
    if (!action) return;
    this.engine.log(`— ${enemy.name} 使用【${action.icon} ${action.name}】`, 'system');

    if (action.special === 'rearmStealth') {
      enemy.stealthArmed = true;
    }
    if (action.special === 'memoryRail') {
      this.engine.executeMemoryRail(enemy);
    }

    this.engine.resolver.resolve(action.effects, {
      source: { side: 'enemy', enemyUid: enemy.uid },
    });

    if (action.cooldown) enemy.cooldowns[action.id] = action.cooldown;
  }

  private enemyActionById(enemy: EnemyInstance, actionId?: string): MonsterActionDef | undefined {
    if (!actionId) return undefined;
    const all = this.availableActions(enemy);
    return all.find((a) => a.id === actionId);
  }

  /** 回合结束：冷却递减 */
  tickCooldowns(): void {
    for (const enemy of this.engine.ctx.battle.enemies) {
      for (const key of Object.keys(enemy.cooldowns)) {
        if (enemy.cooldowns[key] > 0) enemy.cooldowns[key] -= 1;
      }
    }
  }
}
