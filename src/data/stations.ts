// 调度站：列车停靠的特殊站点（魂火消费）
import type { StationServiceDef } from '../core/types';

export const STATION_SERVICES: StationServiceDef[] = [
  {
    id: 'station_forge',
    name: '车钩重铸',
    cost: 30,
    desc: '将两张遗物牌融合（同"铭刻融合"）。',
  },
  {
    id: 'station_coal',
    name: '煤水加注',
    cost: 20,
    desc: '全队恢复全部生命与狂气（清空狂气）。',
  },
  {
    id: 'station_map',
    name: '轨道测绘',
    cost: 10,
    desc: '预览本区域剩余所有节点的内容（决策辅助）。',
  },
  {
    id: 'station_revive',
    name: '灵柩唤醒',
    cost: 50,
    desc: '从阵亡英雄中选一名，以满状态复活（不保留复仇层数）。',
  },
];
