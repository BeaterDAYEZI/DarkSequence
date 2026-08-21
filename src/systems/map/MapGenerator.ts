// 地图生成：每区域一条铁轨线路（起点→战斗×2→岔道→分支→调度站→战斗→Boss）
import type { MapNode, ZoneDef } from '../../core/types';
import type { Rng } from '../../core/rng';

/**
 * 区域节点模板：
 *   start → battle → battle → fork ─┬左轨: battle → elite
 *                                    └右轨: event → battle
 *                                     → station → battle → boss
 */
export function generateZoneMap(zone: ZoneDef, rng: Rng): MapNode[] {
  const p = `${zone.id}_n`;
  const encounters = zone.encounters ?? [];
  const enc = (i: number): string | undefined => encounters[i % encounters.length]?.id;

  const make = (id: string, type: MapNode['type'], extra: Partial<MapNode> = {}): MapNode => ({
    id: `${p}${id}`,
    type,
    zoneId: zone.id,
    next: [],
    resolved: false,
    ...extra,
  });

  const start = make('0', 'start');
  const b1 = make('1', 'battle', { encounterIds: [enc(0)].filter(Boolean) as string[] });
  const b2 = make('2', 'battle', { encounterIds: [enc(1)].filter(Boolean) as string[] });
  const fork = make('3', 'fork');
  const leftBattle = make('4L', 'battle', { encounterIds: [enc(2)].filter(Boolean) as string[] });
  const leftElite = make('5L', 'elite', { encounterIds: [...zone.elitePool] });
  const rightEvent = make('4R', 'event', { eventId: pickEvent(zone, rng) });
  const rightBattle = make('5R', 'battle', { encounterIds: [enc(3)].filter(Boolean) as string[] });
  const station = make('6', 'station');
  const b3 = make('7', 'battle', { encounterIds: [enc(encounters.length - 1)].filter(Boolean) as string[] });
  const boss = make('8', 'boss', { encounterIds: [zone.bossId] });

  start.next = [b1.id];
  b1.next = [b2.id];
  b2.next = [fork.id];
  fork.next = [leftBattle.id, rightEvent.id];
  leftBattle.next = [leftElite.id];
  leftElite.next = [station.id];
  rightEvent.next = [rightBattle.id];
  rightBattle.next = [station.id];
  station.next = [b3.id];
  b3.next = [boss.id];
  boss.next = [];

  return [start, b1, b2, fork, leftBattle, leftElite, rightEvent, rightBattle, station, b3, boss];
}

/** 事件节点随机选取（餐车记忆优先出现一次，其余随机） */
function pickEvent(zone: ZoneDef, rng: Rng): string {
  if (zone.id === 'zone1') return 'event_diningcar';
  const pool = ['event_trackscrap', 'event_trackghost', 'event_foggifts'];
  return rng.pick(pool);
}

/** 生成全部区域地图（RunState.map） */
export function generateAllZones(zones: ZoneDef[], rng: Rng): MapNode[] {
  const all: MapNode[] = [];
  for (const zone of zones) {
    all.push(...generateZoneMap(zone, rng));
  }
  return all;
}
