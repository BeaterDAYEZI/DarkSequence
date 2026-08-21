import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
const consoleMsgs = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}\n${e.stack ?? ''}`));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`[${m.type()}] ${m.text()}`);
});

// 沙箱iframe模拟VS Code集成浏览器环境
await page.setContent('<iframe sandbox="allow-scripts" src="http://localhost:5173/" style="width:900px;height:700px;border:0"></iframe>');
await page.waitForTimeout(5000);

const frames = page.frames();
console.log('=== iframe帧数:', frames.length, '===');
for (const f of frames) {
  try {
    const appHtml = await f.evaluate(() => {
      const app = document.getElementById('app');
      return { hasApp: !!app, children: app ? app.children.length : -1, innerLen: app ? app.innerHTML.length : -1, bodyLen: document.body.innerHTML.length };
    });
    console.log('帧', f.url().slice(0, 60), JSON.stringify(appHtml));
    // 尝试读localStorage行为
    try {
      const storage = await f.evaluate(() => {
        try { return 'localStorage OK: ' + typeof localStorage; }
        catch (e) { return 'localStorage THROWS: ' + e.name + ' ' + e.message; }
      });
      console.log('  storage:', storage);
    } catch (e) { console.log('  storage检查失败:', e.message); }
  } catch (e) {
    console.log('帧评估失败:', e.message.slice(0, 200));
  }
}
console.log('=== 错误 ===');
console.log(errors.length ? errors.join('\n---\n') : '(无页面异常)');
console.log('=== 控制台 ===');
console.log(consoleMsgs.length ? consoleMsgs.slice(0, 10).join('\n') : '(无)');
await browser.close();
