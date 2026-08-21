// 蒸汽压力表：老式表盘显示列车速度（0-5）
export function createSteamGauge(): { el: HTMLElement; setSpeed: (v: number) => void } {
  const el = document.createElement('div');
  el.className = 'steam-gauge';
  el.innerHTML = `
    <svg viewBox="0 0 100 62">
      <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#34344a" stroke-width="5" stroke-linecap="round"/>
      <path class="gauge-fill" d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#e07030" stroke-width="5" stroke-linecap="round"
            pathLength="100" stroke-dasharray="0 100"/>
      <line class="gauge-needle" x1="50" y1="55" x2="50" y2="22" stroke="#c9a227" stroke-width="2.5"/>
      <circle cx="50" cy="55" r="4" fill="#c9a227"/>
    </svg>
    <div class="gauge-label">列车速度 <span class="gauge-value">0</span>/5</div>
  `;
  const needle = el.querySelector<SVGLineElement>('.gauge-needle')!;
  const fill = el.querySelector<SVGPathElement>('.gauge-fill')!;
  const value = el.querySelector<HTMLElement>('.gauge-value')!;

  const setSpeed = (v: number) => {
    // 指针角度：-90°(0) → +90°(5)
    const angle = -90 + (v / 5) * 180;
    needle.setAttribute('transform', `rotate(${angle} 50 55)`);
    fill.setAttribute('stroke-dasharray', `${(v / 5) * 100} 100`);
    value.textContent = `${v}`;
    el.dataset.speed = `${v}`;
  };
  setSpeed(0);
  return { el, setSpeed };
}
