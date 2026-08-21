// 重放用户操作：沙箱环境加载游戏 → 点"开始旅程" → 抓取报错
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}\n${e.stack ?? ''}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE.ERROR: ${m.text()}`);
});

await page.setContent('<iframe sandbox="allow-scripts" src="http://localhost:5173/?diag=1" style="width:1200px;height:800px;border:0"></iframe>');
await page.waitForTimeout(4000);
const frame = page.frames().find((f) => f.url().includes('localhost'));

if (!frame) {
  console.log('未找到游戏帧');
  await browser.close();
  process.exit(1);
}

// 检查标题场景是否渲染
const titleInfo = await frame.evaluate(() => {
  const btn = document.querySelector('.title-start');
  return {
    hasTitle: !!document.querySelector('.title-scene'),
    hasStartBtn: !!btn,
    appChildren: document.getElementById('app')?.children.length ?? -1,
    stamp: document.getElementById('boot-stamp')?.textContent ?? '无',
  };
});
console.log('标题状态:', JSON.stringify(titleInfo, null, 2));

if (titleInfo.hasStartBtn) {
  await frame.evaluate(() => {
    document.querySelector('.title-start').click();
  });
  await page.waitForTimeout(3000);

  const after = await frame.evaluate(() => {
    const boxes = [...document.querySelectorAll('div')].filter((d) => d.textContent?.startsWith('⚠'));
    return {
      mapRendered: !!document.querySelector('.map-scene'),
      errorBoxes: boxes.map((b) => b.textContent),
      appChildren: document.getElementById('app')?.children.length ?? -1,
    };
  });
  console.log('点击后状态:', JSON.stringify(after, null, 2));
}

console.log('=== 捕获的错误 ===');
console.log(errors.length ? errors.join('\n---\n') : '(无)');
await browser.close();
