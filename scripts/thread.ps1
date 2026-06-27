#Requires -Version 5.1
<#
.SYNOPSIS
    並列開発スレッド管理スクリプト

.DESCRIPTION
    各スレッドに独立した Docker 環境（アプリ + DB）を割り当てる。
    スレッド番号 N → アプリ :300N / PostgreSQL :550N

.EXAMPLE
    .\scripts\thread.ps1 start 1        # スレッド 1 起動 → http://localhost:3001
    .\scripts\thread.ps1 logs  1        # スレッド 1 のアプリログを追跡
    .\scripts\thread.ps1 stop  1        # スレッド 1 停止（ボリュームは保持）
    .\scripts\thread.ps1 down  1        # スレッド 1 停止＋コンテナ/ネットワーク削除
    .\scripts\thread.ps1 status         # 全スレッドの稼働状況を表示
    .\scripts\thread.ps1 new 2 feature/my-feature   # ワークツリー作成 → スレッド 2
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("start", "stop", "down", "logs", "status", "new")]
    [string]$Action,

    [Parameter(Position = 1)]
    [string]$Thread,

    [Parameter(Position = 2)]
    [string]$Branch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot    = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot "compose.dev.yml"

# ─── ポート計算 ───────────────────────────────────────────────────────
function Get-Ports([string]$t) {
    $n = 0
    if (-not [int]::TryParse($t, [ref]$n) -or $n -lt 1 -or $n -gt 9) {
        Write-Error "スレッド番号は 1〜9 の整数を指定してください (例: 1)"
        exit 1
    }
    return @{ App = 3000 + $n; Db = 5500 + $n }
}

# ─── docker compose ラッパー ──────────────────────────────────────────
function Invoke-Compose([string]$thread, [string[]]$composeArgs) {
    $ports = Get-Ports $thread

    $env:COMPOSE_PROJECT_NAME = "watchlog-$thread"
    $env:APP_PORT             = [string]$ports.App
    $env:DB_PORT              = [string]$ports.Db

    & docker compose -f $ComposeFile @composeArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# ─── アクション ───────────────────────────────────────────────────────
switch ($Action) {

    "start" {
        if (-not $Thread) { Write-Error "使い方: thread.ps1 start <1-9>"; exit 1 }
        $ports = Get-Ports $Thread
        Write-Host ""
        Write-Host "▶ スレッド $Thread を起動します"
        Write-Host "  App  → http://localhost:$($ports.App)"
        Write-Host "  DB   → localhost:$($ports.Db)  (user/pass: watchlog/watchlog)"
        Write-Host ""
        Invoke-Compose $Thread "up", "-d"
        Write-Host ""
        Write-Host "ログ確認 : .\scripts\thread.ps1 logs $Thread"
        Write-Host "停止     : .\scripts\thread.ps1 stop $Thread"
    }

    "stop" {
        if (-not $Thread) { Write-Error "使い方: thread.ps1 stop <1-9>"; exit 1 }
        Write-Host "⏹ スレッド $Thread を停止します（ボリュームは保持）"
        Invoke-Compose $Thread "stop"
    }

    "down" {
        if (-not $Thread) { Write-Error "使い方: thread.ps1 down <1-9>"; exit 1 }
        Write-Host "⏹ スレッド $Thread を削除します（ボリュームは保持）"
        Invoke-Compose $Thread "down"
    }

    "logs" {
        if (-not $Thread) { Write-Error "使い方: thread.ps1 logs <1-9>"; exit 1 }
        Write-Host "📋 スレッド $Thread のログ (Ctrl+C で終了)"
        Invoke-Compose $Thread "logs", "-f", "app"
    }

    "status" {
        Write-Host "─────────────────────────────────────────────────"
        Write-Host " 稼働中の WatchLog スレッド"
        Write-Host "─────────────────────────────────────────────────"
        docker ps --filter "name=watchlog-" `
            --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    }

    "new" {
        if (-not $Thread) { Write-Error "使い方: thread.ps1 new <1-9> [branch-name]"; exit 1 }

        # デフォルトブランチ名
        $branchName   = if ($Branch) { $Branch } else { "thread/$Thread" }
        $worktreePath = Join-Path (Split-Path -Parent $RepoRoot) "WatchLog-$Thread"

        Write-Host ""
        Write-Host "🌿 Git ワークツリーを作成します"
        Write-Host "  パス     : $worktreePath"
        Write-Host "  ブランチ : $branchName"
        Write-Host ""

        Push-Location $RepoRoot
        try {
            git worktree add $worktreePath -b $branchName
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        } finally {
            Pop-Location
        }

        Write-Host ""
        Write-Host "✅ 完了！次のコマンドでスレッドを起動してください:"
        Write-Host ""
        Write-Host "  cd `"$worktreePath`""
        Write-Host "  .\scripts\thread.ps1 start $Thread"
        Write-Host ""
    }
}
