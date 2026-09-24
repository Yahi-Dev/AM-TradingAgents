# Dashboard Persistence Script for AM-TradingAgents
# This script keeps the dev-dashboard.html HTTP server running
# Place in Task Scheduler or run manually to start persistent dashboard

param(
    [switch]$Install = $false
)

$dashboardPath = "C:\Ia-projects\AM-TradingAgents\apps\web"
$logFile = "$dashboardPath\dashboard-persistent.log"
$pidFile = "$dashboardPath\.dashboard-pid"

function Start-DashboardServer {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting dashboard server..." -ForegroundColor Cyan

    # Kill any existing python http.server on 8888
    Get-Process python -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*http.server*8888*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 1

    # Start new server
    Set-Location $dashboardPath
    $process = Start-Process python -ArgumentList "-m http.server 8888 --bind 127.0.0.1" `
        -NoNewWindow `
        -RedirectStandardOutput "$dashboardPath\dashboard.log" `
        -RedirectStandardError "$dashboardPath\dashboard-error.log" `
        -PassThru

    # Save PID
    $process.Id | Out-File -FilePath $pidFile -Force

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Dashboard started (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "  URL: http://127.0.0.1:8888/dev-dashboard.html" -ForegroundColor Cyan
    Write-Host "  Logs: $logFile" -ForegroundColor Gray

    # Log startup
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Dashboard started. PID: $($process.Id)" |
        Add-Content $logFile

    return $process
}

function Monitor-DashboardServer {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Monitoring dashboard server..." -ForegroundColor Cyan

    $checkInterval = 10  # seconds
    $maxRestarts = 0

    while ($true) {
        Start-Sleep -Seconds $checkInterval

        # Check if PID file exists and process is running
        if (Test-Path $pidFile) {
            $pid = Get-Content $pidFile | Select-Object -First 1
            try {
                $process = Get-Process -Id $pid -ErrorAction Stop
                # Process still running, all good
                continue
            }
            catch {
                # Process died, restart
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Process died, restarting..." -ForegroundColor Yellow
                "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Process crashed, restarting." |
                    Add-Content $logFile
                $maxRestarts++

                if ($maxRestarts -gt 10) {
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Too many restarts, giving up" -ForegroundColor Red
                    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Too many restarts, stopping." |
                        Add-Content $logFile
                    break
                }

                Start-DashboardServer
            }
        }
        else {
            # No PID file, start server
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No server running, starting..." -ForegroundColor Yellow
            Start-DashboardServer
        }
    }
}

function Install-TaskScheduler {
    Write-Host "Installing Dashboard as Windows Task Scheduler job..." -ForegroundColor Cyan

    $taskName = "AM-TradingAgents-Dashboard"
    $scriptPath = Join-Path $dashboardPath "start-dashboard.ps1"

    # Remove old task if exists
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    # Create new task
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

    $trigger = New-ScheduledTaskTrigger -AtStartup

    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable:$false

    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "AM-TradingAgents Autonomous Loop Dashboard (HTTP Server)" `
        -User "SYSTEM" `
        -ErrorAction Stop

    Write-Host "✓ Installed as Task Scheduler job: $taskName" -ForegroundColor Green
    Write-Host "  Task will start automatically on next boot" -ForegroundColor Green
}

# Main
if ($Install) {
    Install-TaskScheduler
}
else {
    # Start and monitor
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host " AM-TradingAgents Dashboard — Persistent Server" -ForegroundColor Cyan
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host ""

    Start-DashboardServer
    Write-Host ""

    # Start monitoring loop
    Monitor-DashboardServer
}
