#!/bin/zsh
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="ics-collaborative-map/index.html"
PORT=8080
PID_FILE="$BASE_DIR/.ics_collab_http_server.pid"
LOG_FILE="$BASE_DIR/.ics_collab_http_server.log"
URL="http://localhost:${PORT}/${APP_PATH}"

cd "$BASE_DIR"

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
