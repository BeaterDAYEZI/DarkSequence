// 发布/订阅事件总线：逻辑层发事件，UI 订阅刷新
export type EventMap = {
  stateChanged: { scope: 'run' | 'battle' | 'map' | 'deck' | 'resources' };
  battleEvent: { text: string; kind: 'info' | 'damage' | 'heal' | 'madness' | 'soulfire' | 'narration' | 'system' };
  battlePhase: { phase: string };
  sceneChanged: { scene: string };
  report: { errors: string[]; warnings: string[] };
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

class EventBusImpl {
  private handlers = new Map<string, Set<Handler<never>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<K>): () => void {
    const set = this.handlers.get(event) ?? new Set<Handler<never>>();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(payload as never);
      } catch (e) {
        console.error(`[eventBus] handler error on "${event}":`, e);
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBusImpl();
