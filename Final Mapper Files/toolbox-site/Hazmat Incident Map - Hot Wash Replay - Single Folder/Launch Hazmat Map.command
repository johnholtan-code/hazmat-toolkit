#!/bin/zsh
set -euo pipefail

BASE_DIR="/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/Hazmat Incident Map - Hot Wash Replay - Single Folder"
APP_DIR="$BASE_DIR"
PAGE_ENCODED="Hazmat%20Incident%20Map%20-%20Hot%20Wash%20Replay.html"
PORT=8080
PID_FILE="$BASE_DIR/.hazmat_http_server.pid"
LOG_FILE="$BASE_DIR/.hazmat_http_server.log"
URL="http://localhost:${PORT}/${PAGE_ENCODED}"
RATE_GEN_SCRIPT="$APP_DIR/generate_staging_rates.py"

cd "$BASE_DIR"

if [[ -f "$RATE_GEN_SCRIPT" ]]; then
  python3 "$RATE_GEN_SCRIPT" >>"$LOG_FILE" 2>&1 || true
fi

is_server_running() {
  local pid="$1"
  if [[ -z "${pid}" ]]; then
    return 1
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi
  local cmdline
  cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$cmdline" == *"python"* ]] && [[ "$cmdline" == *"http.server"* ]]
}

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_server_running "$EXISTING_PID"; then
    open "$URL"
    exit 0
  fi
fi

nohup python3 -m http.server "$PORT" >"$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

sleep 0.5
open "$URL"

exit 0
