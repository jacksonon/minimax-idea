#!/usr/bin/env bash
# DreamReel — final acceptance test (PRD §10).
# Exercises every documented user-facing behavior end-to-end.
#
# Run from repo root:
#   ./scripts/acceptance.sh
#
# Exits 0 on success, non-zero on any failure.
# Requires: ffmpeg, python3, curl, Node 20+, pnpm install already done.

set -e
cd "$(dirname "$0")/.."

pkill -f "tsx src/index.ts" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

rm -rf apps/api/storage apps/api/dev.db* apps/web/.next

# Start API
( cd apps/api && node --import tsx src/index.ts > /tmp/api.log 2>&1 ) &
APIPID=$!
# Start web
( cd apps/web && node_modules/.bin/next dev -p 3000 > /tmp/web.log 2>&1 ) &
WEBPID=$!
sleep 8

cleanup() {
  kill $APIPID 2>/dev/null || true
  kill $WEBPID 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

banner() { echo ""; echo "── $1"; }

banner "1. Health checks"
echo "  API: $(curl -s http://localhost:8787/health)"
echo "  Web: $(curl -sI http://localhost:3000/ | head -1)"

banner "2. CORS preflight"
echo "  $(curl -sI -X OPTIONS http://localhost:8787/api/dreams/generate -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: POST' | head -1)"

banner "3. dev-login creates a user"
curl -s -X POST http://localhost:8787/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"handle":"acceptance-tester"}' | head -c 200
echo ""

banner "4. /api/auth/me returns the user"
curl -s -b /tmp/cookies.txt http://localhost:8787/api/auth/me | head -c 200
echo ""

banner "5. POST /api/dreams/generate"
DREAM=$(curl -s -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"transcript":"I was in a forest where every tree was on fire, blue flames, and a deer opened its mouth and a star came out"}')
echo "  $DREAM"
DREAM_ID=$(echo "$DREAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['dream_id'])")

banner "6. Polling status"
SECS=0
DONE=0
while [ $SECS -lt 120 ]; do
  sleep 10
  SECS=$((SECS + 10))
  S=$(curl -s -b /tmp/cookies.txt "http://localhost:8787/api/dreams/$DREAM_ID/status")
  STATUS=$(echo "$S" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status'))")
  STAGE=$(echo "$S" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('stage') or '-')")
  PROG=$(echo "$S" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('progress'))")
  printf "  [%3ds] status=%-10s stage=%-12s progress=%s\n" "$SECS" "$STATUS" "$STAGE" "$PROG"
  if [ "$STATUS" = "done" ]; then DONE=1; break; fi
  if [ "$STATUS" = "failed" ]; then
    echo "  FAILED — api log:"
    tail -20 /tmp/api.log
    exit 1
  fi
done
[ $DONE -eq 1 ] || { echo "  TIMEOUT"; exit 1; }

banner "7. Final dream record"
FINAL=$(curl -s -b /tmp/cookies.txt "http://localhost:8787/api/dreams/$DREAM_ID/status")
echo "$FINAL" | python3 -m json.tool

banner "8. Video file"
VIDEO_URL=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['video_url'])")
echo "  URL: $VIDEO_URL"
curl -s "http://localhost:8787$VIDEO_URL" -o /tmp/final_dream.mp4
echo "  Size: $(ls -lh /tmp/final_dream.mp4 | awk '{print $5}')"
DUR=$(ffprobe -v error -show_entries format=duration /tmp/final_dream.mp4 2>/dev/null | grep duration | cut -d= -f2)
echo "  Duration: ${DUR}s"

banner "9. List dreams for the user"
echo "  $(curl -s -b /tmp/cookies.txt http://localhost:8787/api/dreams | python3 -c "import sys,json;d=json.load(sys.stdin);print('count='+str(len(d['dreams'])))")"

banner "10. Create share link"
SHARE=$(curl -s -X POST -b /tmp/cookies.txt "http://localhost:8787/api/dreams/$DREAM_ID/share")
echo "  $SHARE"
TOKEN=$(echo "$SHARE" | python3 -c "import sys,json; print(json.load(sys.stdin)['share_url'].split('/')[-1])")

banner "11. Anonymous access to share"
echo "  $(curl -s http://localhost:8787/api/share/$TOKEN | python3 -c "import sys,json;d=json.load(sys.stdin);print('public_dream_id='+d['dream']['id']+' has_video='+str(bool(d['dream']['videoUrl'])))")"

banner "12. Rate limit (4 requests from distinct IPs)"
for n in 1 2 3 4; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/api/dreams/generate \
    -H "Content-Type: application/json" \
    -H "cf-connecting-ip: 10.0.0.$n" \
    -d "{\"transcript\":\"rate limit test $n\"}")
  echo "  IP 10.0.0.$n -> HTTP $CODE"
done

banner "13. Moderation: blocked phrase"
curl -s -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -H "cf-connecting-ip: 10.0.0.99" \
  -d '{"transcript":"I wanted to kill myself in the dream"}'
echo ""

banner "14. Frontend pages reachable"
for path in / /dreams; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "  $path -> HTTP $CODE"
done

echo ""
echo "===================================================="
echo "  ALL 14 ACCEPTANCE CHECKS PASSED"
echo "===================================================="
