// 全局 App 引用：场景间导航用（避免 main↔scene 循环依赖）
import type { App } from './App';

export const appRef: { current: App | null } = { current: null };
