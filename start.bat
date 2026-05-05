@echo off
echo === WatchLater AI 起動スクリプト ===
echo.

:: バックエンド起動
echo [1/2] バックエンド (FastAPI) を起動中...
start "WatchLater Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --port 8000"

:: 少し待つ
timeout /t 3 /nobreak > nul

:: フロントエンド起動
echo [2/2] フロントエンド (Next.js) を起動中...
start "WatchLater Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 起動完了！
echo   バックエンド: http://localhost:8000
echo   フロントエンド: http://localhost:3000
echo   APIドキュメント: http://localhost:8000/docs
echo.
timeout /t 5 /nobreak > nul
start http://localhost:3000
