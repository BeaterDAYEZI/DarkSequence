// 伤害管线：闪避/援护/嘲讽 → 伤害修正 → 暴击 → 格挡 → 荆棘 → 溢伤连锁 → 死亡结算
import type { BattleEngine } from './BattleEngine';
import type { HeroId, AttackType, DamageType, HeroInstance, EnemyInstance } from '../../core/types';

/** 已解析目标（可判别联合：kind 与 unit 类型联动） */
type ResolvedTarget = { kind: 'hero'; unit: HeroInstance } | { kind: 'enemy'; unit: EnemyInstance };

export interface DamageOpts {
  /** 攻击方（无=来源为环境/状态） */
  attacker?: { side: 'hero'; heroId: HeroId } | { side: 'enemy'; uid: string } | null;
  target: { side: 'hero'; heroId: HeroId } | { side: 'enemy'; uid: string };
  amount: number;
  attackType: AttackType;
  damageType: DamageType;
  pierceBlock?: boolean;
  critMult?: number;
  lastHitCrit?: boolean;
  reduceBlockPerHit?: number;
  hpBelow50Bonus?: number;
  selfMadnessAbove50Mult?: number;
  madnessOnHit?: number;
  overkillMult?: number;
  allToDarkMult?: number;
  onKillExtra?: boolean;
  /** 单目标攻击（可被嘲讽重定向）；AOE传false */
  singleTarget?: boolean;
  source?: string;
}

export class DamagePipeline {
  constructor(private engine: BattleEngine) {}

  /** 执行一次伤害，返回实际造成的生命损失 */
  dealDamage(opts: DamageOpts): number {
    const { ctx, buffs } = this.engine;
    const battle = ctx.battle;
    const target = this.getTarget(opts.target);
    if (!target || !this.isActive(target)) return 0;

    // ---------- 闪避 ----------
    if (target.kind === 'hero') {
      const dodge = buffs.has(target.unit, 'dodge');
      if (dodge) {
        if (ctx.rng.chance(dodge.value ?? 1)) {
          this.engine.log(`${this.engine.heroName(target.unit.heroId)} 闪避了攻击`, 'info');
          this.consumeDodge(target.unit);
          return 0;
        }
        this.consumeDodge(target.unit);
      }
    } else {
      // 潜行：每回合第一次受击80%闪避
      if (target.unit.stealthArmed) {
        target.unit.stealthArmed = false;
        if (ctx.rng.chance(0.8)) {
          this.engine.log(`${target.unit.name} 的身影在雾中消散（潜行闪避）`, 'info');
          return 0;
        }
      }
    }

    // ---------- 嘲讽/援护重定向 ----------
    let t: ResolvedTarget = target;
    if (opts.singleTarget !== false) {
      // 敌方攻击英雄：英雄嘲讽
      if (opts.attacker?.side === 'enemy' && t.kind === 'hero') {
        const taunter = this.aliveHeroWithTaunt();
        if (taunter && taunter.heroId !== t.unit.heroId) {
          t = { kind: 'hero', unit: taunter };
        }
      }
      // 援护：有guard状态的队友替受
      if (t.kind === 'hero') {
        const currentHero = t.unit;
        const guarder = Object.values(battle.heroes).find((h) => h.alive && h.heroId !== currentHero.heroId && buffs.has(h, 'guard'));
        if (guarder) t = { kind: 'hero', unit: guarder };
      }
    }

    // ---------- 伤害计算 ----------
    let dmg = opts.amount;
    const attacker = opts.attacker ?? null;

    // 攻击方修正
    if (attacker?.side === 'hero') {
      const hero = battle.heroes[attacker.heroId];
      // 力量
      dmg += buffs.count(hero, 'strength');
      // 恐惧
      const fear = buffs.count(hero, 'fear');
      if (fear > 0) dmg *= Math.max(0, 1 - 0.2 * fear);
      // 觉醒
      if (buffs.has(hero, 'awakened')) dmg *= 1.5;
      // 复仇
      const revenge = buffs.has(hero, 'revenge');
      if (revenge) dmg *= 1 + (revenge.value ?? 0.5);
      // 炉火升温
      dmg *= 1 + 0.2 * battle.furnaceStacks;
      // 车厢修正
      const carPos = hero.pos;
      if (carPos === 1) dmg *= opts.attackType === 'melee' ? 1.1 : 0.8;
      else if (carPos === 3) dmg *= opts.attackType === 'ranged' ? 1.1 : 0.8;
      else if (carPos === 4) dmg *= 0.9;
      // 执念阈值
      if (this.engine.hasThreshold(attacker.heroId, 'inertia') && battle.trainSpeed >= 3) dmg *= 1.1;
      if (this.engine.hasThreshold(attacker.heroId, 'guillotine') && t.unit.hp < t.unit.maxHp * 0.3) dmg *= 1.3;
      if (this.engine.hasThreshold(attacker.heroId, 'etchedEye') && buffs.has(t.unit, 'mark')) dmg *= 1.15;
      if (this.engine.hasThreshold(attacker.heroId, 'collapse') && (opts.overkillMult || opts.allToDarkMult)) dmg *= 1.5;
      // 目标低血加成
      if (opts.hpBelow50Bonus && t.unit.hp < t.unit.maxHp * 0.5) dmg *= 1 + opts.hpBelow50Bonus;
      // 自身狂气>50翻倍
      if (opts.selfMadnessAbove50Mult && hero.madness > 50) dmg *= 1 + opts.selfMadnessAbove50Mult;
      // 暴击
      dmg *= this.rollCrit(hero, opts.critMult, opts.lastHitCrit);
    } else if (attacker?.side === 'enemy') {
      const enemy = battle.enemies.find((e) => e.uid === attacker.uid);
      if (enemy) {
        dmg += buffs.count(enemy, 'strength');
        const fear = buffs.count(enemy, 'fear');
        if (fear > 0) dmg *= Math.max(0, 1 - 0.2 * fear);
        const enraged = buffs.has(enemy, 'enraged');
        if (enraged) dmg *= 1 + (enraged.value ?? 0.5);
        // 群猎本能
        const def = this.engine.registry.monsters.get(enemy.defId);
        const pack = (def?.traits ?? []).find((tr) => tr.id === 'packInstinct');
        if (pack) {
          const packCount = battle.enemies.filter((e) => e.hp > 0 && e.defId === enemy.defId).length - 1;
          dmg += packCount * (pack.params?.perAlly ?? 2);
        }
      }
    }

    // 受击方修正
    if (t.kind === 'hero') {
      if (buffs.has(t.unit, 'awakened')) dmg *= 0.75;
      if (buffs.has(t.unit, 'vulnerable')) dmg *= 1 + 0.3 * buffs.count(t.unit, 'vulnerable');
      if (buffs.has(t.unit, 'mark')) dmg *= 1.3;
      const tenacity = buffs.has(t.unit, 'tenacity');
      if (tenacity) {
        dmg *= 0.5;
        this.consumeTenacity(t.unit);
      }
    } else {
      const def = this.engine.registry.monsters.get(t.unit.defId);
      const spirit = (def?.traits ?? []).find((tr) => tr.id === 'spiritBody');
      if (spirit) {
        dmg *= opts.damageType === 'physical'
          ? (spirit.params?.physicalMult ?? 0.7)
          : (spirit.params?.arcaneMult ?? 1.5);
      }
      if (buffs.has(t.unit, 'vulnerable')) dmg *= 1 + 0.3 * buffs.count(t.unit, 'vulnerable');
      if (buffs.has(t.unit, 'mark')) dmg *= 1.3;
      const tenacity = buffs.has(t.unit, 'tenacity');
      if (tenacity) {
        dmg *= 0.5;
        this.consumeTenacity(t.unit);
      }
    }

    dmg = Math.max(1, Math.round(dmg));

    // ---------- 格挡 ----------
    const hpBefore = t.unit.hp;
    let applied = dmg;
    if (!opts.pierceBlock && t.unit.block > 0) {
      const absorbed = Math.min(t.unit.block, applied);
      t.unit.block -= absorbed;
      applied -= absorbed;
      this.engine.log(`${this.unitName(t)} 的格挡吸收了 ${absorbed} 点伤害`, 'info');
    }
    if (opts.reduceBlockPerHit && t.unit.block > 0) {
      t.unit.block = Math.max(0, t.unit.block - opts.reduceBlockPerHit);
    }
    if (applied <= 0) {
      this.engine.log(`${this.unitName(t)} 挡住了全部伤害`, 'info');
      this.postHit(opts, t, attacker, 0);
      return 0;
    }

    t.unit.hp -= applied;
    const hpAfter = t.unit.hp;
    this.engine.log(`${opts.source ?? ''} ${this.unitName(t)} 受到 ${applied} 点伤害（${hpBefore} → ${Math.max(0, hpAfter)}）`, 'damage');

    this.postHit(opts, t, attacker, applied);

    // ---------- 溢伤连锁 ----------
    if (t.kind === 'enemy' && hpAfter <= 0 && attacker?.side === 'hero') {
      const excess = applied - hpBefore;
      if (excess > 0) {
        const darkGain = excess * (opts.overkillMult ?? 1);
        this.engine.gainDarkEnergy(darkGain);
        this.engine.gainSoulfire(Math.round(excess * this.engine.soulfireRatio()));
      }
      if (opts.allToDarkMult) {
        this.engine.gainDarkEnergy(applied * opts.allToDarkMult);
      }
      if (opts.onKillExtra) {
        this.engine.queueExtraPlay(attacker.heroId);
      }
    }

    // ---------- 死亡结算 ----------
    if (t.kind === 'enemy' && hpAfter <= 0) {
      this.engine.onEnemyKilled(t.unit, attacker?.side === 'hero' ? attacker.heroId : undefined);
    } else if (t.kind === 'hero' && hpAfter <= 0) {
      this.engine.onHeroFell(t.unit.heroId);
    }

    // ---------- 荆棘反伤 ----------
    if (t.kind === 'enemy' && opts.attackType === 'melee' && attacker?.side === 'hero' && hpAfter > 0) {
      const def = this.engine.registry.monsters.get(t.unit.defId);
      const thorns = (def?.traits ?? []).find((tr) => tr.id === 'thorns');
      if (thorns) {
        const thornDmg = thorns.params?.damage ?? 3;
        const hero = battle.heroes[attacker.heroId];
        if (hero.alive) {
          hero.hp -= thornDmg;
          this.engine.log(`🌵 荆棘反伤：${this.engine.heroName(attacker.heroId)} 受到 ${thornDmg} 点反伤`, 'damage');
          if (hero.hp <= 0) this.engine.onHeroFell(attacker.heroId);
        }
      }
    }

    // ---------- 受击方触发 ----------
    if (t.kind === 'enemy') {
      buffs.markHitTrigger(t.unit);
    }
    if (t.kind === 'hero') {
      buffs.tauntHitTrigger(t.unit);
      // 余烬阈值：受击10%返还3伤害
      if (this.engine.hasThreshold(t.unit.heroId, 'ember') && attacker?.side === 'enemy' && ctx.rng.chance(0.1)) {
        const enemy = battle.enemies.find((e) => e.uid === attacker.uid);
        if (enemy && enemy.hp > 0) {
          enemy.hp -= 3;
          this.engine.log(`🔥 余烬反噬：${enemy.name} 受到 3 点灼烧`, 'damage');
          if (enemy.hp <= 0) this.engine.onEnemyKilled(enemy, t.unit.heroId);
        }
      }
    }

    // ---------- 吞噬救回进度（仅Boss受伤计数） ----------
    if (battle.swallow && t.kind === 'enemy'
      && this.engine.registry.monsters.get(t.unit.defId)?.bossAdvance) {
      battle.swallow.dealt += applied;
      if (battle.swallow.dealt >= battle.swallow.need) {
        const hero = battle.heroes[battle.swallow.heroId];
        if (hero) {
          buffs.remove(hero, 'swallowed');
          this.engine.log(`💪 ${this.engine.heroName(hero.heroId)} 挣脱了蠕虫的吞噬！`, 'system');
          battle.swallow = undefined;
        }
      }
    }

    return applied;
  }

  /** 命中后触发（狂气、全伤害转暗蚀） */
  private postHit(opts: DamageOpts, t: ResolvedTarget, attacker: DamageOpts['attacker'], applied: number): void {
    if (t.kind === 'hero' && opts.madnessOnHit && applied > 0) {
      this.engine.madness.gain(t.unit.heroId, opts.madnessOnHit);
    }
    // 全部伤害转暗蚀（奥瑞斯橙卡）：未击杀也转化
    if (t.kind === 'enemy' && attacker?.side === 'hero' && opts.allToDarkMult && applied > 0 && t.unit.hp > 0) {
      this.engine.gainDarkEnergy(applied * opts.allToDarkMult);
    }
  }

  private rollCrit(hero: HeroInstance, critMult?: number, lastHitCrit?: boolean): number {
    const ctx = this.engine.ctx;
    if (lastHitCrit) {
      this.engine.log('✨ 必定暴击！', 'info');
      return 1.5;
    }
    let chance = hero.critChance + hero.runCritBonus;
    chance += this.engine.buffs.count(hero, 'critUp') * (this.engine.buffs.has(hero, 'critUp')?.value ?? 0.03);
    if (critMult) chance *= critMult;
    if (ctx.rng.chance(chance)) {
      this.engine.log('✨ 暴击！', 'info');
      return 1.5;
    }
    return 1;
  }

  private getTarget(target: DamageOpts['target']): ResolvedTarget | null {
    const battle = this.engine.ctx.battle;
    if (target.side === 'hero') {
      const h = battle.heroes[target.heroId];
      return h ? { kind: 'hero', unit: h } : null;
    }
    const e = battle.enemies.find((x) => x.uid === target.uid);
    return e ? { kind: 'enemy', unit: e } : null;
  }

  private isActive(t: ResolvedTarget): boolean {
    return t.kind === 'hero' ? t.unit.alive : t.unit.hp > 0;
  }

  private aliveHeroWithTaunt(): HeroInstance | undefined {
    return Object.values(this.engine.ctx.battle.heroes).find((h) => h.alive && this.engine.buffs.has(h, 'taunt'));
  }

  private consumeDodge(hero: HeroInstance): void {
    const dodge = this.engine.buffs.has(hero, 'dodge');
    if (dodge) {
      dodge.stacks -= 1;
      if (dodge.stacks <= 0) this.engine.buffs.remove(hero, 'dodge');
    }
  }

  private consumeTenacity(unit: HeroInstance | EnemyInstance): void {
    const tenacity = this.engine.buffs.has(unit, 'tenacity');
    if (tenacity) {
      tenacity.stacks -= 1;
      if (tenacity.stacks <= 0) this.engine.buffs.remove(unit, 'tenacity');
    }
  }

  private unitName(t: ResolvedTarget): string {
    return t.kind === 'hero' ? this.engine.heroName(t.unit.heroId) : t.unit.name;
  }
}
