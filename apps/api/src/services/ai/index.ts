// AI Provider selector. The rest of the codebase imports `ai` and is blind to
// whether the call is hitting GMI Cloud or the local mock.
//
// We resolve the provider lazily and through a Proxy so the underlying
// getDefaultGmiProvider() (which reads config) is only invoked on first
// use. This keeps the Workers bundle small and lets the health
// endpoint safely ask `ai.name` even when no GMI key is configured.

import { getDefaultGmiProvider, type GmiConfig } from './gmi.js';
import type { AIProvider } from './types.js';
import { mockProvider } from './mock.js';

let _ai: AIProvider | null = null;
let _config: GmiConfig | null = null;

/**
 * Set the GMI Cloud configuration used by the next lazy
 * initialization. The Worker / Node dev server calls this once
 * at startup with values read from c.env / process.env. After
 * that, `ai.name` etc. just work.
 */
export function configureAi(cfg: GmiConfig | null): void {
  _config = cfg;
  _ai = null; // force a rebuild on next access
}

export function getAi(): AIProvider {
  if (_ai) return _ai;
  if (_config && _config.apiKey) {
    _ai = getDefaultGmiProvider(_config);
  } else {
    // No GMI key configured — degrade to mock. Routes that need
    // a real key (POST /api/dreams/generate) will 422 before we
    // ever get here.
    _ai = mockProvider;
  }
  return _ai;
}

// Back-compat: callers that do `import { ai }` get a proxy that
// always reflects the current provider.
export const ai: AIProvider = new Proxy({} as AIProvider, {
  get(_t, prop) {
    return (getAi() as any)[prop];
  },
});

export type { AIProvider };
