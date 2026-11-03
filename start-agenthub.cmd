@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   AgentHub 正在启动...
echo.
node server.js
if errorlevel 1 (
  echo.
  echo   启动失败。请确认已安装 Node.js 24 或更高版本。
  pause
)
