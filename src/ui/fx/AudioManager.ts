// 程序化音效：WebAudio振荡器合成（无外部资源），音效开关持久化
import { eventBus } from '../../core/eventBus';

const AUDIO_KEY = 'dark-sequence-audio';

/** 安全读取localStorage（VS Code集成浏览器等沙箱环境可能抛SecurityError） */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 沙箱环境静默 */
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  enabled = safeGet(AUDIO_KEY) !== 'off';

  constructor() {
    eventBus.on('battleEvent', (e) => {
      if (!this.enabled) return;
      switch (e.kind) {
        case 'damage': this.thud(); break;
        case 'heal': this.bell(); break;
        case 'madness': this.whisper(); break;
        case 'soulfire': this.ember(); break;
        case 'system': this.click(); break;
        case 'narration': this.whistle(); break;
      }
    });
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    safeSet(AUDIO_KEY, this.enabled ? 'on' : 'off');
    return this.enabled;
  }

  /** 首次用户交互后解锁音频 */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        /* 音频不可用则静默 */
      }
    }
    this.ctx?.resume().catch(() => {});
  }

  private beep(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.05): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /** 列车咔嗒（回合） */
  private click(): void { this.beep(180, 0.08, 'square', 0.03); this.beep(140, 0.06, 'square', 0.02); }
  /** 受击闷响 */
  private thud(): void { this.beep(90, 0.2, 'sawtooth', 0.06); }
  /** 治疗钟鸣 */
  private bell(): void { this.beep(880, 0.5, 'sine', 0.04); this.beep(1320, 0.3, 'sine', 0.02); }
  /** 狂气低语 */
  private whisper(): void { this.beep(220, 0.4, 'triangle', 0.04); }
  /** 魂火噼啪 */
  private ember(): void { this.beep(1200, 0.08, 'sawtooth', 0.03); }
  /** 觉醒汽笛 */
  private whistle(): void { this.beep(440, 0.8, 'sawtooth', 0.05); this.beep(660, 0.6, 'sawtooth', 0.03); }
}

export const audio = new AudioManager();
