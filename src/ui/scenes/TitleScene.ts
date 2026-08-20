// 标题场景：游戏名、设计哲学、校验报告、开始按钮
import type { Scene } from '../../app/SceneManager';
import { registry } from '../../core/registry';

export class TitleScene implements Scene {
  private root!: HTMLElement;

  onEnter(root: HTMLElement): void {
    this.root = root;
    const report = registry.validateAll();

    root.innerHTML = `
      <div class="title-scene">
        <div class="title-fog"></div>
        <div class="title-content">
          <div class="title-kicker">DARK SEQUENCE</div>
          <h1 class="title-main">暗蚀牌序</h1>
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
          <button class="title-start" disabled title="战斗系统开发中">开始旅程（开发中）</button>
          <div class="title-foot">残响者 · 衔尾车队 · 幽灵铁轨</div>
        </div>
      </div>
    `;

    console.log('[暗蚀牌序] 数据校验报告', report);
    (window as unknown as { debugRegistry: unknown }).debugRegistry = registry;
  }
}
