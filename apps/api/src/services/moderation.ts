// Pre-generation moderation (PRD §5.1 F16). Cheap keyword filter for v1.
// In production, replace with M3-based classification or a dedicated model.

const BLOCKLIST = [
  /\b(kill myself|suicide|end my life)\b/i,
  /\b(rape|sexual assault|molest)\b/i,
  /\b(child porn|cp\b)\b/i,
];

export function moderate(text: string): { allowed: boolean; reason?: string } {
  for (const re of BLOCKLIST) {
    if (re.test(text)) return { allowed: false, reason: 'Content blocked by safety filter.' };
  }
  if (text.length > 2000) return { allowed: false, reason: 'Transcript too long.' };
  return { allowed: true };
}
