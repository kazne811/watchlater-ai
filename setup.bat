@echo off
echo === WatchLater AI セットアップ ===
echo.

:: バックエンドのセットアップ
echo [1/3] Pythonライブラリをインストール中...
cd /d %~dp0backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo エラー: pip install に失敗しました
    pause
    exit /b 1
)

:: .env ファイルのセットアップ
if not exist .env (
    echo.
    echo [2/3] .env ファイルを作成中...
    copy .env.example .env
    echo .
    echo *** 重要 ***
    echo backend\.env を開いて ANTHROPIC_API_KEY を設定してください
    echo  → https://console.anthropic.com/settings/keys でAPIキーを取得
    echo.
    notepad .env
) else (
    echo [2/3] .env はすでに存在します（スキップ）
)

:: フロントエンドのセットアップ
echo.
echo [3/3] Node.js パッケージをインストール中...
cd /d %~dp0frontend
npm install
if %errorlevel% neq 0 (
    echo エラー: npm install に失敗しました
    pause
    exit /b 1
)

echo.
echo =============================
echo セットアップ完了！
echo start.bat を実行してアプリを起動してください
echo =============================
pause
