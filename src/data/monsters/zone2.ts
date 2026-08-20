// 区域二：蚀雾沼泽（占位）—— hp×1.5 / 伤害×1.3
import { placeholderMonsters, placeholderElites, placeholderBoss } from './templates';
import type { MonsterDef } from '../../core/types';

const monsters = placeholderMonsters('zone2', '蚀雾沼泽', 1.5, 1.3);
const elites = placeholderElites('zone2', '蚀雾沼泽', 1.5, 1.3);
const boss = placeholderBoss('zone2', '蚀雾沼泽', 1.5, 1.3);

export const ZONE2_MONSTERS: MonsterDef[] = [...monsters, ...elites, boss];
export const ZONE2_ENCOUNTERS = [
  { id: 'zone2_encounter1', monsters: [{ defId: 'zone2_soldier', count: 1 }, { defId: 'zone2_archer', count: 1 }] },
  { id: 'zone2_encounter2', monsters: [{ defId: 'zone2_hound', count: 2 }, { defId: 'zone2_whisperer', count: 1 }] },
  { id: 'zone2_encounter3', monsters: [{ defId: 'zone2_bulwark', count: 1 }, { defId: 'zone2_archer', count: 2 }] },
];
