// 美术资源路径映射（public/assets/）
// 命名规则：bg-背景 / cards-卡牌 / enemies-敌人 / map-地图 / train-列车 / ui-界面
export const ASSETS = {
  // 背景
  bgTitle: '/assets/bg/bg_title.png',
  bgZone: ['/assets/bg/bg_zone1.png', '/assets/bg/bg_zone2.png', '/assets/bg/bg_zone3.png', '/assets/bg/bg_zone4.png', '/assets/bg/bg_zone5.png'],
  bgVictory: '/assets/bg/bg_victory.png',
  bgDefeat: '/assets/bg/bg_defeat.png',
  logo: '/assets/bg/logo.png',
  // 英雄立绘
  heroes: {
    warwick: '/assets/heroes/warwick.png',
    morgan: '/assets/heroes/morgan.png',
    serafina: '/assets/heroes/serafina.png',
    auris: '/assets/heroes/auris.png',
  },
  // 卡牌
  cardBack: '/assets/cards/back.png',
  cardFrame: { green: '/assets/cards/frame_green.png', blue: '/assets/cards/frame_blue.png', orange: '/assets/cards/frame_orange.png' },
  // 敌人（defId → 图）
  enemies: {
    zone1_scarecrow: '/assets/enemies/scarecrow.png',
    zone1_wraith: '/assets/enemies/wraith.png',
    zone1_hound: '/assets/enemies/hound.png',
    zone1_prowler: '/assets/enemies/prowler.png',
    zone1_sleeper: '/assets/enemies/sleeper.png',
    zone1_twin_laugh: '/assets/enemies/twins.png',
    zone1_twin_cry: '/assets/enemies/twins.png',
    zone1_shepherd: '/assets/enemies/shepherd1.png',
    shepherd2: '/assets/enemies/shepherd2.png',
    placeholder: '/assets/enemies/placeholder.png',
  },
  // 地图
  nodes: {
    start: '/assets/map/node_start.png',
    battle: '/assets/map/node_battle.png',
    elite: '/assets/map/node_elite.png',
    station: '/assets/map/node_station.png',
    event: '/assets/map/node_event.png',
    fork: '/assets/map/node_fork.png',
    boss: '/assets/map/node_boss.png',
  },
  trainMarker: '/assets/map/train_marker.png',
  forkRails: '/assets/map/fork_rails.png',
  rail: '/assets/map/rail.png',
  // 列车
  carriage: ['/assets/train/carriage1.png', '/assets/train/carriage2.png', '/assets/train/carriage3.png', '/assets/train/carriage4.png'],
  trainSilhouette: '/assets/train/silhouette.png',
  // UI
  btn: '/assets/ui/btn.png',
  iconSoulfire: '/assets/ui/icon_soulfire.png',
  iconEnergy: '/assets/ui/icon_energy.png',
  iconMadness: '/assets/ui/icon_madness.png',
  iconCost: '/assets/ui/icon_cost.png',
  gaugeFace: '/assets/ui/gauge_face.png',
  gaugeNeedle: '/assets/ui/gauge_needle.png',
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
