#!/usr/bin/env python3
"""Dev dashboard server — shows real-time loop progress."""
import json
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).parent
CHECKPOINT_FILE = ROOT.parent.parent / ".orchestrator" / "execution-state.json"

class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith('status.json'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()

            try:
                checkpoint = json.loads(CHECKPOINT_FILE.read_text()) if CHECKPOINT_FILE.exists() else {}
                status = {
                    "status": checkpoint.get("lifecycle_status", "IDLE"),
                    "current_step": checkpoint.get("current_step", 0),
                    "active_story": checkpoint.get("active_story"),
                    "done_count": 1,  # Manual count or query GitHub later
                    "pr_count": 22,
                }
                self.wfile.write(json.dumps(status).encode())
            except:
                self.wfile.write(json.dumps({"status": "ERROR", "current_step": 0}).encode())
        else:
            super().do_GET()

if __name__ == "__main__":
    import os
    os.chdir(ROOT)
    server = HTTPServer(("127.0.0.1", 8888), DashboardHandler)
    print("📊 Dashboard: http://127.0.0.1:8888/dev-dashboard.html")
    server.serve_forever()
