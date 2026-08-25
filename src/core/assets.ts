// 美术资源路径映射（public/assets/）
// 命名规则：bg-背景 / cards-卡牌 / enemies-敌人 / map-地图 / train-列车 / ui-界面
// 注意：路径必须用 BASE 拼接（GitHub Pages 部署在 /DarkSequence/ 子路径下，绝对路径会404）
const BASE = import.meta.env.BASE_URL || './';

export const ASSETS = {
  // 背景
  bgTitle: `${BASE}assets/bg/bg_title.png`,
  bgZone: [`${BASE}assets/bg/bg_zone1.png`, `${BASE}assets/bg/bg_zone2.png`, `${BASE}assets/bg/bg_zone3.png`, `${BASE}assets/bg/bg_zone4.png`, `${BASE}assets/bg/bg_zone5.png`],
  bgVictory: `${BASE}assets/bg/bg_victory.png`,
  bgDefeat: `${BASE}assets/bg/bg_defeat.png`,
  logo: `${BASE}assets/bg/logo.png`,
  // 英雄立绘
  heroes: {
    warwick: `${BASE}assets/heroes/warwick.png`,
    morgan: `${BASE}assets/heroes/morgan.png`,
    serafina: `${BASE}assets/heroes/serafina.png`,
    auris: `${BASE}assets/heroes/auris.png`,
  },
  // 卡牌
  cardBack: `${BASE}assets/cards/back.png`,
  cardFrame: { green: `${BASE}assets/cards/frame_green.png`, blue: `${BASE}assets/cards/frame_blue.png`, orange: `${BASE}assets/cards/frame_orange.png` },
  // 敌人（defId → 图）
  enemies: {
    zone1_scarecrow: `${BASE}assets/enemies/scarecrow.png`,
    zone1_wraith: `${BASE}assets/enemies/wraith.png`,
    zone1_hound: `${BASE}assets/enemies/hound.png`,
    zone1_prowler: `${BASE}assets/enemies/prowler.png`,
    zone1_sleeper: `${BASE}assets/enemies/sleeper.png`,
    zone1_twin_laugh: `${BASE}assets/enemies/twins.png`,
    zone1_twin_cry: `${BASE}assets/enemies/twins.png`,
    zone1_shepherd: `${BASE}assets/enemies/shepherd1.png`,
    shepherd2: `${BASE}assets/enemies/shepherd2.png`,
    placeholder: `${BASE}assets/enemies/placeholder.png`,
  },
  // 地图
  nodes: {
    start: `${BASE}assets/map/node_start.png`,
    battle: `${BASE}assets/map/node_battle.png`,
    elite: `${BASE}assets/map/node_elite.png`,
    station: `${BASE}assets/map/node_station.png`,
    event: `${BASE}assets/map/node_event.png`,
    fork: `${BASE}assets/map/node_fork.png`,
    boss: `${BASE}assets/map/node_boss.png`,
  },
  trainMarker: `${BASE}assets/map/train_marker.png`,
  forkRails: `${BASE}assets/map/fork_rails.png`,
  rail: `${BASE}assets/map/rail.png`,
  // 列车
  carriage: [`${BASE}assets/train/carriage1.png`, `${BASE}assets/train/carriage2.png`, `${BASE}assets/train/carriage3.png`, `${BASE}assets/train/carriage4.png`],
  carriageRow: `${BASE}assets/train/row.png`,
  trainSilhouette: `${BASE}assets/train/silhouette.png`,
  // UI
  btn: `${BASE}assets/ui/btn.png`,
  iconSoulfire: `${BASE}assets/ui/icon_soulfire.png`,
  iconEnergy: `${BASE}assets/ui/icon_energy.png`,
  iconMadness: `${BASE}assets/ui/icon_madness.png`,
  iconCost: `${BASE}assets/ui/icon_cost.png`,
  gaugeFace: `${BASE}assets/ui/gauge_face.png`,
  gaugeNeedle: `${BASE}assets/ui/gauge_needle.png`,
} as const;

/** 敌人立绘（占位怪/未知用通用图） */
export function enemyArt(defId: string): string {
  const map = ASSETS.enemies as Record<string, string>;
  return map[defId] ?? map.placeholder;
}

/** Boss阶段立绘（残响牧羊人两阶段） */
export function bossPhaseArt(defId: string, phaseIndex: number): string {
  if (defId === 'zone1_shepherd') {
    return phaseIndex >= 1 ? ASSETS.enemies.shepherd2 : ASSETS.enemies.zone1_shepherd;
  }
  return enemyArt(defId);
}
