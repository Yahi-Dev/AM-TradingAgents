# 📊 AM-TradingAgents Dashboard

Real-time progress dashboard for Phase 0.5 Autonomous Development Loop.

**URL:** http://127.0.0.1:8888/dev-dashboard.html

---

## Features

✅ **Live Progress Tracking**
- Total stories: 4 DONE, 2 BLOCKED, 2 READY, 12 DRAFT
- Real-time sync from `docs/control-plane/stories.yaml`
- Auto-refresh every 5 seconds

✅ **Story Cards**
- Status indicators (DONE, BLOCKED, DRAFT, READY)
- Autonomy risk levels (GREEN, BLUE, YELLOW, ORANGE, RED)
- Dependency information

✅ **Metrics**
- Completion percentage
- Breakdown by status
- Queue visualization

---

## Start Dashboard

### ⭐ RECOMMENDED: Option 1 — Windows Service (Truly Persistent)

**One-time setup** (requires Administrator):

```powershell
# Open PowerShell as Administrator, then:
cd C:\Ia-projects\AM-TradingAgents\apps\web
.\start-dashboard-service.ps1 -Action install
```

**Then:**
- ✅ Dashboard auto-starts at Windows boot
- ✅ Runs as a Windows Service
- ✅ Auto-restarts if it crashes
- ✅ No terminal window needed

**Usage:**
```powershell
# Start service
.\start-dashboard-service.ps1 -Action start

# Stop service
.\start-dashboard-service.ps1 -Action stop

# Check status
.\start-dashboard-service.ps1 -Action status

# Uninstall (if needed)
.\start-dashboard-service.ps1 -Action uninstall
```

---

### Option 2: Windows Startup Folder (Simple Alternative)

**One-time setup:**

1. Copy `start-dashboard.bat` to Windows Startup folder:
   ```
   C:\Users\[YOUR-USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
   ```

2. Dashboard will auto-start on next boot

**Pros:** Simple, no PowerShell needed  
**Cons:** Terminal window visible while running

---

### Option 3: Manual (Temporary — Current Session Only)
```bash
cd C:\Ia-projects\AM-TradingAgents\apps\web
python -m http.server 8888 --bind 127.0.0.1
```

Then open: http://127.0.0.1:8888/dev-dashboard.html

**Will stop when you close the terminal or restart Windows.**

---

## Verification

```bash
# Test accessibility
curl -s http://127.0.0.1:8888/dev-dashboard.html | head -5

# Check process
Get-Process python | Where-Object { $_.CommandLine -like "*8888*" }

# Check logs
cat C:\Ia-projects\AM-TradingAgents\apps\web\dashboard.log
```

---

## Data Source

Dashboard reads from `../../docs/control-plane/stories.yaml`:
- **Status:** DONE | READY | DRAFT | BLOCKED_AUTOMATION
- **Risk:** GREEN | BLUE | YELLOW | ORANGE | RED
- **Dependencies:** depends_on array

Auto-syncs every 5 seconds. No manual refresh needed.

---

## Troubleshooting

### Dashboard showing mock data
- Local file load failed (YAML parsing)
- Check browser console for errors
- Fallback uses hard-coded demo data

### Server not responding (port 8888)
```powershell
# Kill and restart
Get-Process python | Where-Object { $_.CommandLine -like "*8888*" } | Stop-Process -Force
.\start-dashboard.ps1
```

### Port already in use
```powershell
# Find process using port 8888
Get-NetTCPConnection -LocalPort 8888
netstat -ano | findstr :8888

# Kill it
Stop-Process -Id <PID> -Force
```

---

## Auto-Refresh Data

Dashboard polls `stories.yaml` automatically:
1. Initial load on page open
2. Re-fetches every 5 seconds
3. Updates metrics + story cards
4. Shows last update timestamp

**No page refresh needed** — data updates live in background.

---

## Integration with Autonomous Loop

Dashboard **watches** the autonomous loop progress:
- `scripts/autonomous_loop.py` updates `stories.yaml` status
- Dashboard reads updated YAML
- Cards change color: DRAFT → BLOCKED or READY → DONE

Pipeline:
```
Loop blocks story → updates stories.yaml (BLOCKED_AUTOMATION)
        ↓
Dashboard loads YAML (refresh every 5s)
        ↓
Card changes color (red border + status badge)
```

---

## Performance Notes

- Minimal HTTP server (pure Python)
- Runs on 127.0.0.1:8888 (localhost only)
- ~50ms refresh latency
- Negligible CPU/memory impact
- Safe to leave running 24/7

---

**Created:** 2026-09-24  
**Status:** ✅ OPERATIONAL  
**Last Updated:** http://127.0.0.1:8888/dev-dashboard.html
