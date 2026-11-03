import fs from 'node:fs';
import path from 'node:path';
import {
  HOME,
  baseName,
  cleanText,
  cleanTitle,
  normalizePath,
  statSafe,
} from '../util.js';
import { compactJson, openReadOnly } from './common.js';

const ID = 'opencode';
const ROOT = path.join(HOME, '.local', 'share', 'opencode');
const DB = path.join(ROOT, 'opencode.db');

function parseModel(value) {
  if (!value) return '';
  try {
    const model = typeof value === 'string' ? JSON.parse(value) : value;
    const id = model.id || model.modelID || model.model || '';
    const provider = model.providerID || model.provider || '';
    return [provider, id].filter(Boolean).join(' / ');
  } catch {
    return String(value);
  }
}

function projectPaths(db) {
  const map = new Map();
  try {
    for (const row of db.prepare('SELECT id, worktree, name FROM project').all()) {
      map.set(row.id, { path: normalizePath(row.worktree || ''), name: row.name || '' });
    }
  } catch {
    // no project table
  }
  return map;
}

function tokenTotal(row) {
  return (Number(row.tokens_input) || 0) + (Number(row.tokens_output) || 0) + (Number(row.tokens_reasoning) || 0);
}

function toolText(input, output, title) {
  const parts = [];
  if (title) parts.push(String(title));
  if (input) {
    let parsed = input;
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch {
        parsed = input;
      }
    }
    if (typeof parsed === 'string') {
      if (parsed.trim()) parts.push(parsed);
    } else if (parsed && Object.keys(parsed).length) {
      parts.push(compactJson(parsed, 3000));
    }
  }
  if (output) parts.push(String(output));
  return parts.join('\n\n');
}

function renderPart(part) {
  switch (part.type) {
    case 'text':
      return part.text ? { role: 'assistant', kind: 'text', text: part.text } : null;
    case 'reasoning':
      return part.text ? { role: 'assistant', kind: 'reasoning', text: part.text } : null;
    case 'tool':
      return {
        role: 'tool',
        kind: 'tool',
        toolName: part.tool || 'tool',
        text: toolText(part.input, part.output, part.title),
        meta: { status: part.status || '' },
      };
    case 'patch':
      {
        let files = part.files;
        if (typeof files === 'string') {
          try {
            files = JSON.parse(files);
          } catch {
            files = files;
          }
        }
        return {
          role: 'tool',
          kind: 'tool',
          toolName: 'patch',
          text: Array.isArray(files) ? files.join('\n') : String(files || ''),
        };
      }
    case 'subtask':
      return {
        role: 'tool',
        kind: 'tool',
        toolName: `subtask:${part.agent || ''}`,
        text: [part.description, part.prompt].filter(Boolean).join('\n\n'),
      };
    case 'compaction':
      return { role: 'system', kind: 'note', text: '上下文已自动压缩' };
    default:
      return null;
  }
}

function renderSessionMessage(row) {
  let data;
  try {
    data = JSON.parse(row.data);
  } catch {
    return [];
  }
  const out = [];
  if (row.type === 'user') {
    const text = cleanText(data.text || '');
    if (text) out.push({ role: 'user', kind: 'text', text, createdAt: row.time_created });
    return out;
  }
  if (row.type === 'assistant') {
    for (const part of Array.isArray(data.content) ? data.content : []) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'text' && cleanText(part.text)) {
        out.push({ role: 'assistant', kind: 'text', text: part.text, createdAt: row.time_created });
      } else if ((part.type === 'reasoning' || part.type === 'think') && cleanText(part.text || part.think)) {
        out.push({ role: 'assistant', kind: 'reasoning', text: part.text || part.think, createdAt: row.time_created });
      } else if (part.type === 'tool' || part.type === 'tool-call') {
        out.push({
          role: 'tool',
          kind: 'tool',
          toolName: part.tool || part.name || 'tool',
          text: toolText(part.input || part.arguments, part.output, part.title),
          createdAt: row.time_created,
        });
      }
    }
    return out;
  }
  if (row.type === 'compaction' && data.summary) {
    out.push({ role: 'system', kind: 'note', text: `上下文压缩摘要\n\n${data.summary}`, createdAt: row.time_created });
  }
  return out;
}

export const opencodeAdapter = {
  id: ID,
  name: 'OpenCode',
  shortName: 'OpenCode',
  color: '#8b5cf6',
  glyph: 'O',
  description: 'OpenCode 本地 SQLite 会话库，包含子代理与工具调用',
  kind: 'sqlite',
  roots: [ROOT],
  dataPaths: [DB],

  detect() {
    return fs.existsSync(DB);
  },

  scan() {
    if (!fs.existsSync(DB)) return [];
    const stat = statSafe(DB);
    const db = openReadOnly(DB);
    if (!db) return [];
    try {
      const projects = projectPaths(db);
      const messageCounts = new Map();
      const sessionMessageCounts = new Map();
      try {
        for (const row of db.prepare('SELECT session_id, COUNT(*) AS n FROM message GROUP BY session_id').all()) {
          messageCounts.set(row.session_id, row.n);
        }
      } catch {
        // optional
      }
      try {
        for (const row of db.prepare('SELECT session_id, COUNT(*) AS n FROM session_message GROUP BY session_id').all()) {
          sessionMessageCounts.set(row.session_id, row.n);
        }
      } catch {
        // optional
      }

      const rows = new Map();
      try {
        for (const row of db.prepare('SELECT * FROM session_v2').all()) rows.set(row.id, { ...row, _v2: true });
      } catch {
        // fallback below
      }
      try {
        for (const row of db.prepare('SELECT * FROM session').all()) {
          if (!rows.has(row.id)) rows.set(row.id, row);
          else {
            const v2 = rows.get(row.id);
            const merged = { ...row };
            for (const [key, value] of Object.entries(v2)) {
              if (value !== null && value !== undefined && value !== '') merged[key] = value;
            }
            rows.set(row.id, merged);
          }
        }
      } catch {
        // no legacy table
      }

      const out = [];
      for (const row of rows.values()) {
        const project = projects.get(row.project_id);
        const projectPath = normalizePath(row.directory || project?.path || '');
        const rawTitle = row.title || '';
        const title = cleanTitle(rawTitle, `OpenCode 会话 ${String(row.id).slice(-8)}`);
        const updatedAt = Number(row.time_updated) || Number(row.time_created) || 0;
        const createdAt = Number(row.time_created) || 0;
        const msgCount = messageCounts.get(row.id) || 0;
        const smsgCount = sessionMessageCounts.get(row.id) || 0;
        const archived = !!Number(row.time_archived);
        out.push({
          source: ID,
          nativeId: row.id,
          parentNativeId: row.parent_id || '',
          title,
          projectPath,
          projectName: project?.name || (projectPath ? baseName(projectPath) : '未归类'),
          model: parseModel(row.model),
          status: archived ? 'archived' : Date.now() - updatedAt < 15 * 60 * 1000 ? 'active' : 'completed',
          createdAt,
          updatedAt,
          sourcePath: DB,
          archived,
          tokens: tokenTotal(row),
          cost: Number(row.cost) || 0,
          bytes: 0,
          fingerprint: `opencode:v2:${updatedAt}:${msgCount}:${smsgCount}:${row.title ? row.title.length : 0}:${row.time_archived || 0}:${row.parent_id || ''}`,
          extra: {
            parentId: row.parent_id || '',
            projectId: row.project_id || '',
            agent: row.agent || '',
            version: row.version || '',
            shareUrl: row.share_url || '',
            messageCount: msgCount || smsgCount,
          },
        });
      }
      return out;
    } finally {
      db.close();
    }
  },

  load(meta) {
    if (!fs.existsSync(DB)) return { messages: [], searchText: '', metaPatch: {} };
    const db = openReadOnly(DB);
    if (!db) return { messages: [], searchText: '', metaPatch: {} };
    try {
      const messages = [];
      let titleCandidate = '';
      let usedSessionMessage = false;
      let messageRows = [];
      try {
        messageRows = db.prepare(`
          SELECT id, data, time_created FROM message WHERE session_id=? ORDER BY time_created ASC, id ASC
        `).all(meta.nativeId);
      } catch {
        messageRows = [];
      }

      if (messageRows.length) {
        const partRows = db.prepare(`
          SELECT message_id,
                 json_extract(data,'$.type') AS type,
                 json_extract(data,'$.text') AS text,
                 json_extract(data,'$.tool') AS tool,
                 json_extract(data,'$.state.input') AS input,
                 substr(json_extract(data,'$.state.output'), 1, 16000) AS output,
                 json_extract(data,'$.state.title') AS title,
                 json_extract(data,'$.state.status') AS status,
                 json_extract(data,'$.files') AS files,
                 json_extract(data,'$.agent') AS agent,
                 json_extract(data,'$.description') AS description,
                 json_extract(data,'$.prompt') AS prompt
          FROM part
          WHERE session_id=?
            AND json_extract(data,'$.type') IN ('text','reasoning','tool','patch','subtask','compaction')
          ORDER BY time_created ASC, id ASC
        `).all(meta.nativeId);
        const byMessage = new Map();
        for (const part of partRows) {
          if (!byMessage.has(part.message_id)) byMessage.set(part.message_id, []);
          byMessage.get(part.message_id).push(part);
        }
        for (const row of messageRows) {
          let data = {};
          try {
            data = JSON.parse(row.data);
          } catch {
            continue;
          }
          const role = data.role === 'user' ? 'user' : 'assistant';
          const parts = byMessage.get(row.id) || [];
          for (const part of parts) {
            const rendered = renderPart(part);
            if (!rendered) continue;
            if (rendered.role === 'assistant') rendered.role = role;
            rendered.createdAt = row.time_created;
            messages.push(rendered);
            if (role === 'user' && rendered.kind === 'text' && !titleCandidate) {
              titleCandidate = rendered.text;
            }
          }
        }
      } else {
        usedSessionMessage = true;
        try {
          const rows = db.prepare(`
            SELECT type, data, time_created FROM session_message WHERE session_id=? ORDER BY seq ASC
          `).all(meta.nativeId);
          for (const row of rows) {
            const rendered = renderSessionMessage(row);
            for (const message of rendered) {
              messages.push(message);
              if (message.role === 'user' && message.kind === 'text' && !titleCandidate) {
                titleCandidate = message.text;
              }
            }
          }
        } catch {
          // no new table
        }
      }

      const searchText = messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.kind === 'text'))
        .map((m) => m.text)
        .join('\n\n');
      const patch = {};
      if (!meta.title || /^New session/i.test(meta.title) || meta.title.startsWith('OpenCode 会话')) {
        patch.title = cleanTitle(titleCandidate, meta.title || 'OpenCode 会话');
      }
      if (!meta.model && messages.length) {
        const first = messageRows.find((row) => {
          try {
            const data = JSON.parse(row.data);
            return data.modelID || data.providerID;
          } catch {
            return false;
          }
        });
        if (first) {
          try {
            const data = JSON.parse(first.data);
            patch.model = [data.providerID, data.modelID].filter(Boolean).join(' / ');
          } catch {
            // ignore
          }
        }
      }
      return { messages, searchText, metaPatch: patch, usedSessionMessage };
    } finally {
      db.close();
    }
  },

  resumeCommand(meta) {
    const cwd = meta.projectPath ? ` "${meta.projectPath}"` : '';
    return `opencode --session ${meta.nativeId}${cwd}`;
  },

  sourceFolder() {
    return ROOT;
  },

  meta() {
    return { database: DB };
  },
};
