@echo off
chcp 936 >nul
title AnShi PaiXu - Dark Sequence
cd /d "%~dp0"

echo ============================================
echo    暗蚀牌序 Dark Sequence 启动器
echo ============================================
echo.

REM 检查服务器是否已在运行
netstat -ano 2>nul | findstr ":5173" | findstr "LISTENING" >nul
if not errorlevel 1 goto :already

if exist node_modules goto :ready
echo [首次运行] 正在安装依赖，请稍候（约1-2分钟）...
call npm install --cache .npm-cache
if errorlevel 1 goto :err
:ready

echo [启动] 游戏服务器启动中...
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173/"

npm run dev
goto :end

:already
echo [提示] 游戏服务器已在运行，直接打开游戏...
start "" http://localhost:5173/
goto :end

:err
echo.
echo [错误] 启动失败，请把本窗口内容截图发给开发者。
echo.
pause
goto :end

:end
echo.
echo 服务器已关闭，游戏结束。
timeout /t 2 /nobreak >nul
