import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    // 允许沙箱环境（VS Code集成浏览器等 origin=null 的页面）加载模块脚本
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: { outDir: 'dist', target: 'es2022' },
});
