// 战后三选一奖励面板（大更新2）
import type { RewardOption } from '../../systems/run/RewardSystem';

export class RewardPanel {
  constructor(
    private options: RewardOption[],
    private onPick: (option: RewardOption) => void,
    private onDone: () => void,
  ) {}

  render(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'reward-overlay';
    el.innerHTML = `
      <div class="reward-modal">
        <h2>🎁 战后奖励</h2>
        <p class="reward-note">战斗胜利！选择一项奖励：</p>
        <div class="reward-options">
          ${this.options.map((o, i) => `
            <button class="reward-option" data-idx="${i}">
              <span class="reward-icon">${o.icon}</span>
              <span class="reward-title">${o.title}</span>
              <span class="reward-desc">${o.desc}</span>
            </button>`).join('')}
        </div>
      </div>`;

    el.querySelectorAll<HTMLElement>('.reward-option').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.idx);
        const opt = this.options[idx];
        const result = opt.apply();
        b.setAttribute("disabled", "");
        b.classList.add('picked');
        this.onPick(opt);
        const note = document.createElement('div');
        note.className = 'reward-result';
        note.textContent = `✅ ${result}`;
        el.querySelector('.reward-modal')?.appendChild(note);
        setTimeout(() => this.onDone(), 1200);
      });
    });
    return el;
  }
}
