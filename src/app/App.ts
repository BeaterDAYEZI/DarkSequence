// 应用壳：持有 Registry / RunController / SceneManager / 氛围层
import { registry } from '../core/registry';
import { eventBus } from '../core/eventBus';
import { SceneManager } from './SceneManager';
import { GameLoop } from './GameLoop';
import { Atmosphere } from '../ui/fx/Atmosphere';
import type { RunController } from '../game/RunController';

export class App {
  readonly registry = registry;
  readonly events = eventBus;
  readonly scenes = new SceneManager();
  readonly loop = new GameLoop();
  readonly atmosphere = new Atmosphere();
  /** 当前进行中的旅程 */
  run: RunController | null = null;

  constructor(private root: HTMLElement) {
    this.loop.onFrame = (dt) => {
      this.scenes.current?.onFrame?.(dt);
      this.atmosphere.onFrame(dt, performance.now());
    };
  }

  start(): void {
    this.loop.start();
  }

  go(scene: string, params?: unknown): void {
    this.scenes.switchTo(scene, this.root, params);
  }
}
