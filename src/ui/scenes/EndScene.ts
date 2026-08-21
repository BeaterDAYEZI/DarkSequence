// 结算场景：败北（列车停摆）与胜利（抵达星蚀山麓）
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { RunController } from '../../game/RunController';

interface EndParams {
  kind: 'gameover' | 'victory';
  reason?: string;
}

export class EndScene implements Scene {
  onEnter(root: HTMLElement, params?: unknown): void {
    const p = (params ?? { kind: 'gameover' }) as EndParams;
    const app = appRef.current;
    const rc = app?.run;
    const stats = rc?.run.stats ?? { kills: 0, damage: 0, turns: 0 };
    const heroSummary = rc
      ? Object.values(rc.run.heroes)
        .map((h) => `${registry.heroes.get(h.heroId)?.name} ${h.alive ? `${h.hp}/${h.maxHp}` : '✝残影'}`)
        .join(' · ')
      : '';

    root.innerHTML = `
      <div class="end-scene ${p.kind}">
        <div class="end-box">
          ${p.kind === 'victory' ? `
            <div class="end-kicker">THE MOUNTAIN AT THE END OF THE WORLD</div>
            <h1>🏆 旅程终点</h1>
            <p class="end-sub">列车抵达了世界中心的高山。星蚀在山顶张开，像一只等待已久的眼睛。</p>
          ` : `
            <h1>💀 列车停摆</h1>
            <p class="end-sub">${p.reason ?? '全员残影化——列车停在了蚀雾里。'}</p>
          `}
          <div class="end-stats">
            <div>击杀 <b>${stats.kills}</b></div>
            <div>造成伤害 <b>${stats.damage}</b></div>
            ${rc ? `<div>到达区域 <b>${registry.zones.get(rc.currentNode.zoneId)?.name ?? '？'}</b></div>` : ''}
          </div>
          ${heroSummary ? `<div class="end-heroes">${heroSummary}</div>` : ''}
          <div class="end-buttons">
            <button class="btn-restart">重新启程</button>
            <button class="btn-title">返回标题</button>
          </div>
        </div>
      </div>`;

    root.querySelector('.btn-restart')?.addEventListener('click', () => {
      const a = appRef.current;
      if (!a) return;
      a.run = new RunController();
      a.go('map');
    });
    root.querySelector('.btn-title')?.addEventListener('click', () => {
      const a = appRef.current;
      if (a) a.run = null;
      a?.go('title');
    });
  }
}
