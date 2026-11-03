import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  HOME,
  baseName,
  cleanText,
  cleanTitle,
  normalizePath,
  readJson,
  statSafe,
  truncate,
  walkFiles,
} from '../util.js';
import { compactJson } from './common.js';

const ID = 'dsh';
const ROOT = path.join(HOME, '.dsh');
const SESSIONS = path.join(ROOT, 'sessions');
const CACHE = path.join(ROOT, 'storages', 'session_projcache', 'sessions');

function cacheFor(sessionId) {
  return path.join(CACHE, `${sessionId}.json`);
}

function rowValue(cache, key) {
  return cache?.record?.rows?.[key]?.val;
}

function readHeader(file) {
  try {
    const buffer = fs.readFileSync(file);
    const raw = file.endsWith('.zstd') ? zlib.zstdDecompressSync(buffer) : buffer;
    const first = raw.toString('utf8').split('\n').find(Boolean);
    return first ? JSON.parse(first) : null;
  } catch {
    return null;
  }
}

function readEvents(file) {
  const buffer = fs.readFileSync(file);
  const raw = file.endsWith('.zstd') ? zlib.zstdDecompressSync(buffer) : buffer;
  const events = [];
  for (const line of raw.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return events;
}

function tokenTotal(cache) {
  const totals = rowValue(cache, 'tokenUsage')?.totals || {};
  return Object.values(totals).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function modelLabel(cache) {
  const model = rowValue(cache, 'modelSelection')?.lastUsed;
  if (!model) return '';
  return [model.provider, model.model].filter(Boolean).join(' / ');
}

export const dshAdapter = {
  id: ID,
  name: 'DeepSeek Harness',
  shortName: 'DSH',
  color: '#4d6bfe',
  glyph: 'D',
  description: 'DeepSeek Harness 的压缩会话事件流与项目缓存',
  kind: 'jsonl.zstd',
  roots: [SESSIONS],
  dataPaths: [SESSIONS, CACHE],

  detect() {
    return fs.existsSync(SESSIONS);
  },

  scan() {
    if (!fs.existsSync(SESSIONS)) return [];
    const files = walkFiles(SESSIONS, {
      filter: (file) => file.endsWith('session.v4.jsonl.zstd') || file.endsWith('session.jsonl.zstd') || file.endsWith('session.v4.jsonl'),
      maxDepth: 5,
    });
    const out = [];
    for (const file of files) {
      const stat = statSafe(file);
      if (!stat) continue;
      const dir = path.basename(path.dirname(file));
      const sessionId = dir.startsWith('session-') ? dir : `session-${baseName(path.dirname(file))}`;
      const cache = readJson(cacheFor(sessionId), null);
      let header = null;
      if (!cache) header = readHeader(file);
      if (!header && !cache) continue;
      const identity = cache?.record?.identity || {};
      const title = cleanTitle(
        rowValue(cache, 'title') || rowValue(cache, 'turnOutline')?.turns?.[0]?.prompt || 'DSH 会话',
        'DSH 会话',
      );
      const cwd = normalizePath(rowValue(cache, 'workingDirectory') || identity.cwd || header?.cwd || '');
      const createdAt = identity.createdAt || header?.createdAt || stat.birthtimeMs || stat.mtimeMs;
      const lastPromptAt = rowValue(cache, 'sessionListMetadata')?.lastPromptAt || 0;
      const updatedAt = Math.max(stat.mtimeMs, lastPromptAt || 0, rowValue(cache, 'timeContext')?.lastMessageTime || 0);
      const openTurn = rowValue(cache, 'turnBoundary')?.openTurnStartSeq;
      const openStep = rowValue(cache, 'sessionStats')?.openStep;
      const recent = Date.now() - stat.mtimeMs < 5 * 60 * 1000;
      const turns = rowValue(cache, 'sessionStats')?.turns || 0;
      const steps = rowValue(cache, 'sessionStats')?.steps || 0;
      const titlePrompt = rowValue(cache, 'titleInput')?.first?.text || '';
      out.push({
        source: ID,
        nativeId: sessionId,
        title,
        projectPath: cwd,
        projectName: cwd ? baseName(cwd) : '未归类',
        model: modelLabel(cache),
        status: recent && (openTurn || openStep) ? 'active' : 'completed',
        createdAt,
        updatedAt,
        sourcePath: file,
        archived: false,
        tokens: tokenTotal(cache),
        cost: 0,
        bytes: stat.size,
        fingerprint: `dsh:v2:${stat.size}:${stat.mtimeMs}:${lastPromptAt}`,
        extra: {
          agentPreset: header?.agentPreset || rowValue(cache, 'agentPreset') || '',
          turns,
          steps,
          firstPrompt: truncate(cleanText(titlePrompt), 2500),
          sessionId,
        },
      });
    }
    return out;
  },

  load(meta) {
    const events = readEvents(meta.sourcePath);
    const messages = [];
    const seen = new Set();
    const callNames = new Map();
    let lastTurnEnd = null;
    let title = '';
    const push = (message) => {
      const signature = `${message.role}|${message.kind}|${message.text}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      messages.push(message);
    };
    for (const event of events) {
      const time = event.time || 0;
      switch (event.type) {
        case 'user/message': {
          const source = event.data?.source;
          if (source?.kind !== 'user') break;
          const text = (event.data?.content || [])
            .map((part) => (typeof part === 'string' ? part : part?.text || ''))
            .filter(Boolean)
            .join('\n');
          if (text.trim()) push({ role: 'user', kind: 'text', text, createdAt: time });
          break;
        }
        case 'assistant/message': {
          const content = event.data?.message?.content;
          if (!Array.isArray(content)) break;
          for (const part of content) {
            if (!part || typeof part !== 'object') continue;
            if (part.type === 'text' && cleanText(part.text)) {
              push({ role: 'assistant', kind: 'text', text: part.text, createdAt: time });
            } else if (part.type === 'reasoning' && cleanText(part.text)) {
              push({ role: 'assistant', kind: 'reasoning', text: part.text, createdAt: time });
            } else if (part.type === 'tool-call') {
              const args = typeof part.arguments === 'string' ? part.arguments : compactJson(part.arguments, 1600);
              const callId = part.id || part.callId || '';
              if (callId) callNames.set(callId, part.name || 'tool');
              push({
                role: 'assistant',
                kind: 'tool-call',
                toolName: part.name || 'tool',
                text: `${part.name || 'tool'}(${truncate(args, 1600)})`,
                createdAt: time,
                meta: { callId },
              });
            }
          }
          break;
        }
        case 'tool/result': {
          const content = event.data?.message?.content;
          if (!Array.isArray(content)) break;
          const text = content.map((part) => part?.text || '').filter(Boolean).join('\n');
          if (cleanText(text)) {
            const callId = event.data?.toolCallId
              || event.data?.message?.toolCallId
              || event.data?.message?.source?.callId
              || '';
            push({
              role: 'tool',
              kind: 'tool',
              toolName: event.data?.message?.toolName || callNames.get(callId) || 'tool',
              text,
              createdAt: time,
              meta: { callId },
            });
          }
          break;
        }
        case 'tool/call': {
          const callId = event.data?.callId || event.data?.id || '';
          const name = event.data?.name || 'tool';
          if (callId) callNames.set(callId, name);
          break;
        }
        case 'tool/ptc-dispatch': {
          const callId = event.data?.rootCallId || event.data?.parentCallId || '';
          const name = event.data?.name || 'tool';
          if (callId) callNames.set(callId, name);
          break;
        }
        case 'session/title': {
          const value = event.data?.title || event.data?.value || '';
          if (typeof value === 'string' && value.trim()) title = value;
          break;
        }
        case 'turn/end':
          lastTurnEnd = event.data?.reason?.kind || 'completed';
          break;
        default:
          break;
      }
    }

    const searchText = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.kind === 'text' || m.kind === 'plan')))
      .map((m) => m.text)
      .join('\n\n');
    return {
      messages,
      searchText,
      metaPatch: {
        title: title ? cleanTitle(title, meta.title) : meta.title,
        status: lastTurnEnd === 'completed' ? 'completed' : meta.status,
      },
    };
  },

  resumeCommand() {
    return null;
  },

  sourceFolder(meta) {
    return path.dirname(meta.sourcePath);
  },

  meta() {
    return { sessions: SESSIONS, cache: CACHE };
  },
};
