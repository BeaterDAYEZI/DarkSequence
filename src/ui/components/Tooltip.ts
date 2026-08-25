// 全局悬浮说明系统：任何带 data-tip 的元素 hover 时显示说明气泡
export function initTooltip(): void {
  const tip = document.createElement('div');
  tip.className = 'game-tooltip';
  document.body.appendChild(tip);

  let current: HTMLElement | null = null;
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
    if (target && target.dataset.tip) {
      current = target;
      tip.textContent = target.dataset.tip;
      tip.classList.add('show');
      positionTip(tip, e as MouseEvent);
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (current) positionTip(tip, e as MouseEvent);
  });
  document.addEventListener('mouseout', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest?.('[data-tip]')) {
      current = null;
      tip.classList.remove('show');
    }
  });
  // 场景切换时隐藏
  document.addEventListener('scroll', () => tip.classList.remove('show'), true);
}

function positionTip(tip: HTMLElement, e: MouseEvent): void {
  const pad = 14;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  // 防止溢出视口
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
