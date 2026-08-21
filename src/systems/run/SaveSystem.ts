// 存档系统：阶段边界快照 → localStorage（地图节点切换 / 战斗回合开始）
import type { RunState, BattleState } from '../../core/types';
import { registry } from '../../core/registry';
import { RUN_VERSION } from './RunState';

const SAVE_KEY = 'dark-sequence-save';

export interface SaveData {
  version: string;
  savedAt: number;
  run: RunState;
  /** 战斗中途快照（存在=战斗中，读档恢复至该回合开始） */
  battle?: BattleState;
  /** 战斗归属节点与区域 */
  battleNodeId?: string;
}

export class SaveSystem {
  /** 非浏览器环境（headless测试）安全返回null */
  private static storage(): Storage | null {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch {
      /* 隐私模式等场景 */
    }
    return null;
  }

  static hasSave(): boolean {
    const s = this.storage();
    return s ? s.getItem(SAVE_KEY) !== null : false;
  }

  /** 地图级保存（战斗外） */
  static saveRun(run: RunState): void {
    const s = this.storage();
    if (!s) return;
    const data: SaveData = {
      version: RUN_VERSION,
      savedAt: Date.now(),
      run,
    };
    s.setItem(SAVE_KEY, JSON.stringify(data));
  }

  /** 战斗级保存（回合开始时调用） */
  static saveBattle(run: RunState, battle: BattleState, nodeId: string): void {
    const s = this.storage();
    if (!s) return;
    const data: SaveData = {
      version: RUN_VERSION,
      savedAt: Date.now(),
      run,
      battle: JSON.parse(JSON.stringify(battle)) as BattleState, // 深拷贝，避免后续回合污染快照
      battleNodeId: nodeId,
    };
    s.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static load(): SaveData | null {
    const s = this.storage();
    if (!s) return null;
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== RUN_VERSION) return null;
      // 动态卡牌重新注册（铭刻融合产物）
      for (const card of Object.values(data.run.customCards ?? {})) {
        registry.addCards([card]);
      }
      return data;
    } catch (e) {
      console.error('[存档] 解析失败', e);
      return null;
    }
  }

  static clear(): void {
    this.storage()?.removeItem(SAVE_KEY);
  }
}
