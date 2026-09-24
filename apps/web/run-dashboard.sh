#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 8888 --bind 127.0.0.1 &
PID=$!
echo "Dashboard on http://127.0.0.1:8888/dev-dashboard.html (PID: $PID)"
wait $PID
