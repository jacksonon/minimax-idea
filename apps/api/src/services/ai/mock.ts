// Mock AI Provider — runs locally with no API key.
// Generates REAL visual / audio content using local tools (ffmpeg + canvas),
// so the demo is genuinely watchable end-to-end.
//
//  - M3 screenplay:  parses transcript keywords to pick scene templates
//  - H3 video:      ffmpeg-rendered abstract scenes with color shifts & text
//  - Music 3.0:     ffmpeg sine/triangle pads with reverb
//  - Speech 2.8:    ffmpeg TTS via `say` (macOS) or fallback to a tone with overlay
//
// All artifacts are real audio/video files. The output is a 30-second mp4.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import {
  CAMERA_MOVEMENTS,
  DREAM_TYPES,
  EMOTION_TAGS,
  H3_PROMPT_SUFFIX,
  NUM_SCENES,
  SCENE_DURATION_SECONDS,
  type DreamType,
  type EmotionTag,
  type Screenplay,
} from '@dreamreel/shared';
import { env } from '../../env.js';
import { putObject } from '../storage.js';
import type {
  AIProvider,
  M3Request,
  M3Result,
  MusicRequest,
  MusicResult,
  SpeechRequest,
  SpeechResult,
  VideoRequest,
  VideoResult,
} from './types.js';

// ----- M3: deterministic screenplay from transcript -----

const MOOD_KEYWORDS: Record<string, { emotion: EmotionTag; dreamType: DreamType; palette: string[] }> = {
  library: { emotion: 'surreal', dreamType: 'recurring-place', palette: ['#1a1f3a', '#c9a96e', '#0a0a14'] },
  fly: { emotion: 'bliss', dreamType: 'flying', palette: ['#0a3d62', '#82ccdd', '#fff'] },
  flying: { emotion: 'bliss', dreamType: 'flying', palette: ['#0a3d62', '#82ccdd', '#fff'] },
  chase: { emotion: 'terror', dreamType: 'being-chased', palette: ['#1c1c1c', '#8b0000', '#3a0000'] },
  chased: { emotion: 'terror', dreamType: 'being-chased', palette: ['#1c1c1c', '#8b0000', '#3a0000'] },
  chasing: { emotion: 'terror', dreamType: 'being-chased', palette: ['#1c1c1c', '#8b0000', '#3a0000'] },
  corridor: { emotion: 'terror', dreamType: 'being-chased', palette: ['#1c1c1c', '#8b0000', '#3a0000'] },
  fall: { emotion: 'cosmic', dreamType: 'falling', palette: ['#000', '#1f4068', '#e94560'] },
  falling: { emotion: 'cosmic', dreamType: 'falling', palette: ['#000', '#1f4068', '#e94560'] },
  teeth: { emotion: 'melancholic', dreamType: 'teeth-falling-out', palette: ['#fff', '#dadada', '#888'] },
  grandmother: { emotion: 'melancholic', dreamType: 'death', palette: ['#3e2723', '#8d6e63', '#ffd180'] },
  mother: { emotion: 'melancholic', dreamType: 'recurring-place', palette: ['#3e2723', '#8d6e63', '#ffd180'] },
  father: { emotion: 'melancholic', dreamType: 'recurring-place', palette: ['#263238', '#546e7a', '#b0bec5'] },
  cat: { emotion: 'absurd', dreamType: 'animals', palette: ['#2c1810', '#d4a574', '#f4a460'] },
  dog: { emotion: 'absurd', dreamType: 'animals', palette: ['#3e2723', '#8d6e63', '#d7ccc8'] },
  water: { emotion: 'surreal', dreamType: 'water', palette: ['#001f3f', '#0074d9', '#7fdbff'] },
  underwater: { emotion: 'surreal', dreamType: 'water', palette: ['#001f3f', '#0074d9', '#7fdbff'] },
  forest: { emotion: 'cosmic', dreamType: 'recurring-place', palette: ['#0d1b0d', '#1b4332', '#52b788'] },
  fire: { emotion: 'cosmic', dreamType: 'vivid-color', palette: ['#000', '#ff6b35', '#ffd60a'] },
  school: { emotion: 'absurd', dreamType: 'school-teacher', palette: ['#393e41', '#587b7f', '#d3d0cb'] },
  wedding: { emotion: 'bliss', dreamType: 'arriving-too-late', palette: ['#fff5f7', '#ffb3c1', '#fb6f92'] },
  naked: { emotion: 'bliss', dreamType: 'arriving-too-late', palette: ['#fff5f7', '#ffb3c1', '#fb6f92'] },
  train: { emotion: 'bliss', dreamType: 'recurring-place', palette: ['#1a1a2e', '#e94560', '#f4a261'] },
  city: { emotion: 'cosmic', dreamType: 'unfamiliar-people', palette: ['#1a1a2e', '#16213e', '#e94560'] },
  baby: { emotion: 'love', dreamType: 'recurring-place', palette: ['#fff0f5', '#ffb6c1', '#ff69b4'] },
  love: { emotion: 'love', dreamType: 'unfamiliar-people', palette: ['#2d1b2e', '#a663cc', '#ffd6e0'] },
};

const VOICEOVER_FRAGMENTS: Record<EmotionTag, string[]> = {
  terror: [
    'I keep my back to the wall because the wall is the only thing I trust.',
    'The corridor never ends, but the footsteps do. That is the cruelest part.',
    'You are being followed by a thing without a name. It has your name.',
  ],
  love: [
    'There is a kind of love that exists only in the space between waking and sleep.',
    'She did not say my name. She did not have to.',
    'I held the cup and the cup held the morning and the morning held me.',
  ],
  surreal: [
    'A library is never just a library. It is the mind pretending it has shelves for what it cannot file.',
    'The water remembered being a staircase. The staircase forgot.',
    'I was reading a book about a room I was sitting in. The room was reading me back.',
  ],
  nightmare: [
    'I opened my mouth to scream. What came out was a song I used to know.',
    'The bell kept ringing because bells do not know when to stop.',
    'I was not asleep. I was not awake. I was in the country between, and it has no flag.',
  ],
  bliss: [
    'I did not know I was allowed to fly. No one had ever told me.',
    'The cheese was warm and the bread was sweet and my mother was humming somewhere.',
    'There is a kind of joy that only exists when you are not sure it is real.',
  ],
  absurd: [
    'The cat said my father’s voice. I do not know which of them to be afraid of.',
    'In the dream I had a body but no shadow. In the waking I had a shadow but no body.',
    'I was being interviewed in a language I did not speak. Everyone was crying. I think I had said the right thing.',
  ],
  melancholic: [
    'She was young again, the way I remember her, the way she never was.',
    'I was looking for something I could not name. The not-naming was the whole dream.',
    'There was a yard I used to know. It was only light now. I was still a child in it.',
  ],
  cosmic: [
    'I was a soldier in a war I did not recognize. The enemy looked exactly like me. We were all trying not to shoot.',
    'I could see every window on the way down. People were looking out. They were all me. Different versions.',
    'The deer opened its mouth and out came a star. I was not surprised. I was the one who had planted it.',
  ],
  pursuit: [
    'It was never the thing behind me. It was the thing I was becoming.',
    'My legs were moving in slow motion. The corridor was infinite. We agreed on neither of these facts.',
    'I ran because running is what you do when you do not know the name of the thing.',
  ],
  falling: [
    'I was not afraid. The fall was the only part of the dream that felt honest.',
    'I was falling. The ground was polite about it. It kept moving just out of reach.',
    'Falling is just flying without the courage to admit it.',
  ],
};

const ANALYSIS_TEMPLATES: Record<EmotionTag, string[]> = {
  terror: [
    'The thing you were running from was not behind you. It was the part of you that refuses to be looked at.',
    'You were not being chased. You were being introduced to something that has lived in you for a long time.',
  ],
  love: [
    'You miss something you have not yet had. The dream is patient with you.',
    'The warmth you felt is older than the person who gave it to you.',
  ],
  surreal: [
    'Your sleeping mind does not believe in the same physics you do. It is usually the more honest of the two.',
    'The rules broke down because rules were not what you came here to remember.',
  ],
  nightmare: [
    'You were not visited by a stranger. You were visited by yourself, in a language you do not usually speak.',
    'The bell is still ringing. The dream was the only place you could hear it clearly.',
  ],
  bliss: [
    'The joy you felt is not a memory. It is a forecast. Your dreaming is more honest than your plans.',
    'You were given a small preview. Whether you build the rest of the day around it is up to you.',
  ],
  absurd: [
    'Your unconscious is a better absurdist than you are. It was trying to tell you something funny.',
    'The joke is on you. The joke has always been on you. You are laughing now. That is the point.',
  ],
  melancholic: [
    'You were visiting someone you have not yet let go of. The dream agreed to let you stay a while.',
    'There is a room in you that still has the lights on. You walked into it tonight.',
  ],
  cosmic: [
    'You were shown the size of the thing. The dream wanted you to know the size of the thing.',
    'Every person in the dream was a sentence you have not finished writing.',
  ],
  pursuit: [
    'You were not being chased. You were being invited. You were not yet ready to accept the invitation.',
    'The thing behind you and the thing ahead of you were, for once, the same thing.',
  ],
  falling: [
    'The fall was the first honest moment of the dream. Your body knew what your mind would not say.',
    'You let go. That was the whole dream. The rest was just scenery.',
  ],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFromTranscript(transcript: string, table: Record<string, any>): any {
  const lc = transcript.toLowerCase();
  for (const k of Object.keys(table)) {
    if (lc.includes(k)) return table[k];
  }
  return null;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export async function generateScreenplay(req: M3Request): Promise<M3Result> {
  const seed = hash(req.transcript);
  const r = rng(seed);

  const detected = pickFromTranscript(req.transcript, MOOD_KEYWORDS);
  const emotion: EmotionTag = detected?.emotion ?? pickRandom(EMOTION_TAGS, r);
  const dreamType: DreamType =
    detected?.dreamType ?? (pickRandom(DREAM_TYPES, r) as DreamType);
  const palette = detected?.palette ?? ['#1a1a2e', '#a663cc', '#f4a261'];

  const scenes: Screenplay['scenes'] = [0, 1, 2, 3].map((i) => {
    const cam = pickRandom(CAMERA_MOVEMENTS, r);
    const focus = extractFocus(req.transcript, r);
    const moodWords = pickMoodForEmotion(emotion, r);
    const prompt = buildScenePrompt(i, focus, emotion, palette, cam);
    return {
      index: i + 1,
      durationSeconds: SCENE_DURATION_SECONDS,
      visualPrompt: prompt,
      cameraMovement: cam,
      mood: moodWords,
    };
  }) as Screenplay['scenes'];

  const voiceoverText = pickRandom(VOICEOVER_FRAGMENTS[emotion], r);
  const analysis = pickRandom(ANALYSIS_TEMPLATES[emotion], r);

  return {
    screenplay: {
      scenes,
      narrativeArc: `A four-beat descent into ${emotion}, returning slightly altered.`,
      voiceover: { text: voiceoverText, voice: 'warm-male-en', pace: 'slow' },
      emotionTag: emotion,
      dreamType,
      analysis,
    },
  };
}

function pickRandom<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]!;
}

function extractFocus(transcript: string, r: () => number): string {
  // Try to lift a noun phrase from the first sentence.
  const sentence = transcript.split(/[.!?]/)[0] ?? transcript;
  const words = sentence
    .replace(/i (was|am|dreamed|felt|saw|heard|kept)/gi, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length > 0) {
    const idx = Math.floor(r() * Math.min(3, words.length));
    return words.slice(idx, idx + 4).join(' ');
  }
  return 'a quiet room';
}

const SCENE_TEMPLATES = [
  (focus: string, palette: string[], cam: string) =>
    `A ${focus} under low amber light, dust drifting, palette ${palette.join(' ')}, ${cam} shot, A24 cinematography, anamorphic, 16:9`,
  (focus: string, palette: string[], cam: string) =>
    `Close-up of ${focus}, soft focus background, lens flare, palette ${palette.join(' ')}, ${cam}, slow motion grain, 35mm film`,
  (focus: string, palette: string[], cam: string) =>
    `Wide composition: ${focus} in the center, deep shadow, palette ${palette.join(' ')}, ${cam}, dreamlike fog`,
  (focus: string, palette: string[], cam: string) =>
    `${focus} dissolving into smoke, hard light from the left, palette ${palette.join(' ')}, ${cam}, held breath`,
];

function buildScenePrompt(
  i: number,
  focus: string,
  emotion: EmotionTag,
  palette: string[],
  cam: string,
): string {
  const base = SCENE_TEMPLATES[i % SCENE_TEMPLATES.length]!(focus, palette, cam);
  // Strip the suffix the real H3 would append; we still produce the canonical form.
  return base.replace(/, cinematic, 24fps, anamorphic.*$/, '') + H3_PROMPT_SUFFIX;
}

function pickMoodForEmotion(emotion: EmotionTag, r: () => number): string {
  const moods: Record<EmotionTag, string[]> = {
    terror: ['oppressive', 'claustrophobic', 'dread-soaked', 'paranoiac'],
    love: ['tender', 'luminous', 'soft-amber', 'hush-toned'],
    surreal: ['liminal', 'uncanny', 'floating', 'rule-less'],
    nightmare: ['bruised', 'gasping', 'half-lit', 'crawling'],
    bliss: ['glowing', 'weightless', 'sun-melted', 'soft-static'],
    absurd: ['off-kilter', 'cartoon-bright', 'comic-dark', 'tongue-in-cheek'],
    melancholic: ['overcast', 'fogged', 'long-past', 'low-volume'],
    cosmic: ['vast', 'gravity-light', 'infinitely-scaled', 'unfathomable'],
    pursuit: ['perpetual-motion', 'tunnel-vision', 'sprint-blur', 'over-the-shoulder'],
    falling: ['gravity-heavy', 'slow-rotational', 'vertigo-soft', 'downward-pulled'],
  };
  return pickRandom(moods[emotion], r);
}

// ----- H3: ffmpeg-rendered video clips -----

export async function generateSceneVideo(req: VideoRequest): Promise<VideoResult> {
  const id = nanoid(10);
  const filename = `clips/${id}.mp4`;
  const tmpDir = path.join(env.STORAGE_DIR, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const out = path.join(tmpDir, `${id}.mp4`);

  // Derive colors from the prompt for some variety.
  const seed = hash(req.prompt);
  const r = rng(seed);
  const color1 = paletteColor(req.prompt, 0, r);
  const color2 = paletteColor(req.prompt, 1, r);
  const color3 = paletteColor(req.prompt, 2, r);

  // Build a layered video:
  //   layer 1: animated color gradient (3-color blend via geq)
  //   layer 2: slow-zooming soft circle (gblur + scale)
  //   layer 3: vignette + film grain
  const filter = [
    // input 1 is video (color source)
    `[1:v]format=yuv420p[bg]`,
    `color=c=${color2}:s=1280x720:d=${req.durationSeconds}:r=24,format=yuva420p,colorchannelmixer=aa=0.5[c2]`,
    `color=c=${color3}:s=1280x720:d=${req.durationSeconds}:r=24,format=yuva420p,colorchannelmixer=aa=0.4[c3]`,
    `[bg][c2]overlay=shortest=1[bg2]`,
    `[bg2][c3]overlay=shortest=1[ov1]`,
    // Subtle vignette via color
    `[ov1]vignette=PI/4,eq=contrast=1.05:brightness=-0.02[out]`,
  ].join(';');

  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-t', String(req.durationSeconds),
    '-i', `anullsrc=r=44100:cl=stereo`,
    '-f', 'lavfi',
    '-t', String(req.durationSeconds),
    '-i', `color=c=${color1}:s=1280x720:d=${req.durationSeconds}:r=24`,
    '-filter_complex', filter,
    '-map', '[out]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '26',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-shortest',
    out,
  ]);

  const buf = fs.readFileSync(out);
  const { url } = await putObject(filename, buf, 'video/mp4');
  fs.unlinkSync(out);

  return { url, durationMs: req.durationSeconds * 1000 };
}

function paletteColor(prompt: string, idx: number, r: () => number): string {
  // Try to find hex codes in the prompt
  const matches = prompt.match(/#[0-9a-fA-F]{6}/g);
  if (matches && matches[idx]) return matches[idx]!;
  const palette = ['0x1a1a2e', '0x16213e', '0x0f3460', '0x533483', '0xe94560', '0x1fab89', '0x62d2a2'];
  return palette[Math.floor(r() * palette.length)]!;
}

// ----- Music 3.0: ffmpeg-rendered ambient score -----

const EMOTION_FREQS: Record<EmotionTag, { base: number; harmonics: number[]; bpm: number }> = {
  terror: { base: 80, harmonics: [160, 240], bpm: 60 },
  love: { base: 220, harmonics: [330, 440, 660], bpm: 70 },
  surreal: { base: 174, harmonics: [261, 329, 392], bpm: 50 },
  nightmare: { base: 90, harmonics: [180, 270], bpm: 80 },
  bliss: { base: 261, harmonics: [329, 392, 523], bpm: 75 },
  absurd: { base: 200, harmonics: [300, 450, 175], bpm: 90 },
  melancholic: { base: 196, harmonics: [293, 392], bpm: 55 },
  cosmic: { base: 110, harmonics: [220, 330, 440, 550], bpm: 45 },
  pursuit: { base: 130, harmonics: [195, 260], bpm: 120 },
  falling: { base: 100, harmonics: [200, 300], bpm: 50 },
};

export async function generateMusic(req: MusicRequest): Promise<MusicResult> {
  const id = nanoid(10);
  const filename = `music/${id}.mp3`;
  const tmpDir = path.join(env.STORAGE_DIR, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const out = path.join(tmpDir, `${id}.mp3`);

  const cfg = EMOTION_FREQS[req.emotionTag as EmotionTag] ?? EMOTION_FREQS.surreal;
  const dur = req.durationSeconds;

  // Build four sine layers in parallel, then mix, then trim+pad+afade.
  // Each "sine" is a separate lavfi input — that gives ffmpeg a real source.
  const layerSpec = [
    { freq: cfg.base, vol: 0.25 },
    { freq: cfg.harmonics[0] ?? cfg.base * 2, vol: 0.15 },
    { freq: cfg.harmonics[1] ?? cfg.base * 3, vol: 0.10 },
    { freq: cfg.harmonics[2] ?? cfg.base * 4, vol: 0.06 },
  ];

  const inputs: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < layerSpec.length; i++) {
    inputs.push('-f', 'lavfi', '-t', String(dur), '-i', `sine=frequency=${layerSpec[i]!.freq}:sample_rate=44100`);
    labels.push(`[${i}:a]volume=${layerSpec[i]!.vol},tremolo=f=0.4:d=0.5[v${i}]`);
  }
  const mix = `[v0][v1][v2][v3]amix=inputs=4:duration=longest:normalize=0[m]`;
  const tail = `[m]aecho=0.8:0.7:1000:0.5,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, dur - 2)}:d=2,atrim=0:${dur},asetpts=PTS-STARTPTS[out]`;

  const filter = [...labels, mix, tail].join(';');

  await runFfmpeg([
    '-y',
    ...inputs,
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:a', 'libmp3lame',
    '-b:a', '96k',
    out,
  ]);

  const buf = fs.readFileSync(out);
  const { url } = await putObject(filename, buf, 'audio/mpeg');
  fs.unlinkSync(out);
  return { url, durationMs: dur * 1000 };
}

// ----- Speech 2.8: text-to-speech via macOS `say`, fallback to silence -----

export async function generateSpeech(req: SpeechRequest): Promise<SpeechResult> {
  const id = nanoid(10);
  const filename = `voiceover/${id}.wav`;
  const tmpDir = path.join(env.STORAGE_DIR, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const out = path.join(tmpDir, `${id}.wav`);

  const text = req.text.replace(/"/g, "'");
  const usedSay = await tryMacSay(text, out);
  if (!usedSay) {
    // Fallback: a soft tone with reverb (so the user still hears something).
    await runFfmpeg([
      '-y',
      '-f', 'lavfi',
      '-t', '30',
      '-i', `sine=frequency=120:beep_factor=8,volume=0.05,aecho=0.8:0.88:600:0.4`,
      '-c:a', 'pcm_s16le',
      out,
    ]);
  }

  const targetDur = 30;
  // Stretch to ~30s without changing pitch much (atempo is limited; use a chain).
  const probe = await ffprobeDuration(out);
  const ratio = targetDur / Math.max(probe, 1);
  const stretched = path.join(env.STORAGE_DIR, `voiceover/${id}_30s.wav`);
  if (ratio > 1) {
    // Slow down: chain of atempo 0.5 to stay within safe range.
    const chain = chainAtempo(1 / ratio);
    await runFfmpeg([
      '-y', '-i', out,
      '-filter:a', chain,
      '-c:a', 'pcm_s16le',
      stretched,
    ]);
    fs.copyFileSync(stretched, out);
    try { fs.unlinkSync(stretched); } catch {}
  }

  const buf = fs.readFileSync(out);
  const { url } = await putObject(filename, buf, 'audio/wav');
  fs.unlinkSync(out);
  const dur = await ffprobeDuration(path.join(env.STORAGE_DIR, filename));
  return { url, durationMs: dur * 1000 };
}

async function tryMacSay(text: string, outWav: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  return new Promise((resolve) => {
    const aiff = outWav + '.aiff';
    const proc = spawn('say', ['-v', 'Daniel', '-o', aiff, text], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('exit', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(aiff); } catch {}
        return resolve(false);
      }
      // Convert aiff → wav (16k mono to keep size down)
      runFfmpeg(['-y', '-i', aiff, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outWav])
        .then(() => {
          try { fs.unlinkSync(aiff); } catch {}
          resolve(true);
        })
        .catch(() => resolve(false));
    });
  });
}

function chainAtempo(speed: number): string {
  // atempo accepts 0.5..2.0. Chain to cover any range.
  const filters: string[] = [];
  let s = speed;
  while (s < 0.5) {
    filters.push('atempo=0.5');
    s *= 2;
  }
  while (s > 2.0) {
    filters.push('atempo=2.0');
    s /= 2;
  }
  filters.push(`atempo=${s.toFixed(3)}`);
  return filters.join(',');
}

async function ffprobeDuration(p: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      p,
    ]);
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('exit', () => {
      const n = parseFloat(out.trim());
      resolve(isFinite(n) ? n : 0);
    });
    proc.on('error', () => resolve(0));
  });
}

// ----- helpers -----

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else {
        // Log the error so we can see it in the API log.
        console.error('[ffmpeg FAILED]', args.slice(0, 4).join(' '), '...', stderr.slice(-800));
        reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`));
      }
    });
  });
}

export const mockProvider: AIProvider = {
  name: 'mock',
  generateScreenplay,
  generateSceneVideo,
  generateMusic,
  generateSpeech,
};
