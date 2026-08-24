// 氛围层：全屏Canvas蚀雾粒子 + 底部列车剪影 + 车灯光柱（性能友好，帧率无关）
import { ASSETS } from '../../core/assets';

export class Atmosphere {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private particles: { x: number; y: number; r: number; vx: number; alpha: number }[] = [];
  private lastTime = 0;

  mount(host: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'atmosphere-canvas';
    host.appendChild(this.canvas);
    const silhouette = document.createElement('div');
    silhouette.className = 'train-silhouette';
    silhouette.innerHTML = `<img class="train-silhouette-img" src="${ASSETS.trainSilhouette}" alt="" draggable="false"/>`;
    host.appendChild(silhouette);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    for (let i = 0; i < 70; i++) {
      this.particles.push(this.newParticle());
    }
  }

  private resize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  private newParticle(): { x: number; y: number; r: number; vx: number; alpha: number } {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.85,
      r: 20 + Math.random() * 60,
      vx: 6 + Math.random() * 22,
      alpha: 0.02 + Math.random() * 0.05,
    };
  }

  onFrame(dt: number, now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (now - this.lastTime < 40) return; // 25fps足够，省电
    this.lastTime = now;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      if (p.x > this.canvas.width + p.r) {
        Object.assign(p, this.newParticle());
        p.x = -p.r;
      }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(140,140,180,${p.alpha})`);
      g.addColorStop(1, 'rgba(140,140,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
