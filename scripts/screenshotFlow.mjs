// 完整流程截图：标题→卡组→地图→战斗，分析各界面渲染效果
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1515, height: 768 } });
const errors = [];
const failedReqs = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
page.on('requestfailed', (r) => failedReqs.push(`${r.url().split('/').pop()} (${r.failure()?.errorText})`));

await page.setContent('<iframe sandbox="allow-scripts" src="http://localhost:5173/" style="width:1515px;height:768px;border:0"></iframe>');
await page.waitForTimeout(4500);
const frame = page.frames().find((f) => f.url().includes('localhost'));

await page.screenshot({ path: 'C:/Users/周立宇/AppData/Local/Temp/flow-1-title.png' });

// 卡组选择
await frame.evaluate(() => document.querySelector('.title-start').click());
await page.waitForTimeout(1200);
await page.screenshot({ path: 'C:/Users/周立宇/AppData/Local/Temp/flow-2-deck.png' });
await frame.evaluate(() => document.querySelector('.btn-deck-confirm').click());
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/周立宇/AppData/Local/Temp/flow-3-map.png' });

// 战斗
await frame.evaluate(() => {
  document.querySelector('.map-node.reachable')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'C:/Users/周立宇/AppData/Local/Temp/flow-4-battle.png' });

console.log('页面错误:', errors.length ? errors.join('\n') : '(无)');
console.log('资源失败:', failedReqs.length ? failedReqs.join('\n') : '(无)');
await browser.close();
