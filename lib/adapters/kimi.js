import fs from 'node:fs';
import path from 'node:path';
import {
  HOME,
  baseName,
  cleanText,
  cleanTitle,
  normalizePath,
  readJson,
  statSafe,
  walkFiles,
} from '../util.js';
import { compactJson } from './common.js';

const ID = 'kimi';
const ROOT = path.join(HOME, '.kimi-code');
const SESSIONS = path.join(ROOT, 'sessions');
const INDEX = path.join(ROOT, 'session_index.jsonl');

function mainWire(sessionDir) {
  const main = path.join(sessionDir, 'agents', 'main', 'wire.jsonl');
  if (fs.existsSync(main)) return main;
  try {
    const agents = fs.readdirSync(path.join(sessionDir, 'agents'), { withFileTypes: true });
    for (const agent of agents) {
      const wire = path.join(sessionDir, 'agents', agent.name, 'wire.jsonl');
      if (agent.isDirectory() && fs.existsSync(wire)) return wire;
    }
  } catch {
    // no agents
  }
  return '';
}

function usageTokens(record) {
  if (!record || typeof record !== 'object') return 0;
  const usage = record.usage || record.data?.usage || record;
  if (typeof usage !== 'object') return 0;
  const direct = Number(usage.total ?? usage.totalTokens ?? usage.total_tokens);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const input = Number(usage.input ?? usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens) || 0;
  const output = Number(usage.output ?? usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens) || 0;
  const cacheRead = Number(usage.cacheRead ?? usage.cache_read_input_tokens ?? usage.inputCacheRead) || 0;
  return input + output + cacheRead;
}

function readWire(file) {
  const events = [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip line
      }
    }
  } catch {
    // unreadable
  }
  return events;
}

function contentParts(content) {
  if (!content) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [];
  return content.filter((part) => part && typeof part === 'object');
}

export const kimiAdapter = {
  id: ID,
  name: 'Kimi Code',
  shortName: 'Kimi',
  color: '#5b6472',
  glyph: 'K',
  description: 'Kimi Code CLI 的 wire 事件与子代理会话',
  kind: 'jsonl',
  roots: [SESSIONS],
  dataPaths: [SESSIONS, INDEX],

  detect() {
    return fs.existsSync(SESSIONS) || fs.existsSync(INDEX);
  },

  scan() {
    if (!fs.existsSync(SESSIONS)) return [];
    const states = walkFiles(SESSIONS, {
      filter: (file) => path.basename(file) === 'state.json',
      maxDepth: 4,
    });
    const out = [];
    for (const statePath of states) {
      const sessionDir = path.dirname(statePath);
      const state = readJson(statePath, null);
      if (!state || !state.id) continue;
      const wire = mainWire(sessionDir);
      const wireStat = statSafe(wire);
      const stateStat = statSafe(statePath);
      const subagents = Object.keys(state.agents || {}).filter((key) => key !== 'main').length;
      const title = cleanTitle(state.title || state.lastPrompt || '', `Kimi 会话 ${String(state.id).slice(-8)}`);
      const cwd = normalizePath(state.cwd || '');
      const archived = !!state.archived;
      const status = archived ? 'archived' : state.lastTurnReason === 'completed' ? 'completed' : state.lastTurnReason ? 'active' : 'completed';
      out.push({
        source: ID,
        nativeId: state.id,
        title,
        projectPath: cwd,
        projectName: cwd ? baseName(cwd) : '未归类',
        model: '',
        status,
        createdAt: Number(state.createdAt) || stateStat?.birthtimeMs || 0,
        updatedAt: Number(state.updatedAt) || stateStat?.mtimeMs || 0,
        sourcePath: sessionDir,
        archived,
        tokens: 0,
        cost: 0,
        bytes: (wireStat?.size || 0) + (stateStat?.size || 0),
        fingerprint: `kimi:v1:${wireStat?.size || 0}:${wireStat?.mtimeMs || 0}:${stateStat?.mtimeMs || 0}:${state.updatedAt || 0}`,
        extra: {
          subagents,
          lastTurnReason: state.lastTurnReason || '',
          titleKind: state.titleKind || '',
          wire,
          agentCount: Object.keys(state.agents || {}).length,
        },
      });
    }
    return out;
  },

  load(meta) {
    const events = readWire(meta.extra?.wire || '');
    const messages = [];
    const seen = new Set();
    const toolNames = new Map();
    const prompts = [];
    let model = '';
    let tokens = 0;

    const push = (message) => {
      const signature = `${message.role}|${message.kind}|${message.toolName || ''}|${message.text}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      messages.push(message);
    };

    for (const event of events) {
      const time = event.time || 0;
      if (event.type === 'profile.bind') {
        if (!model && (!event.agentId || event.agentId === 'main')) {
          model = event.modelAlias || event.model || event.profileName || '';
        }
        continue;
      }
      if (event.type === 'turn.prompt') {
        const text = (event.input || [])
          .map((part) => (part?.type === 'text' ? part.text : ''))
          .filter(Boolean)
          .join('\n');
        if (text.trim()) prompts.push(text);
        continue;
      }
      if (event.type === 'usage.record') {
        const value = usageTokens(event);
        if (value) tokens = Math.max(tokens, value);
        continue;
      }
      if (event.type !== 'agent.message.appended') continue;
      const payload = event.message?.message;
      const metaInfo = event.message?.meta || {};
      if (!payload || !payload.role) continue;
      const parts = contentParts(payload.content);
      const text = parts
        .filter((part) => part.type === 'text' || part.type === 'input_text' || part.type === 'output_text')
        .map((part) => part.text || '')
        .filter(Boolean)
        .join('\n');
      const reasoning = parts
        .filter((part) => part.type === 'think' || part.type === 'reasoning')
        .map((part) => part.think || part.text || '')
        .filter(Boolean)
        .join('\n');

      if (payload.role === 'user') {
        const fromUser = metaInfo.source === 'input' || metaInfo.origin?.kind === 'user' || (!metaInfo.source && !metaInfo.origin);
        if (fromUser && text.trim()) {
          push({ role: 'user', kind: 'text', text, createdAt: time });
        }
      } else if (payload.role === 'assistant') {
        if (reasoning.trim()) push({ role: 'assistant', kind: 'reasoning', text: reasoning, createdAt: time });
        if (text.trim()) push({ role: 'assistant', kind: 'text', text, createdAt: time });
        for (const call of payload.toolCalls || []) {
          const name = call.name || call.function?.name || 'tool';
          const args = call.arguments ?? call.function?.arguments ?? '';
          if (call.id) toolNames.set(call.id, name);
          push({
            role: 'assistant',
            kind: 'tool-call',
            toolName: name,
            text: typeof args === 'string' ? args : compactJson(args, 1600),
            createdAt: time,
            meta: { callId: call.id || '' },
          });
        }
      } else if (payload.role === 'tool') {
        const toolName = toolNames.get(payload.toolCallId) || 'tool';
        if (text.trim()) push({ role: 'tool', kind: 'tool', toolName, text, createdAt: time });
      }
    }

    if (!messages.some((m) => m.role === 'user') && prompts.length) {
      messages.unshift({ role: 'user', kind: 'text', text: prompts[0], createdAt: meta.createdAt });
    }

    const searchText = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.kind === 'text'))
      .map((m) => m.text)
      .join('\n\n');
    return {
      messages,
      searchText,
      metaPatch: {
        model,
        tokens,
        status: meta.archived ? 'archived' : 'completed',
      },
    };
  },

  resumeCommand(meta) {
    return `kimi -S ${meta.nativeId}`;
  },

  sourceFolder(meta) {
    return meta.sourcePath;
  },

  meta() {
    return { sessions: SESSIONS };
  },
};
