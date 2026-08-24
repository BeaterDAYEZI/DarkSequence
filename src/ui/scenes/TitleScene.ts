// 标题场景：游戏名、设计哲学、校验报告、开始按钮
import type { Scene } from '../../app/SceneManager';
import { appRef } from '../../app/appRef';
import { registry } from '../../core/registry';
import { RunController } from '../../game/RunController';
import { SaveSystem } from '../../systems/run/SaveSystem';
import { audio } from '../fx/AudioManager';
import { DeckSelectPanel } from '../components/DeckSelectPanel';
import type { DeckChoice } from '../../data/startingDecks';
import type { HeroId } from '../../core/types';
import { ASSETS } from '../../core/assets';

export class TitleScene implements Scene {
  private root!: HTMLElement;

  onEnter(root: HTMLElement): void {
    this.root = root;
    const report = registry.validateAll();

    root.innerHTML = `
      <div class="title-scene" style="background-image:url('${ASSETS.bgTitle}')">
        <div class="title-fog"></div>
        <div class="title-content">
          <div class="title-kicker">DARK SEQUENCE</div>
          <img class="title-logo" src="${ASSETS.logo}" alt="暗蚀牌序" />
          <div class="title-sub">幽灵列车版 · 牌组构筑 Roguelike</div>
          <p class="title-quote">"在绝望的牌序中寻找疯狂的通解，<br/>让痛苦本身成为你指数级膨胀的燃料。"</p>
          <div class="title-report ${report.errors.length ? 'has-error' : 'ok'}">
            <div class="report-head">数据校验：${report.errors.length === 0 ? '通过' : `发现 ${report.errors.length} 个错误`}</div>
            <ul class="report-list">
              ${report.errors.slice(0, 5).map((e) => `<li class="err">✗ ${e}</li>`).join('')}
              ${report.warnings.slice(0, 3).map((w) => `<li class="warn">△ ${w}</li>`).join('')}
              ${report.errors.length === 0 && report.warnings.length === 0 ? '<li class="ok">✓ 一切就绪（当前为工程骨架）</li>' : ''}
            </ul>
          </div>
          <button class="title-start btn-art" title="开始一局新的旅程">开始旅程</button>
          ${SaveSystem.hasSave() ? '<button class="title-continue btn-art" title="从上次的进度继续">继续旅程</button>' : ''}
          <button class="title-debug" title="直接试玩区域一教学遭遇">试玩战斗</button>
          <button class="title-audio" title="切换音效">${audio.enabled ? '🔊 音效开' : '🔇 音效关'}</button>
          <div class="title-foot">残响者 · 衔尾车队 · 幽灵铁轨</div>
        </div>
      </div>
    `;

    this.root.querySelector('.title-start')?.addEventListener('click', () => {
      // 弹出卡组选择面板
      const panel = new DeckSelectPanel((choices: Record<HeroId, DeckChoice>) => {
        panelEl.remove();
        const app = appRef.current;
        if (!app) return;
        app.run?.dispose();
        app.run = new RunController(undefined, choices);
        app.go('map');
      });
      const panelEl = panel.render();
      this.root.appendChild(panelEl);
    });
    this.root.querySelector('.title-continue')?.addEventListener('click', () => {
      const app = appRef.current;
      if (!app) return;
      const data = SaveSystem.load();
      if (!data) return;
      app.run?.dispose();
      app.run = RunController.fromSave(data);
      if (data.battle && data.battleNodeId) {
        app.go('battle', { rc: app.run, nodeId: data.battleNodeId, resume: true, battleSnapshot: data.battle });
      } else {
        app.go('map');
      }
    });
    this.root.querySelector('.title-debug')?.addEventListener('click', () => {
      appRef.current?.go('battle', { encounterId: 'zone1_encounter1' });
    });
    this.root.querySelector('.title-audio')?.addEventListener('click', (e) => {
      audio.toggle();
      (e.currentTarget as HTMLElement).textContent = audio.enabled ? '🔊 音效开' : '🔇 音效关';
    });

    console.log('[暗蚀牌序] 数据校验报告', report);
    (window as unknown as { debugRegistry: unknown }).debugRegistry = registry;
  }
}
