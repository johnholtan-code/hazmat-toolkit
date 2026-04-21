#!/bin/zsh
set -euo pipefail

BASE_DIR="/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/Hazmat Incident Map - Hot Wash Replay - Single Folder"
PID_FILE="$BASE_DIR/.hazmat_http_server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
fi

rm -f "$PID_FILE"
exit 0
