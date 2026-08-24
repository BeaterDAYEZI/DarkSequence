// 场景注册与切换
import { eventBus } from '../core/eventBus';

export interface Scene {
  onEnter(root: HTMLElement, params?: unknown): void;
  onExit?(): void;
  onFrame?(dt: number): void;
}

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private currentName: string | null = null;
  current: Scene | null = null;

  register(name: string, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  switchTo(name: string, root: HTMLElement, params?: unknown): void {
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`[SceneManager] 未注册的场景: ${name}`);
      return;
    }
    this.current?.onExit?.();
    root.innerHTML = '';
    this.current = scene;
    this.currentName = name;
    document.body.dataset.scene = name;
    scene.onEnter(root, params);
    eventBus.emit('sceneChanged', { scene: name });
  }

  get currentSceneName(): string | null {
    return this.currentName;
  }
}
