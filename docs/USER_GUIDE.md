# DreamReel — User Guide

> **5 minutes from "what is this" to "I just made my first dream film."**
>
> This guide is for **end users**, not developers. If you can use a phone, you can use DreamReel. No technical background needed.

---

## What is DreamReel?

You describe a dream. We turn it into a 30-second movie.

You hold a button for up to 60 seconds and tell us what you dreamed. About 90 seconds later, you watch a 30-second film: four AI-generated scenes, a custom soundtrack, and a voiceover. You can save it, share it, or make another one.

The whole thing is built on four AI models from **MiniMax**, served through **GMI Cloud**.

---

## The 3-step flow

### Step 1 — Open and press the button

Go to <https://dreamreel.app>. You'll see a single round button in the middle of the screen, slowly breathing.

Press and hold the button. Keep holding.

### Step 2 — Describe your dream

While holding the button, speak into your microphone as if you were telling a friend. Mention:

- **Where you were** — "I was in a library", "I was on a train", "I was underwater"
- **What was strange** — "the books were all upside down", "the train had no driver", "I could breathe"
- **Who was there** — "my grandmother", "a woman in white", "no one I recognized"
- **How it felt** — "I was scared", "I was happy", "I was flying"

You have up to 60 seconds. If you finish before then, just release the button. The app will ask you to type the rest.

**Don't worry about being articulate.** The weirder the dream, the better the film.

When you release the button, you'll see a small animation. The app is now listening back to what you said.

### Step 3 — Wait 90 seconds

A progress bar appears with 8 stages:

1. **Writing the screenplay…** — the AI is reading your dream and writing a script
2. **Shooting scene 1 of 4…** — the first 8 seconds of the film
3. **Shooting scene 2 of 4…**
4. **Shooting scene 3 of 4…**
5. **Shooting scene 4 of 4…**
6. **Scoring the music…** — a custom 30-second soundtrack
7. **Recording the voiceover…** — a narrator reads a short reflection
8. **Assembling the final cut…** — everything is stitched together

You don't need to do anything during this. Just watch the bar move. You can leave the tab and come back; the film will be waiting.

### Step 4 — Watch your film

The 30-second film starts playing automatically. The 4 scenes fade into each other. The music is matched to the mood. A voiceover narrates a short observation about the dream.

Above the film, you'll see two small tags:
- The **emotion** (e.g. `surreal`, `melancholic`, `terror`)
- The **dream type** (e.g. `flying`, `recurring-place`, `water`)

Below the film, a short quote — a one-line reflection on the dream, written in the style of a film critic, not a fortune teller.

---

## What you can do with the film

Once it's made, you have three options:

### Save it
Sign in with GitHub or Google. The film goes into your **My Dreams** page. You can come back to it any time.

> **First dream is free without an account** — but it only lives in your browser. To keep it, sign in.

### Make another
Click **Make another**. The whole flow starts over with a new dream.

### Share it
Click **Share**. The app creates a public link that works for 24 hours. Send it to a friend. They can watch your dream film without signing in.

> **Sharing is opt-in.** A dream only becomes shareable when you click the Share button.

---

## Tips for great films

After watching 100+ dream films, here is what we've learned:

| Tip | Why |
|---|---|
| **Speak in the present tense** | "I am in a library" works better than "I was in a library" |
| **Mention a specific object** | "A red book", "a glass of water", "a brass key" — gives the AI something to anchor the visuals |
| **Skip the explanation** | Don't say "and then I realized it was my childhood home." Just say "my childhood home." The less you interpret, the better. |
| **Add one strange detail** | The dream was already strange. Add the *weirdest* detail. ("the books were all breathing"). |
| **Record right when you wake up** | Dreams fade in 5-10 minutes. The earlier you record, the more vivid the film. |
| **Don't aim for profundity** | "I was on a beach made of paper" is a better dream than "I was searching for meaning" |

---

## Frequently asked questions

### Why does it take 90 seconds?

Because four AI models are working on your dream in parallel — one writes the script, one generates the video, one composes the music, one records the voiceover. After all four are done, we stitch them into one film. It would be faster if we cut models; it would be worse.

### Why 30 seconds?

We tried 10 seconds (too rushed), 60 seconds (too long, the music looped awkwardly), and 90 seconds (lost the dream's punch). 30 seconds is the sweet spot — long enough to feel like a film, short enough to be rewatchable.

### Can I edit the film?

Not yet. The film is the AI's first take. We might add editing later, but for now, if you don't love it, just make another.

### Can I share a dream I didn't make?

Not directly. Each dream has a 24-hour share link. After 24 hours the link stops working. To re-share, the original maker has to create a new link.

### Will my dreams be used to train AI?

No. We don't train any models on your dreams. Your transcripts and films are private to you (and whoever you share with). See our [privacy section](#privacy) below.

### Is this free?

Yes. The contest is sponsoring free generation. After the contest, we'll have a free tier and a paid tier with more capacity.

### Does this work on mobile?

The web app works on mobile Safari and Chrome. The recording quality is best on a phone (it's the microphone closest to your mouth), but you'll get a smaller video. We recommend desktop for the best experience.

### Can I download the film?

Not yet from the web. The video plays in the browser, and the share link works for 24 hours. If you want to keep a copy, screen-record it.

### The film didn't match my dream exactly. Why?

Two reasons:

1. The AI interprets, not copies. A library in your dream might come out as a hallway in the film, because to the AI those feel similar. This is a feature, not a bug — your dream was already symbolic.
2. AI video generators (the kind that make the visuals) are still imperfect. Sometimes a hand has 6 fingers. Sometimes a face is slightly off. We're using the best model available, and the result is usually good, but not always pixel-perfect.

If a film misses the mark, just make another. The next one will be different.

---

## Privacy

- **Your dreams are yours.** We don't sell them, train on them, or share them with anyone except the AI providers who need them to generate your film.
- **AI providers**: MiniMax (via GMI Cloud) sees your transcript for the few seconds it takes to generate. They don't store it, per their [terms](https://www.gmicloud.ai/terms).
- **Storage**: Your saved films and transcripts are stored in Cloudflare R2 and D1, encrypted at rest.
- **Share links**: A shared dream is publicly viewable by anyone with the link, for 24 hours. After that, the link stops working.
- **Account deletion**: To delete your account and all associated dreams, email us at <hello@dreamreel.app>. We delete within 7 days.
- **Cookies**: We use a single session cookie (`dreamreel_session`). No analytics, no tracking pixels, no third-party scripts.

---

## What to do if something goes wrong

| Problem | What to try |
|---|---|
| The button doesn't respond | Refresh the page. Make sure your browser has microphone permission. |
| The recording cuts off early | Check your microphone isn't muted. Some browsers limit recordings to 60s by default. |
| The progress bar is stuck | Wait 2 more minutes. If still stuck, refresh and try again. |
| The video won't play | Try a different browser (Chrome works best). Or click the share link to watch it from a clean tab. |
| I lost my dream | If you weren't signed in, we can't recover it. Sign in next time. |
| Something else | Email us at <hello@dreamreel.app>. We read every message. |

---

## A short history of dream-recording

Humans have been trying to record dreams for thousands of years. The ancient Greeks carved them on temple walls. The Romans kept dream journals. In the 1800s, people would dictate dreams to a secretary the moment they woke up.

In 2026, we finally have a way to make the dream into a film.

We're not the first to try. Researchers at MIT and elsewhere have built dream-recording prototypes. What's different about DreamReel is that **we're not trying to capture the dream perfectly** — we're trying to evoke it. The 30-second film isn't a recording of your dream. It's a *response* to your dream, the way a song is a response to a feeling.

We hope it makes you feel a little less alone in the strange country of sleep.

---

**Happy dreaming. The mic is ready when you are.**

— The DreamReel team
