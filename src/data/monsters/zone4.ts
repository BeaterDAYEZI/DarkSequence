// 区域四：断桥深渊（占位）—— hp×3 / 伤害×2
import { placeholderMonsters, placeholderElites, placeholderBoss } from './templates';
import type { MonsterDef } from '../../core/types';

const monsters = placeholderMonsters('zone4', '断桥深渊', 3, 2);
const elites = placeholderElites('zone4', '断桥深渊', 3, 2);
const boss = placeholderBoss('zone4', '断桥深渊', 3, 2);

export const ZONE4_MONSTERS: MonsterDef[] = [...monsters, ...elites, boss];
export const ZONE4_ENCOUNTERS = [
  { id: 'zone4_encounter1', monsters: [{ defId: 'zone4_soldier', count: 1 }, { defId: 'zone4_hound', count: 2 }] },
  { id: 'zone4_encounter2', monsters: [{ defId: 'zone4_bulwark', count: 1 }, { defId: 'zone4_archer', count: 2 }] },
  { id: 'zone4_encounter3', monsters: [{ defId: 'zone4_whisperer', count: 2 }, { defId: 'zone4_soldier', count: 1 }] },
];
