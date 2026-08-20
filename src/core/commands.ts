// 玩家操作 → Command：UI 永不直接改 RunState，只发命令给对应 System
export type Command =
  // ---- 局外 ----
  | { type: 'startRun'; heroOrder?: never }
  | { type: 'continueRun' }
  | { type: 'restartRun' }
  | { type: 'loadSave' }
  // ---- 地图 ----
  | { type: 'travelTo'; nodeId: string }
  | { type: 'chooseFork'; rail: 'memory' | 'oblivion' }
  // ---- 调度站 / 营地 ----
  | { type: 'stationService'; serviceId: string }
  | { type: 'buyTech'; techId: string }
  | { type: 'upgradeCard'; cardId: string }        // 残响碎片升品质
  | { type: 'fuseCards'; cardA: string; cardB: string; via: 'etchant' | 'soulfire' }
  | { type: 'infuseHero'; heroId: string; optionId: string }
  // ---- 战斗 ----
  | { type: 'planCards'; cards: { cardId: string; heroId: string }[] }
  | { type: 'confirmPlan' }
  | { type: 'useSoulfire'; service: 'furnace' | 'horn' }   // 炉火升温 / 鸣笛威慑
  | { type: 'pickExtraCard'; cardId: string }               // 连斩选择
  | { type: 'skipExtraCard' }
  // ---- 通用 ----
  | { type: 'saveGame' }
  | { type: 'debugBattle'; encounterId: string };
