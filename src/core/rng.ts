// 可播种 PRNG（mulberry32）—— 存档可复现随机序列
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 0~1 浮点 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min,max) 整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /** [min,max] 范围值 */
  range(min: number, max: number): number {
    return this.int(min, max + 1);
  }

  /** 概率判定 */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 从数组中随机取一个 */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }

  /** 加权随机取索引 */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Fisher-Yates 洗牌（原地，返回原数组） */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** 随机种子生成（Date.now 不受沙箱限制，主线程可用） */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
