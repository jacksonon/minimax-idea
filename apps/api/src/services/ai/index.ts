// AI Provider selector. The rest of the codebase imports `ai` and is blind to
// whether the call is hitting GMI Cloud or the local mock.

import { env } from '../../env.js';
import type { AIProvider } from './types.js';
import { mockProvider } from './mock.js';
import { gmiProvider } from './gmi.js';

export const ai: AIProvider = env.AI_PROVIDER === 'gmi' ? gmiProvider : mockProvider;

export type { AIProvider } from './types.js';
