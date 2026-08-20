// 牌库系统：牌库/手牌/弃牌堆/蚀渊/残影暂存 的纯逻辑操作
import type { HeroId, RunState } from '../../core/types';
import { Rng } from '../../core/rng';
import { registry } from '../../core/registry';

export class DeckSystem {
  constructor(private run: RunState, private rng: Rng) {}

  get deck() { return this.run.deck; }

  /** 抽N张牌（不足则洗弃牌堆补充） */
  draw(n: number): string[] {
    const drawn: string[] = [];
    for (let i = 0; i < n; i++) {
      if (this.deck.drawPile.length === 0) this.reshuffleDiscard();
      const card = this.deck.drawPile.pop();
      if (!card) break; // 牌库彻底空了
      this.deck.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  /** 弃牌堆洗回牌库 */
  reshuffleDiscard(): void {
    if (this.deck.discardPile.length === 0) return;
    this.deck.drawPile.push(...this.deck.discardPile);
    this.deck.discardPile = [];
    this.rng.shuffle(this.deck.drawPile);
  }

  /** 手牌全部弃入蚀渊 */
  discardHand(): void {
    this.deck.discardPile.push(...this.deck.hand);
    this.deck.hand = [];
  }

  /** 从手牌移除指定卡（打出） */
  removeFromHand(cardId: string): boolean {
    const i = this.deck.hand.indexOf(cardId);
    if (i < 0) return false;
    this.deck.hand.splice(i, 1);
    return true;
  }

  /** 加入一张牌到牌库（奖励/复制/融合产物） */
  addToDeck(cardId: string): void {
    this.deck.drawPile.push(cardId);
    this.rng.shuffle(this.deck.drawPile);
  }

  /** 从牌组中永久删除一张卡（记忆之轨代价）：牌库/手牌/弃牌堆全找 */
  removeCard(cardId: string): boolean {
    for (const pile of [this.deck.drawPile, this.deck.hand, this.deck.discardPile]) {
      const i = pile.indexOf(cardId);
      if (i >= 0) {
        pile.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** 统计某卡在牌组中的数量 */
  countCard(cardId: string): number {
    return [this.deck.drawPile, this.deck.hand, this.deck.discardPile]
      .reduce((sum, pile) => sum + pile.filter((c) => c === cardId).length, 0);
  }

  /** 英雄残影化：其所有卡移入暂存 */
  heroFell(heroId: HeroId): void {
    const theirs = (pile: string[]) => pile.filter((c) => this.ownerOf(c) === heroId);
    this.deck.resting[heroId].push(...theirs(this.deck.drawPile), ...theirs(this.deck.hand), ...theirs(this.deck.discardPile));
    this.deck.drawPile = this.deck.drawPile.filter((c) => this.ownerOf(c) !== heroId);
    this.deck.hand = this.deck.hand.filter((c) => this.ownerOf(c) !== heroId);
    this.deck.discardPile = this.deck.discardPile.filter((c) => this.ownerOf(c) !== heroId);
  }

  /** 英雄复活：暂存卡归还牌库并洗牌 */
  heroRevived(heroId: HeroId): void {
    const cards = this.deck.resting[heroId] ?? [];
    this.deck.resting[heroId] = [];
    this.deck.drawPile.push(...cards);
    this.rng.shuffle(this.deck.drawPile);
  }

  /** 卡牌归属英雄（遗物牌无归属） */
  private ownerOf(cardId: string): HeroId | undefined {
    return registry.cards.get(cardId)?.heroId;
  }
}
