import { dshAdapter } from './dsh.js';
import { codexAdapter } from './codex.js';
import { kimiAdapter } from './kimi.js';
import { zcodeAdapter } from './zcode.js';
import { opencodeAdapter } from './opencode.js';

export const adapters = [
  dshAdapter,
  kimiAdapter,
  zcodeAdapter,
  codexAdapter,
  opencodeAdapter,
];

export const adapterById = new Map(adapters.map((adapter) => [adapter.id, adapter]));
