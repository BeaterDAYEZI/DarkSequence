// 应用壳：持有 Registry / RunState / Systems / SceneManager
import { registry } from '../core/registry';
import { eventBus } from '../core/eventBus';
import { SceneManager } from './SceneManager';
import { GameLoop } from './GameLoop';
import type { RunState } from '../core/types';

export class App {
  readonly registry = registry;
  readonly events = eventBus;
  readonly scenes = new SceneManager();
  readonly loop = new GameLoop();
  runState: RunState | null = null;

  constructor(private root: HTMLElement) {
    this.loop.onFrame = (dt) => this.scenes.current?.onFrame?.(dt);
  }

  start(): void {
    this.loop.start();
  }

  go(scene: string, params?: unknown): void {
    this.scenes.switchTo(scene, this.root, params);
  }
}
