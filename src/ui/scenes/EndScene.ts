// 结算场景：败北（列车停摆）与胜利（抵达星蚀山麓）
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { ASSETS } from '../../core/assets';
import { RunController } from '../../game/RunController';
import { SaveSystem } from '../../systems/run/SaveSystem';

interface EndParams {
  kind: 'gameover' | 'victory';
  reason?: string;
}

export class EndScene implements Scene {
  onEnter(root: HTMLElement, params?: unknown): void {
    const p = (params ?? { kind: 'gameover' }) as EndParams;
    const app = appRef.current;
    const rc = app?.run;
    // 旅程结束：清除存档，释放旧控制器
    SaveSystem.clear();
    rc?.dispose();
    if (app) app.run = null;
    const stats = rc?.run.stats ?? { kills: 0, damage: 0, turns: 0 };
    const heroCards = rc
      ? Object.values(rc.run.heroes).map((h) => {
        const def = registry.heroes.get(h.heroId)!;
        return `
          <div class="end-hero ${h.alive ? '' : 'dead'}">
            <img class="end-hero-art" src="${ASSETS.heroes[h.heroId]}" alt="${def.name}" draggable="false"/>
            <div class="end-hero-name">${def.name}</div>
            <div class="end-hero-hp">${h.alive ? `${h.hp}/${h.maxHp}` : '✝ 残影化'}</div>
          </div>`;
      }).join('')
      : '';

    root.innerHTML = `
      <div class="end-scene ${p.kind}" style="--end-bg:url('${p.kind === 'victory' ? ASSETS.bgVictory : ASSETS.bgDefeat}')">
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
          ${heroCards ? `<div class="end-heroes">${heroCards}</div>` : ''}
          <div class="end-buttons">
            <button class="btn-restart">重新启程</button>
            <button class="btn-title">返回标题</button>
          </div>
        </div>
      </div>`;

    root.querySelector('.btn-restart')?.addEventListener('click', () => {
      const a = appRef.current;
      if (!a) return;
      a.run?.dispose();
      a.run = new RunController();
      a.go('map');
    });
    root.querySelector('.btn-title')?.addEventListener('click', () => {
      appRef.current?.go('title');
    });
  }
}
