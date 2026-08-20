// 区域五：星蚀山麓（占位）—— hp×4 / 伤害×2.5
import { placeholderMonsters, placeholderElites, placeholderBoss } from './templates';
import type { MonsterDef } from '../../core/types';

const monsters = placeholderMonsters('zone5', '星蚀山麓', 4, 2.5);
const elites = placeholderElites('zone5', '星蚀山麓', 4, 2.5);
const boss = placeholderBoss('zone5', '星蚀山麓', 4, 2.5);

export const ZONE5_MONSTERS: MonsterDef[] = [...monsters, ...elites, boss];
export const ZONE5_ENCOUNTERS = [
  { id: 'zone5_encounter1', monsters: [{ defId: 'zone5_soldier', count: 2 }, { defId: 'zone5_bulwark', count: 1 }] },
  { id: 'zone5_encounter2', monsters: [{ defId: 'zone5_hound', count: 2 }, { defId: 'zone5_whisperer', count: 2 }] },
  { id: 'zone5_encounter3', monsters: [{ defId: 'zone5_archer', count: 2 }, { defId: 'zone5_bulwark', count: 1 }] },
];
