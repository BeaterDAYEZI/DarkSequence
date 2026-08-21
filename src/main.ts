// 入口：加载数据 → 校验 → 创建 App → 挂载标题场景
import './styles/main.css';
import './styles/battle.css';
import './styles/map.css';
import { App } from './app/App';
import { appRef } from './app/appRef';
import { TitleScene } from './ui/scenes/TitleScene';
import { DebugScene } from './ui/scenes/DebugScene';
import { BattleScene } from './ui/scenes/BattleScene';
import { MapScene } from './ui/scenes/MapScene';
import { EndScene } from './ui/scenes/EndScene';
import { registry } from './core/registry';
import { loadAllData } from './data/index';
import { runDebugBattle, autoPlan } from './debug/battleDebug';

// 控制台调试入口（headless战斗验证）
Object.assign(window, { runDebugBattle, autoPlan });

const root = document.getElementById('app');
if (!root) throw new Error('缺少 #app 挂载点');

loadAllData();

const app = new App(root);
appRef.current = app;
app.scenes.register('title', new TitleScene());
app.scenes.register('debug', new DebugScene());
app.scenes.register('battle', new BattleScene());
app.scenes.register('map', new MapScene());
app.scenes.register('end', new EndScene());
app.start();

const params = new URLSearchParams(location.search);
app.go(params.get('debug') === 'data' ? 'debug' : 'title');

console.log(
  `[暗蚀牌序] 骨架启动 · 已注册 ${registry.cards.size} 卡 / ${registry.monsters.size} 怪物 / ${registry.zones.size} 区域 / ${registry.heroes.size} 英雄`,
);
