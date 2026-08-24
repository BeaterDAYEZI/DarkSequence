// 数据汇总入口：全部内容数据在此加载进 registry
import { registry } from '../core/registry';
import { HEROES } from './heroes';
import { HERO_CARDS } from './cards';
import { RELIC_CARDS, PUBLIC_RELIC_CARDS, FUSED_CARDS } from './relicCards';
import { ZONE1_MONSTERS } from './monsters/zone1';
import { ZONE2_MONSTERS } from './monsters/zone2';
import { ZONE3_MONSTERS } from './monsters/zone3';
import { ZONE4_MONSTERS } from './monsters/zone4';
import { ZONE5_MONSTERS } from './monsters/zone5';
import { ZONES } from './zones';
import { TECHS } from './techTree';
import { STATION_SERVICES } from './stations';
import { EVENTS } from './events';
import { FUSION_RECIPES } from './fusionRecipes';

export function loadAllData(): void {
  registry.addHeroes(HEROES);
  registry.addCards([...HERO_CARDS, ...RELIC_CARDS, ...PUBLIC_RELIC_CARDS, ...FUSED_CARDS]);
  registry.addMonsters([
    ...ZONE1_MONSTERS,
    ...ZONE2_MONSTERS,
    ...ZONE3_MONSTERS,
    ...ZONE4_MONSTERS,
    ...ZONE5_MONSTERS,
  ]);
  registry.addZones(ZONES);
  registry.addTechs(TECHS);
  registry.addStations(STATION_SERVICES);
  registry.addEvents(EVENTS);
  registry.addFusionRecipes(FUSION_RECIPES);
}
