// 美术资源路径映射（public/assets/）
// 命名规则：bg-背景 / cards-卡牌 / enemies-敌人 / map-地图 / train-列车 / ui-界面
// 注意：路径必须用 BASE 拼接（GitHub Pages 部署在 /DarkSequence/ 子路径下，绝对路径会404）
const BASE = import.meta.env.BASE_URL || './';

export const ASSETS = {
  // 背景
  bgTitle: `${BASE}assets/bg/bg_title.webp`,
  bgZone: [`${BASE}assets/bg/bg_zone1.webp`, `${BASE}assets/bg/bg_zone2.webp`, `${BASE}assets/bg/bg_zone3.webp`, `${BASE}assets/bg/bg_zone4.webp`, `${BASE}assets/bg/bg_zone5.webp`],
  bgVictory: `${BASE}assets/bg/bg_victory.webp`,
  bgDefeat: `${BASE}assets/bg/bg_defeat.webp`,
  logo: `${BASE}assets/bg/logo.webp`,
  // 英雄立绘
  heroes: {
    warwick: `${BASE}assets/heroes/warwick.webp`,
    morgan: `${BASE}assets/heroes/morgan.webp`,
    serafina: `${BASE}assets/heroes/serafina.webp`,
    auris: `${BASE}assets/heroes/auris.webp`,
  },
  // 卡牌
  cardBack: `${BASE}assets/cards/back.webp`,
  cardFrame: { green: `${BASE}assets/cards/frame_green.webp`, blue: `${BASE}assets/cards/frame_blue.webp`, orange: `${BASE}assets/cards/frame_orange.webp` },
  // 敌人（defId → 图）
  enemies: {
    zone1_scarecrow: `${BASE}assets/enemies/scarecrow.webp`,
    zone1_wraith: `${BASE}assets/enemies/wraith.webp`,
    zone1_hound: `${BASE}assets/enemies/hound.webp`,
    zone1_prowler: `${BASE}assets/enemies/prowler.webp`,
    zone1_sleeper: `${BASE}assets/enemies/sleeper.webp`,
    zone1_twin_laugh: `${BASE}assets/enemies/twins.webp`,
    zone1_twin_cry: `${BASE}assets/enemies/twins.webp`,
    zone1_shepherd: `${BASE}assets/enemies/shepherd1.webp`,
    shepherd2: `${BASE}assets/enemies/shepherd2.webp`,
    placeholder: `${BASE}assets/enemies/placeholder.webp`,
  },
  // 地图
  nodes: {
    start: `${BASE}assets/map/node_start.webp`,
    battle: `${BASE}assets/map/node_battle.webp`,
    elite: `${BASE}assets/map/node_elite.webp`,
    station: `${BASE}assets/map/node_station.webp`,
    event: `${BASE}assets/map/node_event.webp`,
    fork: `${BASE}assets/map/node_fork.webp`,
    boss: `${BASE}assets/map/node_boss.webp`,
  },
  trainMarker: `${BASE}assets/map/train_marker.webp`,
  forkRails: `${BASE}assets/map/fork_rails.webp`,
  rail: `${BASE}assets/map/rail.webp`,
  // 列车
  carriage: [`${BASE}assets/train/carriage1.webp`, `${BASE}assets/train/carriage2.webp`, `${BASE}assets/train/carriage3.webp`, `${BASE}assets/train/carriage4.webp`],
  carriageRow: `${BASE}assets/train/row.webp`,
  trainSilhouette: `${BASE}assets/train/silhouette.webp`,
  // UI
  btn: `${BASE}assets/ui/btn.webp`,
  iconSoulfire: `${BASE}assets/ui/icon_soulfire.webp`,
  iconEnergy: `${BASE}assets/ui/icon_energy.webp`,
  iconMadness: `${BASE}assets/ui/icon_madness.webp`,
  iconCost: `${BASE}assets/ui/icon_cost.webp`,
  gaugeFace: `${BASE}assets/ui/gauge_face.webp`,
  gaugeNeedle: `${BASE}assets/ui/gauge_needle.webp`,
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
