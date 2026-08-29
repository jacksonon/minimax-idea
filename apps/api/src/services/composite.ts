// Video composition. Takes 4 video clips OR N still images + music + voiceover
// → 30s MP4. The two modes are handled by the same filter graph: image
// inputs are first turned into short looping videos via ffmpeg's `-loop 1`.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { env } from '../env.js';
import { putObject, readObject, objectExists } from './storage.js';

export type MediaItem = {
  kind: 'video' | 'image';
  url: string;
  durationMs: number;
};

export type CompositeInput = {
  media: MediaItem[];           // 4 videos or 8 images (or any mix)
  musicUrl: string | null;
  voiceoverUrl: string | null;
  durationSeconds: number;      // target, typically 30
};

export async function composeDream(input: CompositeInput): Promise<{ url: string; durationMs: number }> {
  const id = nanoid(12);
  const workDir = path.join(env.STORAGE_DIR, 'work', id);
  fs.mkdirSync(workDir, { recursive: true });

  // 1. Materialize every media item to a local file. Image items become a
  //    short looping video so the concat filter has a single format to chew.
  const mediaFiles: string[] = [];
  const perItemDuration = input.durationSeconds / input.media.length;
  for (let i = 0; i < input.media.length; i++) {
    const item = input.media[i]!;
    const file = await materializeMedia(item, workDir, i, perItemDuration);
    mediaFiles.push(file);
  }

  const musicFile = input.musicUrl ? materialize(input.musicUrl, workDir, 'music.mp3') : null;
  const voFile = input.voiceoverUrl ? materialize(input.voiceoverUrl, workDir, 'voiceover.wav') : null;

  // 2. Build filter graph: scale each clip, concat them, mix audio.
  const targetDur = input.durationSeconds;
  const scalePerClip = mediaFiles
    .map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${i}]`)
    .join(';');
  const concatLabels = mediaFiles.map((_, i) => `[v${i}]`).join('');
  const concat = `${concatLabels}concat=n=${mediaFiles.length}:v=1:a=0[vout]`;

  const audioMix = (() => {
    if (!musicFile && !voFile) return '';
    const items: string[] = [];
    if (musicFile) items.push(`[${mediaFiles.length}:a]volume=0.25[m]`);
    if (voFile) items.push(`[${mediaFiles.length + (musicFile ? 1 : 0)}:a]volume=0.85[v]`);
    // amix expects [m][v]... (one input stream per bracket)
    const inputs = items.map((s) => {
      const m = s.match(/\[(\w+)\]/);
      return `[${m?.[1] ?? ''}]`;
    }).join('');
    return `${items.join(';')};${inputs}amix=inputs=${items.length}:duration=first:dropout_transition=0[aout]`;
  })();

  const filter = [scalePerClip, concat, audioMix].filter(Boolean).join(';');

  const out = path.join(workDir, 'final.mp4');

  const args: string[] = [
    '-y',
    ...mediaFiles.flatMap((f) => ['-i', f]),
    ...(musicFile ? ['-i', musicFile] : []),
    ...(voFile ? ['-i', voFile] : []),
    '-filter_complex', filter,
    '-map', '[vout]',
    ...(audioMix ? ['-map', '[aout]'] : []),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    ...(audioMix ? ['-c:a', 'aac', '-b:a', '128k', '-shortest'] : []),
    '-t', String(targetDur),
    out,
  ];

  await runFfmpeg(args);

  const buf = fs.readFileSync(out);
  const { url } = await putObject(`dreams/${id}/final.mp4`, buf, 'video/mp4');

  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

  return { url, durationMs: targetDur * 1000 };
}

/**
 * Materialize a single media item to a local file. For videos, copy from
 * storage. For images, render an N-second video of the image (Ken Burns-style
 * slow zoom for visual interest) so the concat step has a uniform input.
 */
async function materializeMedia(
  item: MediaItem,
  workDir: string,
  index: number,
  durationSeconds: number,
): Promise<string> {
  if (item.kind === 'video') {
    const key = decodeURIComponent(item.url.replace(/^\/api\/media\//, ''));
    const ext = path.extname(key) || '.mp4';
    const file = path.join(workDir, `clip-${index}${ext}`);
    if (objectExists(key)) {
      fs.writeFileSync(file, readObject(key));
      return file;
    }
    // Fallback: black frame
    await ffmpegBlack(file, durationSeconds);
    return file;
  }
  // image
  const out = path.join(workDir, `clip-${index}.mp4`);
  await renderImageToClip(item.url, out, durationSeconds);
  return out;
}

/**
 * Turn an image URL (or a palette-URL for the GMI provider) into a short
 * looping video clip with a slow Ken Burns zoom. The input URL is resolved
 * via the same storage path used elsewhere; palette URLs are handled inline.
 */
async function renderImageToClip(imageUrl: string, out: string, durationSeconds: number): Promise<void> {
  // Resolve input source. If it's a /api/media/_palette/... URL, render a
  // gradient locally without any external image.
  if (imageUrl.startsWith('/api/media/_palette/')) {
    await renderPaletteClip(imageUrl, out, durationSeconds);
    return;
  }
  const key = decodeURIComponent(imageUrl.replace(/^\/api\/media\//, ''));
  if (!objectExists(key)) {
    await ffmpegBlack(out, durationSeconds);
    return;
  }
  const inputFile = path.join(env.STORAGE_DIR, key);
  // Ken Burns: zoompan from 1.0 to 1.08 over the clip duration.
  const frames = Math.max(2, Math.floor(durationSeconds * 24));
  await runFfmpeg([
    '-y',
    '-loop', '1',
    '-t', String(durationSeconds),
    '-i', inputFile,
    '-vf', `scale=1920:-1,zoompan=z='min(zoom+0.0008,1.08)':d=${frames}:s=1280x720:fps=24,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '24',
    out,
  ]);
}

async function renderPaletteClip(paletteUrl: string, out: string, durationSeconds: number): Promise<void> {
  // /api/media/_palette/<comma-separated-colors>?w=1280&h=720
  const m = paletteUrl.match(/\/api\/media\/_palette\/([^?]+)/);
  const colors = m ? decodeURIComponent(m[1]!).split(',') : ['0x1a1a2e', '0x533483', '0xe94560'];
  const [c1, c2, c3] = colors;
  const W = 1280, H = 720;

  const filter = [
    `color=c=${c1}:s=${W}x${H}:d=${durationSeconds}:r=24[bg]`,
    `color=c=${c2}:s=${W}x${H}:d=${durationSeconds}:r=24,format=yuva420p,colorchannelmixer=aa=0.5[c2]`,
    `color=c=${c3}:s=${W}x${H}:d=${durationSeconds}:r=24,format=yuva420p,colorchannelmixer=aa=0.4[c3]`,
    `[bg][c2]overlay=shortest=1[bg2]`,
    `[bg2][c3]overlay=shortest=1[bg3]`,
    // Slow Ken Burns zoom
    `[bg3]zoompan=z='min(zoom+0.0008,1.08)':d=${Math.max(2, Math.floor(durationSeconds * 24))}:s=${W}x${H}:fps=24[ov1]`,
    `[ov1]vignette=PI/4,eq=contrast=1.05:brightness=-0.02,format=yuv420p[out]`,
  ].join(';');

  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=${c1}:s=${W}x${H}:r=24`,
    '-t', String(durationSeconds),
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    out,
  ]);
}

function materialize(url: string, workDir: string, name: string): string {
  const key = decodeURIComponent(url.replace(/^\/api\/media\//, ''));
  const file = path.join(workDir, name);
  if (objectExists(key)) {
    fs.writeFileSync(file, readObject(key));
    return file;
  }
  // Fallback: silent audio of correct length
  const dur = 30;
  const proc = spawn('ffmpeg', [
    '-y', '-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:a', path.extname(name) === '.wav' ? 'pcm_s16le' : 'libmp3lame',
    file,
  ], { stdio: 'ignore' });
  return file;
}

async function ffmpegBlack(out: string, seconds: number): Promise<void> {
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-t', String(seconds), '-i', `color=c=black:s=1280x720:r=24`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
    out,
  ]);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}
