# API Reference

> **The HTTP contract.** All endpoints are served by the Cloudflare Worker (or the local Node server) at `NEXT_PUBLIC_API_URL`.
>
> **Base URL**: `http://localhost:8787` (dev) · `https://api.dreamreel.app` (prod)
>
> **Auth**: session cookie (`dreamreel_session`) set by `/api/auth/dev-login` (dev) or `/api/auth/callback/:provider` (prod). Send cookies with `credentials: 'include'`.

---

## Table of contents

- [Health](#health)
- [Auth](#auth)
- [Dreams](#dreams)
- [Media](#media)
- [Share](#share)
- [Errors](#errors)
- [Rate limits](#rate-limits)

---

## Health

### `GET /health`

Liveness check. No auth.

**Response 200**
```json
{ "ok": true, "env": "development", "ai": "mock" }
```

`ai` is `mock` or `gmi` — which adapter is active.

---

## Auth

### `POST /api/auth/dev-login`

**Dev only.** Creates a mock user instantly. In production, the equivalent is the GitHub/Google OAuth callback.

**Request**
```json
{ "provider": "github", "handle": "alice" }
```

**Response 200** (with `Set-Cookie: dreamreel_session=...; HttpOnly; SameSite=Lax; Max-Age=2592000`)
```json
{ "user": { "id": "u_abc", "displayName": "alice", "avatarUrl": null } }
```

### `POST /api/auth/logout`

Invalidates the session cookie.

**Response 200**
```json
{ "ok": true }
```

### `GET /api/auth/me`

Returns the current user, or `{ user: null }` if not logged in.

**Response 200**
```json
{ "user": { "id": "u_abc", "displayName": "alice", "avatarUrl": null } }
```

### `GET /api/auth/callback/:provider`

OAuth callback. Not implemented in dev (use `/api/auth/dev-login` instead). In production, this is set up by NextAuth v5.

---

## Dreams

### `POST /api/dreams/generate`

Start a new dream generation. **Returns 202 immediately**; the actual work happens async.

**Request**
```json
{ "transcript": "I was in a library that was upside down" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `transcript` | string | yes | 5-2000 characters. Voice-to-text output from the user. |

**Response 202**
```json
{
  "dream_id": "d_abc123",
  "status": "pending",
  "poll_url": "/api/dreams/d_abc123/status"
}
```

**Errors**
- `400` — invalid input (too short, too long, missing field)
- `422` — content blocked by safety filter
- `429` — rate limit exceeded

### `GET /api/dreams/:id/status`

Poll the status of an in-flight or completed dream.

**Response 200**
```json
{
  "id": "d_abc123",
  "status": "pending | rendering | done | failed",
  "stage": "screenplay | scene-1 | scene-2 | scene-3 | scene-4 | music | voiceover | compositing | null",
  "progress": 0.42,
  "video_url": "/api/media/dreams%2Fxyz%2Ffinal.mp4",
  "analysis_text": "A library is never just a library...",
  "emotion_tag": "surreal",
  "dream_type": "recurring-place",
  "error": null
}
```

`progress` is 0.0 to 1.0.
`video_url` is null until `status === 'done'`.
`stage` is null when done or failed.

**Errors**
- `404` — dream not found

### `GET /api/dreams/:id`

Get the full dream record. Requires auth, unless the dream is `is_public=true`.

**Response 200** — full dream object (see `Dream` type in `@dreamreel/shared`).

**Errors**
- `401` — not logged in (when dream is private)
- `404` — not found

### `GET /api/dreams`

List all dreams for the current user. Requires auth.

**Response 200**
```json
{ "dreams": [{...}, {...}] }
```

Dreams are sorted by `created_at DESC`. Capped at 50.

**Errors**
- `401` — not logged in

### `DELETE /api/dreams/:id`

Delete a dream. Requires auth and ownership.

**Response 200**
```json
{ "ok": true }
```

**Errors**
- `401` — not logged in
- `404` — not found, or not owner

### `POST /api/dreams/:id/share`

Create a 24h public share link. The dream is also marked `is_public=true` so it can be fetched without auth.

**Request** (no body required)
```json
{}
```

**Response 200**
```json
{
  "share_url": "/share/abc123xyz",
  "expires_at": 1788016985708
}
```

**Errors**
- `403` — not owner and not public
- `404` — not found

---

## Media

### `GET /api/media/:key`

Serve a stored object. `:key` is the storage path (e.g. `dreams/abc123/final.mp4`).

**Behavior**
- Files under `clips/`, `music/`, `voiceover/` — public (the URL itself is unguessable).
- Files under `dreams/` — public (same reason).

**Response 200** — binary content with `Content-Type` based on extension.

**Response 404** — key not found.

---

## Share

### `GET /api/share/:token`

Resolve a share token to a dream.

**Response 200**
```json
{
  "dream": { /* full dream object */ },
  "expires_at": 1788016985708
}
```

**Errors**
- `404` — token invalid or expired

---

## Errors

All error responses have the shape:

```json
{ "error": "Human-readable message" }
```

| HTTP | When |
|---|---|
| 400 | Malformed request (missing field, wrong type, etc.) |
| 401 | No session cookie, or session expired |
| 403 | Authenticated but not allowed (e.g. not the owner) |
| 404 | Resource not found (dream, share token, user) |
| 409 | Conflict (e.g. dream already in progress) |
| 422 | Content validation failed (moderation blocklist) |
| 429 | Rate limit exceeded |
| 500 | Server error (unhandled exception) |
| 502 | Upstream AI service error |
| 504 | Generation timed out (>5 min) |

---

## Rate limits

| Tier | Limit | Window |
|---|---|---|
| Anonymous (no cookie) | 3 requests | per IP per hour |
| Authenticated | 10 requests | per user per hour |

The 429 response includes `{ limit: 3 }` so the client can show a useful message.

---

## CORS

Allowed origin is configured via the `ALLOWED_ORIGIN` env var. Default: `http://localhost:3000`.

CORS preflight (`OPTIONS`) returns `204 No Content` with appropriate `Access-Control-*` headers.

---

## Examples

### Full dream flow (cURL)

```bash
# 1. Login
curl -X POST http://localhost:8787/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"handle":"alice"}'

# 2. Generate
DREAM=$(curl -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"transcript":"I was flying"}' | jq -r .dream_id)

# 3. Poll
while true; do
  STATUS=$(curl -s -b cookies.txt "http://localhost:8787/api/dreams/$DREAM/status" | jq -r .status)
  echo "status: $STATUS"
  [ "$STATUS" = "done" ] && break
  [ "$STATUS" = "failed" ] && exit 1
  sleep 2
done

# 4. Download video
VIDEO=$(curl -s -b cookies.txt "http://localhost:8787/api/dreams/$DREAM/status" | jq -r .video_url)
curl -o dream.mp4 "http://localhost:8787$VIDEO"
```

### Run the full E2E

```bash
./scripts/acceptance.sh
```

---

**END OF API.md**
