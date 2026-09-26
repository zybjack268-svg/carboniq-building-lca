@echo off
chcp 65001 >nul
title 宿舍楼碳排放网站
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo 正在生成网站文件，请稍候...
  call npm run build
  if errorlevel 1 (
    echo 网站构建失败，请截图发给我。
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\打开本地预览.ps1"
if errorlevel 1 pause
