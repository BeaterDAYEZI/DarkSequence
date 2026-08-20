// 入口：加载数据 → 校验 → 创建 App → 挂载标题场景
import './styles/main.css';
import { App } from './app/App';
import { TitleScene } from './ui/scenes/TitleScene';
import { registry } from './core/registry';
import { loadAllData } from './data/index';

const root = document.getElementById('app');
if (!root) throw new Error('缺少 #app 挂载点');

loadAllData();

const app = new App(root);
app.scenes.register('title', new TitleScene());
app.start();
app.go('title');

console.log(
  `[暗蚀牌序] 骨架启动 · 已注册 ${registry.cards.size} 卡 / ${registry.monsters.size} 怪物 / ${registry.zones.size} 区域 / ${registry.heroes.size} 英雄`,
);
