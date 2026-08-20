// 目标解析：TargetSelector → 具体单位，含嘲讽/援护重定向
import type { BattleEngine } from './BattleEngine';
import type { TargetSelector, HeroInstance, EnemyInstance, HeroId } from '../../core/types';
import type { UnitRef } from './context';

export class TargetResolver {
  constructor(private engine: BattleEngine) {}

  aliveHeroes(): HeroInstance[] {
    return Object.values(this.engine.ctx.battle.heroes).filter((h) => h.alive && !this.engine.buffs.has(h, 'swallowed'));
  }

  aliveEnemies(): EnemyInstance[] {
    return this.engine.ctx.battle.enemies.filter((e) => e.hp > 0);
  }

  /** 解析选择器 → 单位引用列表 */
  resolve(sel: TargetSelector | undefined, sourceHero?: HeroId): UnitRef[] {
    const battle = this.engine.ctx.battle;
    if (!sel) {
      // 默认：英雄牌作用于自身
      return sourceHero ? [{ side: 'hero', heroId: sourceHero }] : [];
    }
    const units: UnitRef[] = [];
    if (sel.side === 'ally') {
      const heroes = this.aliveHeroes();
      switch (sel.mode) {
        case 'self':
          if (sourceHero) units.push({ side: 'hero', heroId: sourceHero });
          break;
        case 'pos':
          for (const p of sel.pos ?? []) {
            for (const h of heroes) if (h.pos === p) units.push({ side: 'hero', heroId: h.heroId });
          }
          break;
        case 'front': {
          const min = Math.min(...heroes.map((h) => h.pos));
          const h = heroes.find((x) => x.pos === min);
          if (h) units.push({ side: 'hero', heroId: h.heroId });
          break;
        }
        case 'back': {
          const max = Math.max(...heroes.map((h) => h.pos));
          const h = heroes.find((x) => x.pos === max);
          if (h) units.push({ side: 'hero', heroId: h.heroId });
          break;
        }
        case 'random': {
          const pool = [...heroes];
          this.engine.ctx.rng.shuffle(pool);
          for (const h of pool.slice(0, sel.count ?? 1)) units.push({ side: 'hero', heroId: h.heroId });
          break;
        }
        case 'all':
          for (const h of heroes) units.push({ side: 'hero', heroId: h.heroId });
          break;
        case 'lowestHpAlly': {
          const sorted = [...heroes].sort((a, b) => a.hp - b.hp);
          if (sorted[0]) units.push({ side: 'hero', heroId: sorted[0].heroId });
          break;
        }
        case 'highestMadnessAlly': {
          const sorted = [...heroes].sort((a, b) => b.madness - a.madness);
          if (sorted[0]) units.push({ side: 'hero', heroId: sorted[0].heroId });
          break;
        }
        case 'random2': {
          if (heroes.length >= 2) {
            const [a, b] = this.engine.ctx.rng.shuffle([...heroes]);
            units.push({ side: 'hero', heroId: a.heroId }, { side: 'hero', heroId: b.heroId });
          }
          break;
        }
        case 'lowestHp':
        case 'marked':
          break; // 敌方模式，己方无意义
      }
    } else {
      // 敌方
      let enemies = this.aliveEnemies();
      const taunter = enemies.find((e) => this.engine.buffs.has(e, 'taunt'));
      const redirect = (list: UnitRef[]): UnitRef[] => {
        if (!taunter || sel.mode === 'all') return list;
        // 嘲讽重定向：单目标选择且嘲讽者不在目标内 → 强制攻击嘲讽者
        if (!list.some((u) => u.side === 'enemy' && u.uid === taunter.uid)) {
          return [{ side: 'enemy', uid: taunter.uid }];
        }
        return list;
      };
      switch (sel.mode) {
        case 'pos': {
          const list: UnitRef[] = [];
          for (const p of sel.pos ?? []) {
            for (const e of enemies) if (e.pos === p) list.push({ side: 'enemy', uid: e.uid });
          }
          units.push(...redirect(list));
          break;
        }
        case 'front': {
          if (enemies.length === 0) break;
          const min = Math.min(...enemies.map((e) => e.pos));
          const list = enemies.filter((e) => e.pos === min).map((e) => ({ side: 'enemy' as const, uid: e.uid }));
          units.push(...redirect(list));
          break;
        }
        case 'back': {
          if (enemies.length === 0) break;
          const max = Math.max(...enemies.map((e) => e.pos));
          const list = enemies.filter((e) => e.pos === max).map((e) => ({ side: 'enemy' as const, uid: e.uid }));
          units.push(...redirect(list));
          break;
        }
        case 'random': {
          const pool = this.engine.ctx.rng.shuffle([...enemies]);
          const list = pool.slice(0, sel.count ?? 1).map((e) => ({ side: 'enemy' as const, uid: e.uid }));
          units.push(...redirect(list));
          break;
        }
        case 'all':
          for (const e of enemies) units.push({ side: 'enemy', uid: e.uid });
          break;
        case 'lowestHp': {
          if (enemies.length === 0) break;
          const sorted = [...enemies].sort((a, b) => a.hp - b.hp);
          units.push(...redirect([{ side: 'enemy', uid: sorted[0].uid }]));
          break;
        }
        case 'marked': {
          const list = enemies.filter((e) => this.engine.buffs.has(e, 'mark')).map((e) => ({ side: 'enemy' as const, uid: e.uid }));
          units.push(...redirect(list));
          break;
        }
        case 'self':
        case 'lowestHpAlly':
        case 'highestMadnessAlly':
        case 'random2':
          break; // 无意义
      }
    }
    return units;
  }

  /** 英雄攻击时的敌方嘲讽重定向（供伤害管线检查） */
  tauntedEnemy(): EnemyInstance | undefined {
    return this.aliveEnemies().find((e) => this.engine.buffs.has(e, 'taunt'));
  }

  /** 敌方攻击英雄时的嘲讽重定向 */
  tauntingHero(): HeroInstance | undefined {
    return this.aliveHeroes().find((h) => this.engine.buffs.has(h, 'taunt'));
  }
}
