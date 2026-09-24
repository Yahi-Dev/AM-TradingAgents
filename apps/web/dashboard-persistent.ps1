# ============================================================================
# DASHBOARD PERSISTENT LAUNCHER
# Runs the HTTP server and keeps it alive, auto-restarting on crash
# ============================================================================

param(
    [switch]$Background = $false
)

$dashboardPath = "C:\Ia-projects\AM-TradingAgents\apps\web"
$logFile = "$dashboardPath\dashboard-persistent.log"
$processName = "dashboard-server"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor Cyan
    Add-Content -Path $logFile -Value $logMessage -ErrorAction SilentlyContinue
}

function Start-Dashboard {
    Write-Log "Starting dashboard server..."

    # Kill any existing Python http.server on 8888
    Get-Process python -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*http.server*8888*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 1

    Set-Location $dashboardPath

    # Start server
    $process = Start-Process python `
        -ArgumentList "-m http.server 8888 --bind 127.0.0.1" `
        -NoNewWindow `
        -RedirectStandardOutput "$dashboardPath\server.log" `
        -RedirectStandardError "$dashboardPath\server-error.log" `
        -PassThru

    Write-Log "Server started with PID: $($process.Id)"
    return $process
}

function Monitor-Dashboard {
    Write-Log "Monitoring dashboard (will auto-restart if it crashes)..."
    Write-Host ""
    Write-Host "📊 Dashboard running at: http://127.0.0.1:8888/dev-dashboard.html" -ForegroundColor Green
    Write-Host "🔄 Auto-restart enabled. Press Ctrl+C to stop." -ForegroundColor Green
    Write-Host ""

    $lastRestart = Get-Date
    $maxRestarts = 0
    $checkInterval = 5  # seconds

    while ($true) {
        Start-Sleep -Seconds $checkInterval

        # Check if server is still running
        $runningProcess = Get-Process python -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like "*http.server*8888*" }

        if (-not $runningProcess) {
            Write-Log "⚠️  Server died! Restarting..."

            # Check if too many restarts
            $maxRestarts++
            if ($maxRestarts -gt 10) {
                Write-Log "❌ Too many restarts. Stopping."
                break
            }

            Start-Dashboard
            $lastRestart = Get-Date
        }
    }
}

# Main
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Log "================================"
Write-Log "Dashboard Persistent Launcher"
Write-Log "================================"

Start-Dashboard
Monitor-Dashboard
