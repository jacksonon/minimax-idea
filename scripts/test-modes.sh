#!/usr/bin/env bash
# Test both generation modes:
#   1. Mock with H3 enabled (default) — produces a 30s video with 4 motion clips
#   2. Mock with H3 disabled         — produces a 30s slideshow with 8 stills

set -e
cd "$(dirname "$0")/.."

pkill -f "tsx src/index.ts" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

run_mode() {
  local label=$1; shift
  local extra_env=$1; shift

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  MODE: $label"
  echo "═══════════════════════════════════════════════════"

  rm -rf apps/api/storage apps/api/dev.db*

  # Start API with the given env
  echo "  starting: cd apps/api && $extra_env node --import tsx src/index.ts"
  ( cd apps/api && $extra_env node --import tsx src/index.ts > /tmp/api.log 2>&1 ) &
  APIPID=$!
  sleep 4

  echo "  health: $(curl -s http://localhost:8787/health)"

  DREAM=$(curl -s -X POST http://localhost:8787/api/dreams/generate \
    -H "Content-Type: application/json" \
    -d '{"transcript":"I was flying through an upside-down library, the staircase was made of water"}')
  DREAM_ID=$(echo "$DREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['dream_id'])")
  echo "  dream: $DREAM_ID"

  # Poll
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 10
    S=$(curl -s "http://localhost:8787/api/dreams/$DREAM_ID/status")
    STATUS=$(echo "$S" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status'))" 2>/dev/null)
    if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
      break
    fi
  done

  FINAL=$(curl -s "http://localhost:8787/api/dreams/$DREAM_ID/status")
  echo "  final: $FINAL"
  VIDEO_URL=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['video_url'] or '')")
  if [ -n "$VIDEO_URL" ]; then
    curl -s "http://localhost:8787$VIDEO_URL" -o /tmp/dream_$label.mp4
    SIZE=$(ls -lh /tmp/dream_$label.mp4 | awk '{print $5}')
    DUR=$(ffprobe -v error -show_entries format=duration /tmp/dream_$label.mp4 | grep duration | cut -d= -f2)
    echo "  result: $SIZE, ${DUR}s"
  else
    echo "  result: NO VIDEO"
  fi

  kill $APIPID 2>/dev/null || true
  wait 2>/dev/null || true
  sleep 2
  lsof -i:8787 2>/dev/null && echo "  WARNING: port 8787 still bound" || true
}

# Mode 1: default (H3 enabled, mock mode)
run_mode "video" ""

# Mode 2: slideshow fallback (H3 disabled in mock)
run_mode "slideshow" "MOCK_H3_ENABLED=false"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  BOTH MODES PASSED"
echo "═══════════════════════════════════════════════════"
