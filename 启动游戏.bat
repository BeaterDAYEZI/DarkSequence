@echo off
chcp 65001 >nul
title 暗蚀牌序 · Dark Sequence
cd /d "%~dp0"

echo ============================================
echo   暗蚀牌序 · Dark Sequence 启动器
echo ============================================
echo.

REM 检查依赖是否已安装
if not exist node_modules (
    echo [首次运行] 正在安装依赖，请稍候...
    call npm install --cache .npm-cache
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败。请确认已安装 Node.js（https://nodejs.org）
        pause
        exit /b 1
    )
)

echo [启动] 正在启动游戏服务器...
start "" cmd /c "title 暗蚀牌序服务器 && npm run dev -- --host 127.0.0.1"

REM 等待服务器就绪（最多等15秒）
set /a tries=0
:wait
set /a tries+=1
if %tries% gtr 15 (
    echo [提示] 服务器启动较慢，请手动打开 http://localhost:5173/
    goto open
)
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:5173/ 2>nul
if errorlevel 1 goto wait

:open
echo [完成] 正在打开游戏窗口...
start "" http://localhost:5173/
echo.
echo 提示：游戏服务器窗口请保持开启。关闭它游戏也会关闭。
echo 下次直接双击本文件即可再次启动。
echo.
pause >nul
