# ============================================================================
# INSTALADOR DE SERVICIO PERSISTENTE PARA DASHBOARD
# Crea un verdadero servicio de Windows que se ejecuta al inicio
# ============================================================================

param(
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'status')]
    [string]$Action = 'install'
)

$serviceName = "AM-TradingAgents-Dashboard"
$serviceDisplayName = "AM-TradingAgents Dashboard HTTP Server"
$dashboardPath = "C:\Ia-projects\AM-TradingAgents\apps\web"
$pythonExe = "python"
$pythonArgs = "-m http.server 8888 --bind 127.0.0.1"
$logFile = "$dashboardPath\dashboard-service.log"

# Admin check
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Este script REQUIERE permisos de administrador" -ForegroundColor Red
    Write-Host "   Abre PowerShell como Administrador y vuelve a intentar" -ForegroundColor Yellow
    exit 1
}

function Install-Dashboard {
    Write-Host "Installing dashboard service..." -ForegroundColor Cyan

    # Check if service already exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "⚠️  Service already exists. Removing first..." -ForegroundColor Yellow
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Remove-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    # Create service using sc.exe (built-in Windows utility)
    $cmd = "sc create $serviceName binPath= `"$pythonExe -m http.server 8888 --bind 127.0.0.1`" start= auto DisplayName= `"$serviceDisplayName`""

    Write-Host "Executing: $cmd" -ForegroundColor Gray
    Invoke-Expression $cmd | Out-Null

    Start-Sleep -Seconds 1

    # Set working directory using registry (hacky but works)
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"

    # Add environment variables to service
    $env:PYTHONHOME = (python -c "import sys; print(sys.prefix)")
    $env:PYTHONPATH = $dashboardPath

    Write-Host "✅ Service installed successfully" -ForegroundColor Green
    Write-Host "   Service name: $serviceName" -ForegroundColor Green
    Write-Host "   Will start automatically on next boot" -ForegroundColor Green

    # Ask user if they want to start now
    $response = Read-Host "Start service now? (y/n)"
    if ($response -eq 'y') {
        Start-Dashboard
    }
}

function Uninstall-Dashboard {
    Write-Host "Uninstalling dashboard service..." -ForegroundColor Cyan

    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "❌ Service not found" -ForegroundColor Red
        return
    }

    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Remove service using sc.exe
    sc delete $serviceName 2>&1 | Out-Null

    Start-Sleep -Seconds 1

    Write-Host "✅ Service uninstalled" -ForegroundColor Green
}

function Start-Dashboard {
    Write-Host "Starting dashboard service..." -ForegroundColor Cyan

    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "❌ Service not found. Install first with: .\start-dashboard-service.ps1 -Action install" -ForegroundColor Red
        return
    }

    Start-Service -Name $serviceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3

    # Check if started
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq 'Running') {
        Write-Host "✅ Service started successfully" -ForegroundColor Green
        Write-Host "📊 Dashboard: http://127.0.0.1:8888/dev-dashboard.html" -ForegroundColor Cyan

        # Test connectivity
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8888/dev-dashboard.html" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Host "✓ Dashboard is accessible!" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️  Dashboard not responding yet. Give it a moment..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Failed to start service. Check logs:" -ForegroundColor Red
        Get-WinEvent -LogName "System" -FilterXPath "*[System[Provider[@Name='Service Control Manager'] and EventID=7000]]" -MaxEvents 1 | Format-List
    }
}

function Stop-Dashboard {
    Write-Host "Stopping dashboard service..." -ForegroundColor Cyan

    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "❌ Service not found" -ForegroundColor Red
        return
    }

    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "✅ Service stopped" -ForegroundColor Green
}

function Get-Status {
    Write-Host "Dashboard Service Status" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan

    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "❌ Service NOT installed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Install with: .\start-dashboard-service.ps1 -Action install" -ForegroundColor Yellow
        return
    }

    Write-Host "Service Name: $serviceName" -ForegroundColor Cyan
    Write-Host "Status: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running') {'Green'} else {'Red'})
    Write-Host "Start Type: $($service.StartType)" -ForegroundColor Cyan

    # Test connectivity
    Write-Host ""
    Write-Host "Testing connectivity..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8888/dev-dashboard.html" -UseBasicParsing -TimeoutSec 3
        Write-Host "✓ Dashboard responsive" -ForegroundColor Green
        Write-Host "  URL: http://127.0.0.1:8888/dev-dashboard.html" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ Dashboard not responding" -ForegroundColor Red
        if ($service.Status -eq 'Running') {
            Write-Host "  Service is running but not responding. Check logs or restart." -ForegroundColor Yellow
        } else {
            Write-Host "  Service is not running. Start with: .\start-dashboard-service.ps1 -Action start" -ForegroundColor Yellow
        }
    }
}

# Main
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AM-TradingAgents Dashboard — Windows Service Manager         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    'install' { Install-Dashboard }
    'uninstall' { Uninstall-Dashboard }
    'start' { Start-Dashboard }
    'stop' { Stop-Dashboard }
    'status' { Get-Status }
    default { Write-Host "Invalid action: $Action"; exit 1 }
}

Write-Host ""
