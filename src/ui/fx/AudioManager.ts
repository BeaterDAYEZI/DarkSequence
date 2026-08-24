// 音频管理：BGM（场景音乐循环）+ 程序化音效（WebAudio振荡器），开关持久化
import { eventBus } from '../../core/eventBus';

const AUDIO_KEY = 'dark-sequence-audio';

/** 场景音乐映射 */
const BGM_MAP: Record<string, string> = {
  title: '/assets/audio/menu.wav',     // 主菜单标题界面
  map: '/assets/audio/explore.wav',    // 区域探索
  battle: '/assets/audio/battle.wav',  // 普通战斗
  boss: '/assets/audio/boss.wav',      // Boss战
  camp: '/assets/audio/camp.wav',      // 营地调度站
  fail: '/assets/audio/fail.wav',      // 游戏失败
  awaken: '/assets/audio/awaken.wav',  // 狂气觉醒（战斗内覆盖曲）
};

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
  private bgm: HTMLAudioElement | null = null;
  private currentKey: string | null = null;
  /** 觉醒覆盖中的曲目（结束恢复场景曲） */
  private overrideKey: string | null = null;
  /** 场景级曲目（sceneChanged 时更新） */
  private sceneKey: string | null = null;
  enabled = safeGet(AUDIO_KEY) !== 'off';

  constructor() {
    // 程序化音效
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
    // 场景切换 → 切 BGM
    eventBus.on('sceneChanged', (e) => {
      const key = e.scene === 'end' ? 'fail' : e.scene;
      this.sceneKey = key in BGM_MAP ? key : null;
      if (!this.overrideKey) this.playBgm(this.sceneKey);
    });
    // 觉醒：覆盖场景曲；觉醒结束恢复
    eventBus.on('awaken', () => this.playAwaken());
    eventBus.on('awakenEnd', () => this.endAwaken());
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    safeSet(AUDIO_KEY, this.enabled ? 'on' : 'off');
    if (this.enabled) {
      this.bgm?.play().catch(() => {});
    } else {
      this.bgm?.pause();
    }
    return this.enabled;
  }

  /** 首次用户交互后解锁音频（含恢复被浏览器拦截的 BGM） */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        /* 音频不可用则静默 */
      }
    }
    this.ctx?.resume().catch(() => {});
    if (this.enabled && this.bgm && this.bgm.paused) {
      this.bgm.play().catch(() => {});
    }
  }

  // ================= BGM =================
  /** 播放指定场景音乐（循环） */
  playBgm(key: string | null): void {
    if (!key) {
      this.stopBgm();
      return;
    }
    if (this.overrideKey) return; // 觉醒覆盖中，忽略场景切换
    this.switchBgm(key);
  }

  /** 觉醒曲：覆盖当前场景曲，循环播放 */
  playAwaken(): void {
    this.overrideKey = 'awaken';
    this.switchBgm('awaken');
  }

  /** 觉醒结束：恢复场景曲 */
  endAwaken(): void {
    this.overrideKey = null;
    if (this.sceneKey) this.switchBgm(this.sceneKey);
    else this.stopBgm();
  }

  private switchBgm(key: string): void {
    const url = BGM_MAP[key];
    if (!url) {
      this.stopBgm();
      return;
    }
    if (this.currentKey === key && this.bgm) {
      if (this.enabled && this.bgm.paused) this.bgm.play().catch(() => {});
      return;
    }
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.src = '';
      this.bgm = null;
    }
    const a = new Audio(url);
    a.loop = true;
    a.volume = 0.65;
    a.preload = 'auto';
    this.bgm = a;
    this.currentKey = key;
    if (this.enabled) a.play().catch(() => {});
  }

  private stopBgm(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.src = '';
      this.bgm = null;
    }
    this.currentKey = null;
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
