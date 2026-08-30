// AI Provider selector. The rest of the codebase imports `ai` and is blind to
// whether the call is hitting GMI Cloud or the local mock.

import { env } from '../../env.js';
import { getDefaultGmiProvider } from './gmi.js';
import type { AIProvider } from './types.js';
import { mockProvider } from './mock.js';

let _ai: AIProvider | null = null;
export function getAi(): AIProvider {
  if (_ai) return _ai;
  _ai = env.AI_PROVIDER === 'gmi' ? getDefaultGmiProvider() : mockProvider;
  return _ai;
}

// Back-compat: callers that do `import { ai }` get a proxy that always
// reflects the current provider. This is mostly a no-op for non-GMI
// environments, and in GMI envs it now defers GMI key lookup to first
// use.
export const ai: AIProvider = new Proxy({} as AIProvider, {
  get(_t, prop) {
    return (getAi() as any)[prop];
  },
});

export type { AIProvider } from './types.js';
