// Video composition. Takes 4 H3 clips + music + voiceover → 30s MP4.
// In production this runs in a Cloudflare Container; in dev it runs locally
// via the system ffmpeg (AGENTS.md §4.3).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { env } from '../env.js';
import { putObject, readObject, objectExists } from './storage.js';

export type CompositeInput = {
  clipUrls: string[];        // 4 entries, each a local /api/media/... key
  musicUrl: string | null;
  voiceoverUrl: string | null;
  durationSeconds: number;   // target duration, typically 30
};

export async function composeDream(input: CompositeInput): Promise<{ url: string; durationMs: number }> {
  const id = nanoid(12);
  const workDir = path.join(env.STORAGE_DIR, 'work', id);
  fs.mkdirSync(workDir, { recursive: true });

  // 1. Materialize inputs to local files.
  const clipFiles: string[] = [];
  for (let i = 0; i < input.clipUrls.length; i++) {
    const url = input.clipUrls[i]!;
    const key = decodeURIComponent(url.replace(/^\/api\/media\//, ''));
    const ext = path.extname(key) || '.mp4';
    const file = path.join(workDir, `clip-${i + 1}${ext}`);
    if (objectExists(key)) {
      fs.writeFileSync(file, readObject(key));
    } else {
      // Generate a placeholder (black) so ffmpeg still has 4 inputs.
      await ffmpegBlack(file, input.durationSeconds / 4);
    }
    clipFiles.push(file);
  }

  const musicFile = input.musicUrl ? materialize(input.musicUrl, workDir, 'music.mp3') : null;
  const voFile = input.voiceoverUrl ? materialize(input.voiceoverUrl, workDir, 'voiceover.wav') : null;

  // 2. Build the filter graph: concat 4 clips (with optional short crossfade),
  //    mix music + voiceover. We use `concat` (not chained xfade) for reliability.
  const targetDur = input.durationSeconds;

  const inputs = clipFiles.map((f) => ['-i', f]);
  const audioInputs: string[] = [];
  const audioMaps: string[] = [];
  if (musicFile) {
    audioInputs.push('-i', musicFile);
    audioMaps.push('[a_music]');
  }
  if (voFile) {
    audioInputs.push('-i', voFile);
    audioMaps.push('[a_vo]');
  }

  const audioMix = (() => {
    if (audioMaps.length === 0) return '';
    const vol = audioMaps.map((_, i) => `[${i + clipFiles.length}:a]volume=${i === 0 ? 0.25 : 0.85}[v${i}]`).join(';');
    const joined = audioMaps.map((_, i) => `[v${i}]`).join('');
    return `${vol};${joined}amix=inputs=${audioMaps.length}:duration=first:dropout_transition=0[aout]`;
  })();

  // Scale each clip to the same canvas, then concat. Audio is mixed in parallel.
  const scalePerClip = clipFiles
    .map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,setsar=1,format=yuv420p[v${i}]`)
    .join(';');
  const concat = `[v0][v1][v2][v3]concat=n=4:v=1:a=0[vout]`;

  const filter = [scalePerClip, concat, audioMix].filter(Boolean).join(';');

  const out = path.join(workDir, 'final.mp4');
  const args: string[] = [
    '-y',
    ...inputs.flat(),
    ...audioInputs,
    '-filter_complex', filter,
    '-map', '[vout]',
    ...(audioMaps.length > 0 ? ['-map', '[aout]'] : []),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    ...(audioMaps.length > 0 ? ['-c:a', 'aac', '-b:a', '128k', '-shortest'] : []),
    '-t', String(targetDur),
    out,
  ];

  await runFfmpeg(args);

  const buf = fs.readFileSync(out);
  const { url } = await putObject(`dreams/${id}/final.mp4`, buf, 'video/mp4');

  // Cleanup work dir.
  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

  return { url, durationMs: targetDur * 1000 };
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
