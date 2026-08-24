// 效果解析器：EffectSpec → 具体结算（玩家卡牌与怪物技能共用）
import type { BattleEngine } from './BattleEngine';
import type { CardDef, EffectSpec, HeroId, AttackType, DamageType } from '../../core/types';
import { registry } from '../../core/registry';
import { combatLog } from '../../core/log';

export interface ResolveSource {
  side: 'hero' | 'enemy';
  heroId?: HeroId;
  enemyUid?: string;
}

export interface ResolveCtx {
  source: ResolveSource;
  card?: CardDef;
  /** 共鸣倍率（1=无） */
  mult?: number;
  /** 记忆铁轨复制：目标阵营互换 */
  flipSides?: boolean;
  /** 本次打出实际支付的费用（costOverride退款用） */
  paidCost?: number;
  /** 双连发第二次：伤害减半 */
  halve?: boolean;
}

export class CardResolver {
  constructor(private engine: BattleEngine) {}

  resolve(effects: readonly EffectSpec[], ctx: ResolveCtx): void {
    for (const raw of effects) {
      const eff = ctx.flipSides ? this.flipEffect(raw) : raw;
      this.resolveOne(eff, ctx);
    }
  }

  private flipEffect(e: EffectSpec): EffectSpec {
    if (!e.target) return e;
    return { ...e, target: { ...e.target, side: e.target.side === 'ally' ? 'enemy' : 'ally' } };
  }

  private resolveOne(e: EffectSpec, ctx: ResolveCtx): void {
    const engine = this.engine;
    const battle = engine.ctx.battle;
    const mult = ctx.mult ?? 1;
    const rng = engine.ctx.rng;

    // 条件检查（speedGE3等）
    if (e.condition && !engine.checkCondition(e.condition, ctx.source.heroId)) return;

    const roll = (a: number | [number, number] | undefined): number => {
      if (a === undefined) return 0;
      const base = Array.isArray(a) ? rng.range(a[0], a[1]) : a;
      return Math.round(base * mult);
    };

    switch (e.kind) {
      case 'damage': {
        // 怪物移动攻击：目标车厢无英雄 → 自动爬向最近的存活英雄（其所在车厢）再攻击
        if (ctx.source.side === 'enemy' && e.target?.side === 'ally' && e.target.mode === 'pos') {
          const heroesNow = Object.values(battle.heroes).filter((h) => h.alive && !engine.buffs.has(h, 'swallowed'));
          const hasTarget = (e.target.pos ?? []).some((p) => heroesNow.some((h) => h.pos === p));
          if (!hasTarget && heroesNow.length > 0 && ctx.source.enemyUid) {
            const enemy = battle.enemies.find((x) => x.uid === ctx.source.enemyUid);
            if (enemy) {
              const nearest = [...heroesNow].sort((a, b) =>
                Math.abs(enemy.pos - a.pos) - Math.abs(enemy.pos - b.pos))[0];
              if (nearest && nearest.pos !== enemy.pos) {
                engine.log(`${enemy.name} 爬向${nearest.pos}号车厢攻击${engine.heroName(nearest.heroId)}`, 'info');
                enemy.pos = nearest.pos;
              }
              // 目标改为最近英雄所在位置
              e = { ...e, target: { side: 'ally', mode: 'pos', pos: [nearest.pos] } };
            }
          }
        }
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        const plusDark = e.plusPerDark ? battle.darkEnergy * e.plusPerDark : 0;
        let baseAmount = roll(e.amount) + plusDark;
        if (ctx.halve) baseAmount = Math.max(1, Math.round(baseAmount / 2));  // 双连发第二次减半
        const attackType: AttackType = ctx.card?.attackType ?? engine.heroAttackType(ctx.source.heroId);
        const damageType: DamageType = ctx.card?.damageType ?? engine.heroDamageType(ctx.source.heroId);
        const times = e.times ?? 1;
        for (let i = 0; i < times; i++) {
          const t = (e.target?.mode === 'random')
            ? engine.targets.resolve(e.target, ctx.source.heroId)
            : targets;
          for (const unit of t) {
            const opts = {
              attacker: ctx.source.side === 'hero'
                ? { side: 'hero' as const, heroId: ctx.source.heroId! }
                : { side: 'enemy' as const, uid: ctx.source.enemyUid! },
              target: unit,
              amount: baseAmount,
              attackType,
              damageType,
              pierceBlock: e.pierceBlock,
              critMult: e.critMult,
              lastHitCrit: e.lastHitCrit && i === times - 1,
              reduceBlockPerHit: e.reduceBlockPerHit,
              hpBelow50Bonus: e.hpBelow50Bonus,
              selfMadnessAbove50Mult: e.selfMadnessAbove50Mult,
              madnessOnHit: e.madnessOnHit,
              overkillMult: e.overkillMult,
              allToDarkMult: e.allToDarkMult,
              onKillExtra: e.onKillExtra,
              singleTarget: e.target?.mode !== 'all' && !(e.target?.pos && e.target.pos.length > 1),
              source: ctx.card ? `[${ctx.card.name}]` : '[攻击]',
            };
            engine.pipeline.dealDamage(opts);
          }
        }
        if (e.consumeDark && battle.darkEnergy > 0) {
          engine.log(`暗蚀能量 ×${battle.darkEnergy} 被清空`, 'info');
          battle.darkEnergy = 0;
        }
        break;
      }
      case 'block': {
        // 遗忘之轨：格挡获取-2（最低0）
        const amount = Math.max(0, roll(e.amount) - battle.blockNerf);
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        for (const unit of targets) {
          if (unit.side === 'hero') {
            const hero = battle.heroes[unit.heroId];
            hero.block += amount;
            engine.log(`${engine.heroName(unit.heroId)} 获得 ${amount} 点格挡`, 'info');
          } else {
            const enemy = battle.enemies.find((x) => x.uid === unit.uid);
            if (enemy) {
              enemy.block += amount;
              engine.log(`${enemy.name} 获得 ${amount} 点格挡`, 'info');
            }
          }
        }
        break;
      }
      case 'heal': {
        const amount = roll(e.amount);
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        for (const unit of targets) {
          if (unit.side === 'hero') engine.healHero(unit.heroId, amount);
          else {
            const enemy = battle.enemies.find((x) => x.uid === unit.uid);
            if (enemy) {
              const ratio = 1 - (engine.buffs.has(enemy, 'healReduction')?.value ?? 0);
              const heal = Math.max(0, Math.round(amount * ratio));
              enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
              engine.log(`${enemy.name} 恢复 ${heal} 点生命`, 'heal');
            }
          }
        }
        break;
      }
      case 'draw': {
        const n = typeof e.amount === 'number' ? e.amount : 1;
        engine.deck.draw(n);
        engine.log(`抽取 ${n} 张牌`, 'info');
        break;
      }
      case 'energyGain': {
        const n = typeof e.amount === 'number' ? e.amount : 1;
        battle.energy += n;
        engine.log(`能量 +${n}（当前 ${battle.energy}）`, 'info');
        break;
      }
      case 'taunt': {
        if (ctx.source.side === 'hero') {
          const hero = battle.heroes[ctx.source.heroId!];
          engine.buffs.apply(hero, 'taunt', 1, e.duration ?? 1, e.value);
          engine.log(`${engine.heroName(hero.heroId)} 嘲讽所有敌人`, 'system');
        } else {
          const enemy = battle.enemies.find((x) => x.uid === ctx.source.enemyUid);
          if (enemy) {
            engine.buffs.apply(enemy, 'taunt', 1, e.duration ?? 1, e.value);
            engine.log(`${enemy.name} 强制嘲讽所有英雄`, 'system');
          }
        }
        break;
      }
      case 'speed':
        engine.train.changeSpeed(typeof e.amount === 'number' ? e.amount : 0);
        if (e.clearMadnessIfSpeedZero && battle.trainSpeed === 0) {
          for (const hero of Object.values(battle.heroes)) {
            if (hero.alive) engine.madness.clear(hero.heroId);
          }
          engine.log('列车完全停下——全队狂气被清除（安全刹车）', 'system');
        }
        break;
      case 'pull': {
        const pos = e.target?.pos?.[0] ?? 3;
        engine.train.pull(pos);
        break;
      }
      case 'push': {
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        if (e.target?.side === 'ally') {
          engine.train.pushAllHeroes();
        } else {
          for (const unit of targets) {
            if (unit.side !== 'enemy') continue;
            const enemy = battle.enemies.find((x) => x.uid === unit.uid);
            if (enemy) engine.train.pushBack(enemy);
          }
        }
        break;
      }
      case 'shufflePos': {
        if (e.target?.side === 'ally' && e.target.mode === 'random2') {
          const two = engine.targets.resolve(e.target, ctx.source.heroId);
          const heroes = two.filter((u) => u.side === 'hero');
          if (heroes.length === 2) engine.train.swapHeroes(heroes[0].heroId, heroes[1].heroId);
        } else {
          engine.train.shuffleEnemies();
        }
        break;
      }
      case 'madnessGain': {
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        const amount = roll(e.amount);
        let awakened = false;
        for (const unit of targets) {
          if (unit.side === 'hero') awakened = engine.madness.gain(unit.heroId, amount) || awakened;
        }
        if (e.replayIfAwakened && awakened && ctx.card && ctx.source.heroId) {
          // 打出后觉醒：本牌无消耗且再打一次
          if (ctx.paidCost) {
            battle.energy += ctx.paidCost;
            engine.log(`⚡ 觉醒引爆：${ctx.card.name} 返还 ${ctx.paidCost} 点能量`, 'system');
          }
          engine.queueReplayCard(ctx.source.heroId, ctx.card.id);
        }
        break;
      }
      case 'madnessTransfer': {
        if (ctx.source.side !== 'hero' || !ctx.source.heroId) break;
        const amount = roll(e.amount);
        const hero = battle.heroes[ctx.source.heroId];
        const transferred = engine.madness.reduce(ctx.source.heroId, Math.min(amount, hero.madness));
        if (transferred > 0) {
          engine.log(`狂气压力倾泻！所有敌人受到 ${transferred} 点压力伤害`, 'madness');
          for (const enemy of battle.enemies.filter((x) => x.hp > 0)) {
            engine.pipeline.dealDamage({
              attacker: { side: 'hero', heroId: ctx.source.heroId },
              target: { side: 'enemy', uid: enemy.uid },
              amount: transferred,
              attackType: 'ranged',
              damageType: 'arcane',
              pierceBlock: true,
              singleTarget: false,
              source: '[狂气压力]',
            });
          }
        }
        if (e.drawIfEmpty && hero.madness === 0) {
          engine.deck.draw(e.drawIfEmpty);
          engine.log(`狂气归零——额外抽取 ${e.drawIfEmpty} 张牌`, 'info');
        }
        break;
      }
      case 'madnessClear': {
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        for (const unit of targets) {
          if (unit.side === 'hero') {
            if (typeof e.amount === 'number') engine.madness.reduce(unit.heroId, e.amount);
            else engine.madness.clear(unit.heroId);
          }
        }
        break;
      }
      case 'soulfireSteal': {
        const amount = typeof e.amount === 'number' ? e.amount : 0;
        if (battle.soulfire >= amount) {
          battle.soulfire -= amount;
          engine.log(`🔥 魂火被窃取 ${amount} 点（剩余 ${battle.soulfire}）`, 'soulfire');
        } else {
          battle.soulfire = 0;
          if (e.fallbackDamage) {
            const frontHero = engine.targets.resolve({ side: 'ally', mode: 'front' }, ctx.source.heroId);
            for (const unit of frontHero) {
              engine.pipeline.dealDamage({
                attacker: ctx.source.side === 'hero'
                  ? { side: 'hero', heroId: ctx.source.heroId! }
                  : { side: 'enemy', uid: ctx.source.enemyUid! },
                target: unit,
                amount: e.fallbackDamage,
                attackType: 'melee',
                damageType: 'physical',
                pierceBlock: true,
                singleTarget: true,
                source: '[魂火反噬]',
              });
            }
          }
        }
        break;
      }
      case 'soulfireGain':
        engine.gainSoulfire(typeof e.amount === 'number' ? e.amount : 0);
        break;
      case 'soulfireClear':
        battle.soulfire = 0;
        engine.log('🔥 列车魂火被清空！', 'soulfire');
        break;
      case 'applyStatus': {
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        const value = e.valuePerSpeed ? battle.trainSpeed * e.valuePerSpeed : e.value;
        for (const unit of targets) {
          if (e.chance !== undefined && !rng.chance(e.chance)) continue;
          if (unit.side === 'hero') {
            const hero = battle.heroes[unit.heroId];
            engine.buffs.apply(hero, e.status!, e.stacks ?? 1, e.duration ?? -1, value);
          } else {
            const enemy = battle.enemies.find((x) => x.uid === unit.uid);
            if (enemy) engine.buffs.apply(enemy, e.status!, e.stacks ?? 1, e.duration ?? -1, value);
          }
        }
        break;
      }
      case 'clearStatus': {
        const targets = engine.targets.resolve(e.target, ctx.source.heroId);
        for (const unit of targets) {
          if (unit.side === 'hero') {
            const hero = battle.heroes[unit.heroId];
            if (e.status) engine.buffs.remove(hero, e.status);
            else engine.buffs.clearDebuffs(hero, e.stacks === 1);
          } else {
            const enemy = battle.enemies.find((x) => x.uid === unit.uid);
            if (enemy) {
              if (e.status) engine.buffs.remove(enemy, e.status);
              else engine.buffs.clearDebuffs(enemy, e.stacks === 1);
            }
          }
        }
        break;
      }
      case 'extraAction':
        if (ctx.source.heroId) engine.queueExtraPlay(ctx.source.heroId);
        break;
      case 'costOverride': {
        if (ctx.paidCost) {
          battle.energy += ctx.paidCost;
          engine.log('本牌无消耗，能量返还', 'info');
        }
        break;
      }
      case 'summon':
        if (e.summonId) engine.spawnEnemy(e.summonId, e.summonPos ?? 1);
        break;
      case 'critGain': {
        if (ctx.source.side !== 'hero' || !ctx.source.heroId) break;
        const hero = battle.heroes[ctx.source.heroId];
        const n = typeof e.amount === 'number' ? e.amount : 0;
        if (e.critScope === 'run') {
          hero.runCritBonus += n;
          engine.log(`${engine.heroName(hero.heroId)} 全局暴击率永久 +${Math.round(n * 100)}%`, 'system');
        } else {
          engine.buffs.apply(hero, 'critUp', 1, e.duration ?? 1, n);
          engine.log(`${engine.heroName(hero.heroId)} 暴击率 +${Math.round(n * 100)}%`, 'info');
        }
        break;
      }
      case 'swallow': {
        if (ctx.source.side !== 'enemy' || !ctx.source.enemyUid) break;
        engine.swallowFrontHero();
        break;
      }
      // ================= 新卡牌机制（卡牌优化 v1） =================
      case 'discardCard': {
        // 弃掉1张手牌（从手牌随机弃1）
        if (battle.heroes[ctx.source.heroId ?? 'warwick'] && engine.deck.deck.hand.length > 0) {
          const i = rng.int(0, engine.deck.deck.hand.length);
          const [discarded] = engine.deck.deck.hand.splice(i, 1);
          engine.deck.deck.discardPile.push(discarded);
          engine.log(`弃掉1张手牌【${registry.cards.get(discarded)?.name ?? discarded}】`, 'info');
        }
        break;
      }
      case 'hpSet': {
        if (ctx.source.side !== 'hero' || !ctx.source.heroId) break;
        const hero = battle.heroes[ctx.source.heroId];
        const target = e.hpTo ?? 1;
        hero.hp = Math.min(hero.maxHp, target);
        engine.log(`${engine.heroName(hero.heroId)} 生命降至 ${hero.hp}！`, 'system');
        if (hero.hp <= 0) engine.onHeroFell(hero.heroId);
        break;
      }
      case 'copyLastCard': {
        // 复制上一回合打出的最后一张牌
        const last = combatLog.getLastCard(battle.turn - 1);
        if (!last) {
          engine.log('时空错位：上一回合没有打出任何牌', 'info');
          break;
        }
        const lastDef = registry.cards.get(last.cardId);
        if (!lastDef) break;
        engine.log(`⏳ 时空错位：复制了【${lastDef.name}】`, 'system');
        // 随机弃1张手牌
        if (engine.deck.deck.hand.length > 0) {
          const i = rng.int(0, engine.deck.deck.hand.length);
          const [discarded] = engine.deck.deck.hand.splice(i, 1);
          engine.deck.deck.discardPile.push(discarded);
          engine.log(`代价：弃掉了1张手牌`, 'info');
        }
        const newCardId = `copied_${last.cardId}_${battle.turn}`;
        engine.deck.deck.hand.push(newCardId);
        // 动态注册副本（若未注册）
        if (!registry.cards.has(newCardId)) {
          registry.addCards([{ ...lastDef, id: newCardId, lineageId: newCardId, isFused: undefined }]);
        }
        engine.log(`副本【${lastDef.name}】已加入手牌`, 'info');
        break;
      }
      case 'damageMultTurn': {
        battle.damageMult *= e.damageMult ?? 1;
        engine.log(`本回合全队伤害 ×${battle.damageMult}`, 'system');
        break;
      }
      case 'ignorePosTurn': {
        battle.ignorePosTurn = true;
        engine.log('本回合所有英雄无视站位限制', 'system');
        break;
      }
      case 'permanentSpeed': {
        const delta = typeof e.amount === 'number' ? e.amount : 0;
        engine.run.permSpeedMod = (engine.run.permSpeedMod ?? 0) + delta;
        battle.trainSpeed = Math.max(0, Math.min(5, battle.trainSpeed + delta));
        engine.log(`列车速度${delta >= 0 ? '+' : ''}${delta}（本局永久${delta >= 0 ? '提升' : '降低'}）`, 'system');
        break;
      }
      case 'permanentStrength': {
        // 暗蚀导管：力量 = 当前暗蚀能量×0.5
        let strength = e.darkToStrength
          ? Math.floor(battle.darkEnergy * 0.5)
          : (typeof e.amount === 'number' ? e.amount : 1);
        if (strength <= 0) {
          engine.log('暗蚀能量不足，转化无效', 'info');
          break;
        }
        if (e.limitPerRun) {
          const cardId = ctx.card?.id;
          if (cardId && engine.run.usedLimitCards.includes(cardId)) {
            engine.log('暗蚀导管：本局已使用过（每局限1次）', 'info');
            break;
          }
          if (cardId) engine.run.usedLimitCards.push(cardId);
        }
        for (const hero of Object.values(battle.heroes)) {
          if (!hero.alive) continue;
          engine.run.permStrength[hero.heroId] = (engine.run.permStrength[hero.heroId] ?? 0) + strength;
        }
        engine.log(`🌑 暗蚀导管：全队永久力量+${strength}`, 'system');
        break;
      }
      case 'nextAttackDouble': {
        battle.nextAttackDouble = true;
        engine.log('双连发装置就绪：下一张攻击牌将打出两次', 'system');
        break;
      }
      case 'copyMadness': {
        if (ctx.source.side !== 'hero' || !ctx.source.heroId) break;
        // 来源：指定英雄 > 最高狂气队友 > 打出者
        let fromId = e.copyFrom;
        if (!fromId && e.target?.mode === 'highestMadnessAlly') {
          const sorted = Object.values(battle.heroes).filter((h) => h.alive).sort((a, b) => b.madness - a.madness);
          fromId = sorted[0]?.heroId;
        }
        fromId = fromId ?? ctx.source.heroId;
        const from = battle.heroes[fromId];
        if (!from) break;
        const amount = from.madness;
        if (amount <= 0) {
          engine.log(`狂气共鸣器：${engine.heroName(fromId)} 没有狂气可复制`, 'info');
          break;
        }
        for (const enemy of battle.enemies.filter((x) => x.hp > 0)) {
          engine.pipeline.dealDamage({
            attacker: { side: 'hero', heroId: ctx.source.heroId },
            target: { side: 'enemy', uid: enemy.uid },
            amount,
            attackType: 'ranged',
            damageType: 'arcane',
            pierceBlock: true,
            singleTarget: false,
            source: '[狂气共振]',
          });
        }
        engine.log(`🌊 狂气共鸣：${engine.heroName(fromId)} 的 ${amount} 点狂气倾泻给全体敌人`, 'madness');
        break;
      }
    }
  }
}
