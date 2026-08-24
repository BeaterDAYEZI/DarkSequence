// 美术实装验证：沙箱环境检查各场景渲染 + 资源加载
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1394, height: 768 } });
const errors = [];
const failedReqs = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
page.on('requestfailed', (r) => { const url = r.url(); if (url.endsWith('.png') || url.endsWith('.jpg')) failedReqs.push(url.split('/').pop() + ' (' + (r.failure()?.errorText ?? '') + ')'); });

await page.setContent('<iframe sandbox="allow-scripts" src="http://localhost:5173/?diag=1" style="width:1394px;height:768px;border:0"></iframe>');
await page.waitForTimeout(4500);
const frame = page.frames().find((f) => f.url().includes('localhost'));

// 1. 标题场景：背景+LOGO
const titleInfo = await frame.evaluate(() => {
  const bg = getComputedStyle(document.querySelector('.title-scene')).backgroundImage;
  const logo = document.querySelector('.title-logo');
  return {
    bgLoaded: bg.includes('bg_title'),
    logoLoaded: logo ? logo.complete && logo.naturalWidth > 0 : false,
  };
});
console.log('标题:', JSON.stringify(titleInfo));

// 2. 卡组选择面板（英雄立绘）
await frame.evaluate(() => document.querySelector('.title-start').click());
await page.waitForTimeout(1500);
const deckInfo = await frame.evaluate(() => {
  const avatars = [...document.querySelectorAll('.deck-hero .hero-avatar')];
  return { avatarCount: avatars.length, allLoaded: avatars.every((a) => a.complete && a.naturalWidth > 0) };
});
console.log('卡组面板立绘:', JSON.stringify(deckInfo));
await frame.evaluate(() => document.querySelector('.btn-deck-confirm').click());
await page.waitForTimeout(1500);

// 3. 地图场景：区域背景+节点图标
const mapInfo = await frame.evaluate(() => {
  const bg = getComputedStyle(document.querySelector('.map-scene')).backgroundImage;
  const nodes = [...document.querySelectorAll('.map-node .node-art')];
  return {
    bgLoaded: bg.includes('bg_zone1'),
    nodeCount: nodes.length,
    nodesLoaded: nodes.every((n) => n.getAttribute('href')?.length > 0),
  };
});
console.log('地图:', JSON.stringify(mapInfo));
// 4. 进入战斗
await frame.evaluate(() => {
  document.querySelector('.map-node.reachable')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(2500);

// 5. 战斗场景：车厢+敌人+压力表+英雄头像
const battleInfo = await frame.evaluate(() => {
  const carriages = [...document.querySelectorAll('.carriage-slot')];
  const enemies = [...document.querySelectorAll('.enemy-art')];
  const gauge = document.querySelector('.gauge-face');
  const avatars = [...document.querySelectorAll('.hero-avatar')];
  return {
    carriageBg: carriages.every((c) => getComputedStyle(c).backgroundImage.includes('carriage')),
    enemyCount: enemies.length,
    enemiesLoaded: enemies.every((e) => e.complete && e.naturalWidth > 0),
    gaugeLoaded: gauge ? gauge.complete && gauge.naturalWidth > 0 : false,
    avatarsLoaded: avatars.every((a) => a.complete && a.naturalWidth > 0),
  };
});
console.log('战斗:', JSON.stringify(battleInfo));
await page.screenshot({ path: 'C:/Users/周立宇/AppData/Local/Temp/art-check.png' });

console.log('=== 页面错误:', errors.length ? errors.join('\n') : '(无)');
console.log('=== 资源加载失败:', failedReqs.length ? failedReqs.join('\n') : '(无)');
const pass = errors.length === 0 && failedReqs.length === 0
  && titleInfo.bgLoaded && titleInfo.logoLoaded && deckInfo.allLoaded
  && mapInfo.bgLoaded && mapInfo.nodesLoaded && battleInfo.enemiesLoaded
  && battleInfo.gaugeLoaded && battleInfo.avatarsLoaded;
console.log(pass ? '✅ 美术实装全部通过' : '❌ 有问题需要修');
await browser.close();
process.exit(pass ? 0 : 1);
