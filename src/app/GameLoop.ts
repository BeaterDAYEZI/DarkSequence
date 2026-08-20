// requestAnimationFrame 循环：驱动动画层与渲染（DOM 场景可选实现 onFrame）
export class GameLoop {
  onFrame: ((dt: number) => void) | null = null;
  private running = false;
  private lastTime = 0;
  private rafId = 0;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min((t - this.lastTime) / 1000, 0.1); // 上限0.1s防跳帧
      this.lastTime = t;
      this.onFrame?.(dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
