// 地图场景：幽灵铁轨俯视图，节点旅行 + 岔道/调度站/事件弹窗
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { eventBus } from '../../core/eventBus';
import type { RunController } from '../../game/RunController';
import type { MapNode } from '../../core/types';
import { ASSETS } from '../../core/assets';
import { CampPanel } from '../components/CampPanel';

const NODE_ICON: Record<string, string> = {
  start: '🚂', battle: '⚔️', elite: '💀', station: '🏚️', event: '❓', fork: '🔀', boss: '👑',
};

const NODE_NAME: Record<string, string> = {
  start: '起点', battle: '遭遇战', elite: '精英', station: '调度站', event: '事件', fork: '岔道', boss: 'Boss车厢',
};

/** 地图布局：列间距与边距（SVG viewBox 坐标系） */
const MAP_COL_W = 210;
const MAP_OFFSET_X = 140;
const MAP_VIEW_W = 640;
const MAP_ROW_H = 110;
const MAP_OFFSET_Y = 40;
/** 布局坐标换算 */
const nodeX = (x: number): number => x * MAP_COL_W + MAP_OFFSET_X;
const nodeY = (y: number): number => y * MAP_ROW_H + MAP_OFFSET_Y;

export class MapScene implements Scene {
  private root!: HTMLElement;
  private rc!: RunController;
  private modal: string | null = null;
  private banner: string | null = null;
  private offs: (() => void)[] = [];

  onEnter(root: HTMLElement, params?: unknown): void {
    this.root = root;
    const app = appRef.current;
    if (!app?.run) {
      this.root.innerHTML = '<div class="map-error">没有进行中的旅程</div>';
      return;
    }
    this.rc = app.run;
    const bannerParam = (params as { banner?: string } | undefined)?.banner;
    this.banner = bannerParam ?? this.zoneBanner();
    this.offs.push(eventBus.on('stateChanged', (e) => {
      if (e.scope === 'map' || e.scope === 'resources') this.render();
    }));
    this.render();
  }

  onExit(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  private get run() { return this.rc.run; }
  private get zone() { return this.rc.currentZoneDef; }
  private get currentNode() { return this.rc.currentNode; }

  /** 区域进入横幅旁白 */
  private zoneBanner(): string {
    const zone = this.zone;
    const zoneIds = [...registry.zones.values()].map((z) => z.id);
    if (this.currentNode.type === 'start' && this.currentNode.id.endsWith('_n0')) {
      return `进入【${zone.name}】——${zone.entryNarration}`;
    }
    return '';
  }

  // ================= 布局 =================
  private layout(): Map<string, { x: number; y: number }> {
    const zoneNodes = this.run.map.filter((n) => n.zoneId === this.zone.id);
    const start = zoneNodes.find((n) => n.type === 'start')!;
    const depth = new Map<string, number>();
    const queue = [start.id];
    depth.set(start.id, 0);
    const layers = new Map<number, string[]>();
    while (queue.length) {
      const id = queue.shift()!;
      const d = depth.get(id)!;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)!.push(id);
      for (const nextId of this.nodeById(id).next) {
        if (!depth.has(nextId)) {
          depth.set(nextId, d + 1);
          queue.push(nextId);
        }
      }
    }
    const pos = new Map<string, { x: number; y: number }>();
    for (const [d, ids] of layers) {
      for (const id of ids) {
        let x = 1;
        if (id.includes('_n4L') || id.includes('_n5L')) x = 0;
        if (id.includes('_n4R') || id.includes('_n5R')) x = 2;
        pos.set(id, { x, y: d });
      }
    }
    return pos;
  }

  private nodeById(id: string): MapNode {
    return this.run.map.find((n) => n.id === id)!;
  }

  // ================= 渲染 =================
  private render(): void {
    const zone = this.zone;
    const pos = this.layout();
    const zoneNodes = this.run.map.filter((n) => n.zoneId === zone.id);
    const reachable = this.rc.getReachable();
    const current = this.currentNode;
    const mapped = this.run.flags[`mapped_${zone.id}`] === true;
    const resources = this.run.resources;

    // 节点（美术图标）
    const nodeEls = zoneNodes.map((n) => {
      const p = pos.get(n.id)!;
      const isCurrent = n.id === current.id;
      const isReachable = reachable.some((r) => r.id === n.id);
      const cls = `map-node type-${n.type}${isCurrent ? ' current' : ''}${n.resolved ? ' resolved' : ''}${isReachable ? ' reachable' : ''}`;
      const preview = this.nodePreview(n, mapped);
      const art = (ASSETS.nodes as Record<string, string>)[n.type] ?? ASSETS.nodes.battle;
      return `<g class="${cls}" data-node="${n.id}" transform="translate(${nodeX(p.x)}, ${nodeY(p.y)})">
        <image href="${art}" x="-42" y="-46" width="84" height="84" class="node-art"/>
        <text class="node-label" y="48" text-anchor="middle">${NODE_NAME[n.type]}</text>
        ${preview ? `<text class="node-preview" y="62" text-anchor="middle">${preview}</text>` : ''}
      </g>`;
    }).join('');

    // 连线
    const edgeEls = zoneNodes.flatMap((n) => {
      const from = pos.get(n.id)!;
      const edges: string[] = [];
      let targets = n.next;
      // 岔道：未选择前不画分支（或画虚线），已选择只画选中分支
      if (n.type === 'fork' && !this.rc.isForkChosen(n)) targets = [];
      if (n.type === 'fork' && this.rc.isForkChosen(n)) targets = [this.rc.chosenForkBranch(n)];
      for (const t of targets) {
        const to = pos.get(t)!;
        const isLeft = n.type === 'fork' && t === n.next[0];
        const isRight = n.type === 'fork' && t === n.next[1];
        const stroke = isLeft ? 'var(--rail-red)' : isRight ? 'var(--rail-blue)' : '#3a3a52';
        edges.push(`<line x1="${nodeX(from.x)}" y1="${nodeY(from.y) + 28}" x2="${nodeX(to.x)}" y2="${nodeY(to.y) - 28}"
          stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>`);
      }
      return edges;
    }).join('');

    const zoneBg = ASSETS.bgZone[Number(zone.id.replace('zone', '')) - 1] ?? ASSETS.bgZone[0];
    this.root.innerHTML = `
      <div class="map-scene" style="background-image:url('${zoneBg}')">
        <div class="map-top">
          <div class="map-zone">${zone.name}${zone.isPlaceholder ? '（占位）' : ''}</div>
          <div class="map-env" title="${zone.environmentRule.desc}">⚙ ${zone.environmentRule.name}</div>
          <div class="map-res">
            <span data-tip="魂火——唯一通用货币
获取：溢伤转化、战斗奖励、事件
用途：列车加速、调度站消费（融合/复活/回血/重绘/复制/兑换）"><img src="${ASSETS.iconSoulfire}" class="res-icon"/>${resources.soulfire}</span>
            <span data-tip="残响碎片——升级英雄专属牌品质
获取：战斗胜利、精英掉落
用途：白→绿→蓝→橙 升级（营地-卡牌升级）">💠${resources.shards}</span>
            <span data-tip="执念值——灌注英雄属性
获取：战斗胜利、营地事件
用途：灌注力量/壁垒/敏捷/意志，累计3/6/10次突破阈值解锁被动">🕯️${resources.obsession}</span>
            <span data-tip="蚀刻剂——铭刻融合
获取：Boss掉落、调度站兑换（20魂火→1）
用途：融合两张卡牌为一张更强卡">🧪${resources.etchant}</span>
            <span data-tip="蚀铁——解锁列车科技树
获取：区域Boss掉落、岔道奖励、分解遗物
用途：科技树全局永久升级">⛓️${resources.darkIron}</span>
          </div>
          <div class="map-relics" data-tip="全局遗物——被动效果，永久持续
不占牌组、不出现在手牌
获取：三选一奖励；最多装备${this.rc.run.relicSlots}件（击败区域2/4Boss解锁新槽位）">${this.rc.relicNames.map((n, i) => `<span class="relic-chip" data-tip="${this.rc.relicTips[i] ?? n}">◆${n}</span>`).join('') || '<span class="relic-chip-empty">未装备</span>'}</div>
          <div class="map-heroes">${this.rc.heroSummary}</div>
          <button class="btn-menu">菜单</button>
        </div>
        <div class="map-main">
          <svg class="map-svg" viewBox="0 0 ${MAP_VIEW_W} ${Math.max(9 * MAP_ROW_H + 80, 900)}" preserveAspectRatio="xMidYMin meet">
            
            ${edgeEls}
            ${nodeEls}
          </svg>
        </div>
        <div class="map-foot">${this.footerText(reachable)}</div>
        ${this.banner ? `<div class="zone-banner" id="zone-banner">${this.banner}</div>` : ''}
        ${this.modalHtml()}
      </div>
    `;
    // 区域横幅：4秒后自动淡出，避免遮挡路线
    const banner = this.root.querySelector('#zone-banner');
    if (banner) {
      setTimeout(() => banner.classList.add('fade-out'), 4000);
    }
    this.bind();
  }

  private nodePreview(n: MapNode, mapped: boolean): string {
    if (!mapped && !n.resolved && n.type !== 'start') return '···';
    if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') {
      const monsters = this.rc.encounterMonsters(n);
      return monsters.map((m) => registry.monsters.get(m.defId)?.name).join('/');
    }
    if (n.type === 'event') return registry.events.get(n.eventId ?? '')?.title ?? '';
    if (n.type === 'station') return '停靠服务';
    if (n.type === 'fork') return '左/右轨';
    return '';
  }

  private footerText(reachable: MapNode[]): string {
    if (this.run.flags['runComplete']) return '旅程结束';
    if (this.currentNode.type === 'fork' && !this.rc.isForkChosen(this.currentNode)) {
      return '前方岔道——必须选择左轨或右轨';
    }
    if (reachable.length === 0) return this.currentNode.type === 'boss' ? '' : '终点';
    return `可前往：${reachable.map((n) => NODE_NAME[n.type]).join(' / ')}`;
  }

  // ================= 弹窗 =================
  private modalHtml(): string {
    if (!this.modal) return '';
    if (this.modal === 'fork') return this.forkModal();
    if (this.modal === 'station') return this.stationModal();
    if (this.modal === 'event') return this.eventModal();
    return '';
  }

  private forkModal(): string {
    return `
      <div class="map-overlay">
        <div class="map-modal fork-modal">
          <h2>🔀 扳道岔</h2>
          <p class="fork-note">"前方岔道……左轨通往记忆，右轨通往遗忘。"</p>
          <div class="fork-options">
            <button class="fork-btn rail-memory" data-rail="memory">
              <div class="fork-rail">◀ 左轨 · 记忆之轨</div>
              <div class="fork-desc">从牌库中永久删除一张随机遗物牌（构筑代价）<br/>本区域所有英雄 <b>力量+3</b></div>
            </button>
            <button class="fork-btn rail-oblivion" data-rail="oblivion">
              <div class="fork-rail">右轨 · 遗忘之轨 ▶</div>
              <div class="fork-desc">复制一张随机遗物牌（构筑收益）<br/>本区域所有英雄 <b>壁垒-2</b></div>
            </button>
          </div>
        </div>
      </div>`;
  }

  private stationModal(): string {
    const soulfire = this.run.resources.soulfire;
    const services = [...registry.stations.values()].map((s) => {
      const available = ['station_coal', 'station_map'].includes(s.id);
      const affordable = soulfire >= s.cost;
      const cls = !available ? 'locked' : affordable ? '' : 'poor';
      return `<button class="station-service ${cls}" data-service="${s.id}" ${available && affordable ? '' : 'disabled'}>
        <span class="s-name">${s.name}</span>
        <span class="s-cost">🔥${s.cost}</span>
        <span class="s-desc">${s.desc}${available ? '' : '（后续开放）'}</span>
      </button>`;
    }).join('');
    return `
      <div class="map-overlay">
        <div class="map-modal station-modal">
          <h2>🏚️ 调度站</h2>
          <p class="station-note">列车缓缓停靠。站牌锈得看不清字，但每个钩子都还结实。</p>
          <div class="station-services">${services}</div>
          <button class="btn-leave">离开调度站</button>
        </div>
      </div>`;
  }

  private eventModal(): string {
    const node = this.currentNode;
    const event = registry.events.get(node.eventId ?? 'event_trackscrap');
    if (!event) return '';
    return `
      <div class="map-overlay">
        <div class="map-modal event-modal">
          <h2>${event.title}</h2>
          <p class="event-text">${event.text}</p>
          <div class="event-choices">
            ${event.choices.map((c, i) => `<button class="event-choice" data-choice="${i}">${c.text}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // ================= 交互 =================
  private bind(): void {
    // 节点点击
    this.root.querySelectorAll<SVGGElement>('.map-node.reachable').forEach((el) => {
      el.addEventListener('click', () => {
        this.travelTo(el.dataset.node!);
      });
    });

    // 岔道选择
    this.root.querySelectorAll<HTMLElement>('.fork-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const rail = el.dataset.rail as 'memory' | 'oblivion';
        const result = this.rc.chooseFork(rail);
        this.modal = null;
        this.banner = result.logs.map((l) => l.text).join('；');
        this.render();
      });
    });

    // 调度站服务
    this.root.querySelectorAll<HTMLElement>('.station-service').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.service!;
        let result: { text: string };
        if (id === 'station_restore') result = this.rc.stationCoal();
        else if (id === 'station_map') result = this.rc.stationMap();
        else if (id === 'station_redraw') result = this.rc.stationRedraw();
        else if (id === 'station_copy') result = this.rc.stationCopy();
        else if (id === 'station_exchange') result = this.rc.stationExchange();
        else result = { text: '该服务暂不可用' };
        this.banner = result.text;
        this.render();
      });
    });
    this.root.querySelector('.btn-leave')?.addEventListener('click', () => {
      this.modal = null;
      this.rc.resolveCurrentNode();
      this.render();
    });

    // 事件选项
    this.root.querySelectorAll<HTMLElement>('.event-choice').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.choice);
        const node = this.currentNode;
        const result = this.rc.resolveEvent(node.eventId ?? 'event_trackscrap', idx);
        this.modal = null;
        this.rc.resolveCurrentNode();
        this.banner = result.logs.join('；') || '你选择了离开。';
        this.render();
      });
    });

    // 菜单 → 营地
    this.root.querySelector('.btn-menu')?.addEventListener('click', () => {
      this.modal = 'camp';
      this.render();
      const overlay = this.root.querySelector('.map-overlay');
      if (overlay) {
        const panel = new CampPanel(this.rc, () => {
          this.modal = null;
          this.render();
        });
        overlay.replaceWith(panel.render());
      }
    });
    // 营地内结束旅程
    this.root.querySelector('.btn-camp-end')?.addEventListener('click', () => {
      this.rc.dispose();
      appRef.current!.run = null;
      appRef.current?.go('title');
    });
  }

  private travelTo(nodeId: string): void {
    const enter = this.rc.travelTo(nodeId);
    if (!enter) return;
    switch (enter.type) {
      case 'battle':
        appRef.current?.go('battle', { rc: this.rc, nodeId, monsters: enter.monsters });
        break;
      case 'fork':
        this.modal = 'fork';
        this.render();
        break;
      case 'station':
        this.modal = 'station';
        this.render();
        break;
      case 'event':
        this.modal = 'event';
        this.render();
        break;
    }
  }
}
