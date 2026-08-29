# Wireframes — DreamReel

> ASCII wireframes for the four primary screens. These are **low-fidelity** — they show information hierarchy and flow, not pixel-perfect design. Use them as a starting point; final styling lives in `apps/web/components/`.

> **Conventions**:
> - `┌─┐ │ └─┘` = box borders
> - `═` = emphasized border (active state)
> - `( )` = button
> - `[ ]` = input or card
> - `…` = ellipsis text
> - `▓░` = placeholder video frame

---

## 1. Landing / Step 1: Record (`app/page.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                         ╭───────╮                            │
│                         │       │                            │
│                         │   ◉   │    (large mic button)      │
│                         │       │                            │
│                         ╰───────╯                            │
│                                                              │
│                                                              │
│            Describe your dream.                              │
│            We'll shoot it for you.                           │
│                                                              │
│            30 seconds. 4 models. One movie.                  │
│                                                              │
│                                                              │
│                                                              │
│                                            [ Sign in ]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**States**:
- Default: outlined button, breathing animation (3s)
- Hover: subtle glow
- Recording (Step 2): see below

**Notes**:
- Centered vertically and horizontally. The single button dominates the viewport.
- "Sign in" link in bottom-right, low-emphasis (we want recording, not auth).
- No header, no nav. This is a single-purpose page.

---

## 2. Step 2: Recording (overlay on Landing)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                                                              │
│                         ╔═══════╗                            │
│                         ║       ║                            │
│                         ║   ◉   ║   (filled red, pulsing)    │
│                         ║       ║                            │
│                         ╚═══════╝                            │
│                                                              │
│                    ┌─────────────────┐                       │
│                    │ ▓▓░▓▓▓░▓░▓▓▓░▓ │   (live waveform)       │
│                    └─────────────────┘                       │
│                                                              │
│                         00:42                                │
│                       (countdown)                            │
│                                                              │
│                                                              │
│              Release when you've told it all.                │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**States**:
- Recording: red filled button, waveform animates, countdown ticks
- Last 5s: button pulses faster, "Almost there…" copy appears
- Released: auto-transition to Step 3

**Notes**:
- 60s max, hard stop. If user releases earlier (< 5s), show inline warning: "Tell me more. Dreams need at least a moment."
- Waveform uses Web Audio API AnalyserNode, 60fps.
- "Release when you've told it all." copy sets the contract: there's no auto-cutoff, the user owns the moment.

---

## 3. Step 3: Generating (90 seconds)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                                                              │
│                         ┌─────┐                              │
│                        ╱       ╲                             │
│                       │  ▓▓▓▓▓  │    (rotating film reel)    │
│                       │  ▓▓▓▓▓  │                            │
│                        ╲       ╱                             │
│                         └─────┘                              │
│                                                              │
│                                                              │
│                  Shooting scene 1 of 4…                     │
│                                                              │
│             ┌──┬────────────────────────────┐                │
│             │ 1│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ done           │
│             ├──┼────────────────────────────┤                │
│             │ 2│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ │ rendering       │
│             ├──┼────────────────────────────┤                │
│             │ 3│ ░░░░░░░░░░░░░░░░░░░░░░░░ │ waiting         │
│             ├──┼────────────────────────────┤                │
│             │ 4│ ░░░░░░░░░░░░░░░░░░░░░░░░ │ waiting         │
│             └──┴────────────────────────────┘                │
│                                                              │
│                                                              │
│                        00:38                                 │
│                      (elapsed)                               │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Stage copy sequence** (each stage = one progress line):
1. "Writing the screenplay…" (0-15s, M3)
2. "Shooting scene 1 of 4…" (15-40s, H3 × 4 parallel)
3. "Scoring the music…" (40-55s, Music 3.0)
4. "Recording the voiceover…" (55-90s, Speech 2.8)
5. "Assembling the final cut…" (90-95s, FFmpeg composite)

**Notes**:
- Each stage row lights up as the backend stage changes (poll every 2s).
- "Elapsed" counter is decorative; the real status comes from the backend.
- If a stage fails and a scene falls back to "this scene slipped from memory" placeholder, that row gets a small `…` indicator but no scary error — the user shouldn't see infrastructure noise.

---

## 4. Step 4: Watch (same page, replaces Step 3)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │                                                      │   │
│   │                  ░░░░░░░░░░░░                        │   │
│   │              (16:9 video player)                     │   │
│   │                                                      │   │
│   │              ▶  ━━━●━━━━━━━━━  0:12 / 0:30          │   │
│   │                                                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│         [ surreal ]   [ flying ]   [ library ]              │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   "A library is never just a library. It is the mind        │
│    pretending it has shelves for what it cannot file."      │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   [ Save to my dreams ]   [ Make another ]   [ Copy link ]  │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**States**:
- Anonymous: "Save to my dreams" → triggers sign-in modal, then saves
- Authenticated: direct save, button changes to "Saved ✓" briefly
- "Make another" returns to Step 1
- "Copy link" copies a shareable URL (24h expiry, public-readable)

**Notes**:
- The analysis quote (italic) is the **poetic observation** from M3 — not a literal interpretation. Style: contemplative, single sentence, slightly literary.
- Emotion tags and "dream_type" appear as small uppercase pills (e.g. `[ SURREAL ]`).
- No autoplay on subsequent visits; user must click play.

---

## 5. /dreams (My Dreams list)

```
┌─────────────────────────────────────────────────────────────┐
│  DreamReel                                  [Avatar ▾]       │
│                                                              │
│  My dreams                                                   │
│  ─────────                                                   │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ ░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░ │ │
│  │                │  │                │  │                │ │
│  │ upside-down    │  │ cat with a     │  │ staircase made │ │
│  │ library        │  │ human face     │  │ of water       │ │
│  │                │  │                │  │                │ │
│  │ [surreal] 2d   │  │ [absurd] 5d    │  │ [flying] 1w    │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐                      │
│  │ ░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░ │                      │
│  │ ...            │  │ ...            │                      │
│  └────────────────┘  └────────────────┘                      │
│                                                              │
│                                                              │
│  [ + New dream ]                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Notes**:
- Card grid, 3 columns desktop / 1 column mobile.
- Hover: card lifts 2px, plays 1s muted preview.
- Empty state: "No dreams yet. Tonight, remember one." + record button.
- Truncated transcript (first 4 words + "…") as title.

---

## 6. /dreams/[id] (Detail)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to my dreams                                         │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              (16:9 video player)                     │   │
│   │              ▶  ━━━●━━━━━━━━━  0:00 / 0:30          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Recorded 2 days ago · 4:47am                              │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   Transcript:                                                │
│   "I was in this library, but the whole thing was upside     │
│    down, and I was flying between the shelves, and the       │
│    staircase was made of water, and there was a woman        │
│    in white who knew my name but wouldn't say it…"           │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   [surreal] [flying] [library]                              │
│                                                              │
│   "A library is never just a library. It is the mind        │
│    pretending it has shelves for what it cannot file."      │
│                                                              │
│   [ Share ]  [ Delete ]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Notes**:
- Show the original transcript. This is the user's words — sacred.
- Delete is destructive, confirm via modal.
- Share creates a 24h public link.

---

## 7. /share/[token] (public read-only)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                       DreamReel                              │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              (16:9 video player)                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   [surreal] [flying]                                         │
│                                                              │
│   "A library is never just a library. It is the mind        │
│    pretending it has shelves for what it cannot file."      │
│                                                              │
│   Shared by @username · expires in 23h                       │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│             [ Make your own dream → ]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Notes**:
- No nav, no auth prompts. Just the dream.
- "Make your own dream →" CTA routes to `/`.
- Expires gracefully — if token invalid, show "This dream has faded."

---

## 8. Sign-in modal

```
┌─────────────────────────────────────────────┐
│                                             │
│   Sign in to keep your dreams               │
│   ─────────────────────────────             │
│                                             │
│   Dreams you make are saved to your         │
│   account so you can revisit them.          │
│                                             │
│   [ Continue with GitHub ]                  │
│                                             │
│   [ Continue with Google ]                  │
│                                             │
│                       [ Not now ]           │
│                                             │
└─────────────────────────────────────────────┘
```

**Notes**:
- Triggered by "Save to my dreams" for anonymous users.
- "Not now" closes modal; the dream result is still on-screen but not saved.
- No email/password — OAuth only.

---

## Responsive notes

- Mobile (< 768px): single column, video fills width, mic button is 160px diameter.
- Tablet (768-1023px): same as mobile but with breathing room.
- Desktop (≥ 1024px): as drawn above.

---

**END OF WIREFRAMES v1.0**
