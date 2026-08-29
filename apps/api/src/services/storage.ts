// Local-filesystem storage. In production this is R2 (see PRD §8.1).
// Interface is intentionally narrow so the swap is trivial.

import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function putObject(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const fullPath = path.join(env.STORAGE_DIR, key);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, data);
  // In dev the URL is served by our own Worker route (see routes/media.ts).
  return { key, url: `/api/media/${encodeURIComponent(key)}` };
}

export function getObjectPath(key: string): string {
  return path.join(env.STORAGE_DIR, key);
}

export function objectExists(key: string): boolean {
  return fs.existsSync(path.join(env.STORAGE_DIR, key));
}

export function readObject(key: string): Buffer {
  return fs.readFileSync(path.join(env.STORAGE_DIR, key));
}

export function getContentType(key: string): string {
  if (key.endsWith('.mp4')) return 'video/mp4';
  if (key.endsWith('.mp3')) return 'audio/mpeg';
  if (key.endsWith('.wav')) return 'audio/wav';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}
