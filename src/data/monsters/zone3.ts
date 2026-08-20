// 区域三：灰烬隘口（占位）—— hp×2.2 / 伤害×1.6
import { placeholderMonsters, placeholderElites, placeholderBoss } from './templates';
import type { MonsterDef } from '../../core/types';

const monsters = placeholderMonsters('zone3', '灰烬隘口', 2.2, 1.6);
const elites = placeholderElites('zone3', '灰烬隘口', 2.2, 1.6);
const boss = placeholderBoss('zone3', '灰烬隘口', 2.2, 1.6);

export const ZONE3_MONSTERS: MonsterDef[] = [...monsters, ...elites, boss];
export const ZONE3_ENCOUNTERS = [
  { id: 'zone3_encounter1', monsters: [{ defId: 'zone3_soldier', count: 2 }, { defId: 'zone3_whisperer', count: 1 }] },
  { id: 'zone3_encounter2', monsters: [{ defId: 'zone3_hound', count: 2 }, { defId: 'zone3_bulwark', count: 1 }] },
  { id: 'zone3_encounter3', monsters: [{ defId: 'zone3_archer', count: 2 }, { defId: 'zone3_whisperer', count: 1 }] },
];
