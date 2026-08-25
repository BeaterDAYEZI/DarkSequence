// 调度站：列车停靠的特殊站点（魂火统一消费，大更新2价格表）
import type { StationServiceDef } from '../core/types';

export const STATION_SERVICES: StationServiceDef[] = [
  {
    id: 'station_forge',
    name: '铭刻融合',
    cost: 15,
    desc: '将两张公共牌融合为一张（同"铭刻融合"）。',
  },
  {
    id: 'station_revive',
    name: '灵柩复生',
    cost: 30,
    desc: '从阵亡英雄中选一名，以满状态复活（不保留复仇层数）。',
  },
  {
    id: 'station_restore',
    name: '全队恢复',
    cost: 10,
    desc: '全队恢复全部生命与狂气（清空狂气）。',
  },
  {
    id: 'station_redraw',
    name: '轨道重绘',
    cost: 5,
    desc: '重选一次本区域的岔道（重置已选岔道）。',
  },
  {
    id: 'station_copy',
    name: '炼金复制',
    cost: 25,
    desc: '复制一件已装备的全局遗物（需有空槽位）。',
  },
  {
    id: 'station_exchange',
    name: '蚀刻剂兑换',
    cost: 20,
    desc: '用20魂火兑换1瓶蚀刻剂。',
  },
];
