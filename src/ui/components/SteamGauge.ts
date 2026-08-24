// 蒸汽压力表：老式表盘显示列车速度（0-5）
import { ASSETS } from '../../core/assets';

export function createSteamGauge(): { el: HTMLElement; setSpeed: (v: number) => void } {
  const el = document.createElement('div');
  el.className = 'steam-gauge';
  el.innerHTML = `
    <div class="gauge-wrap">
      <img class="gauge-face" src="${ASSETS.gaugeFace}" alt="压力表"/>
      <img class="gauge-needle" src="${ASSETS.gaugeNeedle}" alt="指针"/>
      <div class="gauge-value">0</div>
    </div>
    <div class="gauge-label">列车速度 <span class="gauge-speed">0</span>/5</div>
  `;
  const needle = el.querySelector<HTMLElement>('.gauge-needle')!;
  const value = el.querySelector<HTMLElement>('.gauge-value')!;
  const speed = el.querySelector<HTMLElement>('.gauge-speed')!;

  const setSpeed = (v: number) => {
    // 指针角度：-135°(0) → +135°(5)
    const angle = -135 + (v / 5) * 270;
    needle.style.transform = `rotate(${angle}deg)`;
    value.textContent = `${v}`;
    speed.textContent = `${v}`;
    el.dataset.speed = `${v}`;
  };
  setSpeed(0);
  return { el, setSpeed };
}
