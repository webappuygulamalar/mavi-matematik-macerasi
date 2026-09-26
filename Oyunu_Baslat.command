#!/bin/zsh

cd "$(dirname "$0")" || exit 1

PORT=8081
HOST="127.0.0.1"
VERSION="pwa-1"
LOG_FILE=".mavi_server.log"
PID_FILE=".mavi_server.pid"
TERMINAL_WINDOW_ID="$(/usr/bin/osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null)"

server_is_ready() {
  /usr/bin/curl -fsI "http://${HOST}:$1" >/dev/null 2>&1
}

start_server_on_port() {
  local TRY_PORT="$1"

  if server_is_ready "$TRY_PORT"; then
    PORT="$TRY_PORT"
    return
  fi

  /usr/bin/nohup /usr/bin/env python3 -m http.server "$TRY_PORT" --bind "$HOST" >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  for _ in {1..40}; do
    if server_is_ready "$TRY_PORT"; then
      PORT="$TRY_PORT"
      return
    fi
    sleep 0.1
  done

  return 1
}

start_server() {
  for TRY_PORT in 8081 8082 8083 8084; do
    if start_server_on_port "$TRY_PORT"; then
      return
    fi
  done

  return 1
}

close_terminal_later() {
  if [ -n "$TERMINAL_WINDOW_ID" ]; then
    TERMINAL_WINDOW_ID="$TERMINAL_WINDOW_ID" /usr/bin/nohup /bin/zsh -c 'sleep 1; /usr/bin/osascript -e "tell application \"Terminal\" to if exists window id $TERMINAL_WINDOW_ID then close window id $TERMINAL_WINDOW_ID" >/dev/null 2>&1' >/dev/null 2>&1 &
  fi
}

if start_server; then
  URL="http://${HOST}:${PORT}/?v=${VERSION}"
  /usr/bin/open -a "Google Chrome" "$URL" 2>/dev/null || /usr/bin/open "$URL"
  close_terminal_later
  exit 0
fi

echo "Oyun baslatilamadi. Lutfen .mavi_server.log dosyasini kontrol edin."
sleep 2
close_terminal_later

exit 1
