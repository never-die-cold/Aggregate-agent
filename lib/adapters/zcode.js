import fs from 'node:fs';
import path from 'node:path';
import {
  HOME,
  baseName,
  cleanText,
  cleanTitle,
  normalizePath,
  safeJson,
  statSafe,
  truncate,
} from '../util.js';
import { openReadOnly } from './common.js';

const ID = 'zcode';
const ROOT = path.join(HOME, '.zcode');
const CURRENT = path.join(ROOT, 'v2', 'tasks-index.sqlite');
const BACKUP = path.join(ROOT, 'backup');

function backupDatabases() {
  if (!fs.existsSync(BACKUP)) return [];
  const out = [];
  for (const entry of fs.readdirSync(BACKUP, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(BACKUP, entry.name, 'tables.sqlite');
    if (fs.existsSync(file)) out.push(file);
  }
  return out.sort((a, b) => (statSafe(b)?.mtimeMs || 0) - (statSafe(a)?.mtimeMs || 0));
}

function modelLabel(value) {
  if (!value) return '';
  return String(value)
    .replace(/^account:[^/]+\//, '')
    .replace(/^account:/, '')
    .replace(/^provider:/, '');
}

function extractTokens(meta) {
  const candidates = [meta?.tokenUsage, meta?.usage, meta?.tokens, meta?.stats?.tokenUsage, meta?.stats?.usage];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const total = Number(candidate.total ?? candidate.totalTokens ?? candidate.total_tokens);
    if (Number.isFinite(total) && total > 0) return total;
    let sum = 0;
    for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'uncachedInputTokens', 'outputTokens', 'cacheReadTokens']) {
      sum += Number(candidate[key]) || 0;
    }
    if (sum > 0) return sum;
  }
  return 0;
}

function readTask(file, taskId) {
  const db = openReadOnly(file);
  if (!db) return null;
  try {
    return db.prepare('SELECT * FROM tasks WHERE task_id=?').get(taskId) || null;
  } finally {
    db.close();
  }
}

export const zcodeAdapter = {
  id: ID,
  name: 'ZCode',
  shortName: 'ZCode',
  color: '#f59e0b',
  glyph: 'Z',
  description: 'ZCode 桌面端的任务索引与历史备份（纯文本记录）',
  kind: 'sqlite',
  roots: [ROOT],
  dataPaths: [CURRENT, BACKUP],

  detect() {
    return fs.existsSync(CURRENT) || fs.existsSync(BACKUP);
  },

  scan() {
    const dbs = [CURRENT, ...backupDatabases()].filter((file) => fs.existsSync(file));
    const seen = new Set();
    const out = [];
    for (const file of dbs) {
      const db = openReadOnly(file);
      if (!db) continue;
      try {
        const projects = new Map();
        try {
          for (const project of db.prepare('SELECT project_id, name FROM projects').all()) {
            projects.set(project.project_id, project.name);
          }
        } catch {
          // older backups may not have projects
        }
        let rows = [];
        try {
          rows = db.prepare('SELECT * FROM tasks ORDER BY COALESCE(updated_at, 0) DESC').all();
        } catch {
          continue;
        }
        for (const row of rows) {
          if (!row.task_id || seen.has(row.task_id)) continue;
          if (Number(row.deleted) === 1 || String(row.deleted) === '1') continue;
          seen.add(row.task_id);
          const meta = safeJson(row.meta_json, {}) || {};
          const workspace = normalizePath(row.workspace_path || row.root_path || '');
          const internalDraft = workspace.toLowerCase().startsWith(path.join(ROOT, 'workspace').toLowerCase() + path.sep);
          const rawTitle = row.title || meta.title || meta.target?.objective || '';
          const isGeneratedTitle = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawTitle).trim())
            || /^(draft|task)[-_]/i.test(String(rawTitle).trim());
          const title = internalDraft
            ? cleanTitle(`ZCode 草稿 · ${String(row.task_id).slice(-6)}`, 'ZCode 草稿')
            : isGeneratedTitle
              ? cleanTitle(`ZCode 草稿 · ${String(row.task_id).slice(-6)}`, 'ZCode 草稿')
              : cleanTitle(rawTitle, 'ZCode 任务');
          const objective = cleanText(meta.target?.objective || '');
          const text = cleanText(row.searchable_text || '');
          const archived = Number(row.archived) === 1 || String(row.archived) === '1';
          const updatedAt = Number(row.updated_at) || Number(meta.updatedAt) || 0;
          const createdAt = Number(row.created_at) || Number(meta.createdAt) || 0;
          out.push({
            source: ID,
            nativeId: row.task_id,
            title,
            projectPath: internalDraft ? '' : workspace,
            projectName: internalDraft ? 'ZCode 草稿' : projects.get(row.project_id) || (workspace ? baseName(workspace) : '未归类'),
            model: modelLabel(row.model || meta.model),
            status: archived ? 'archived' : row.task_status || meta.status || 'completed',
            createdAt,
            updatedAt: updatedAt || createdAt,
            sourcePath: file,
            archived,
            tokens: extractTokens(meta),
            cost: 0,
            bytes: text.length * 2,
            fingerprint: `zcode:v2:${updatedAt}:${row.task_status || ''}:${text.length}:${title}:${internalDraft ? 'draft' : 'project'}`,
            extra: {
              provider: row.provider || meta.provider || '',
              mode: row.mode || meta.mode || '',
              projectId: row.project_id || '',
              backup: file !== CURRENT,
              textOnly: true,
              internalDraft,
              objective: truncate(objective, 2500),
              hasText: !!text,
            },
          });
        }
      } finally {
        db.close();
      }
    }
    return out;
  },

  load(meta) {
    const row = readTask(meta.sourcePath, meta.nativeId);
    if (!row) return { messages: [], searchText: '', metaPatch: {} };
    const taskMeta = safeJson(row.meta_json, {}) || {};
    const objective = cleanText(taskMeta.target?.objective || meta.extra?.objective || '');
    let text = cleanText(row.searchable_text || '');
    if (objective && text.startsWith(objective)) {
      text = text.slice(objective.length).trim();
    }
    const messages = [];
    if (objective) {
      messages.push({ role: 'user', kind: 'text', text: objective, createdAt: meta.createdAt });
    }
    if (text) {
      messages.push({
        role: 'assistant',
        kind: 'log',
        text,
        createdAt: meta.updatedAt,
        meta: { textOnly: true, note: 'ZCode 本地索引保存的是拼接后的可检索文本，不是逐条消息。' },
      });
    }
    if (!messages.length) {
      messages.push({
        role: 'system',
        kind: 'note',
        text: 'ZCode 本地只保存了任务元数据，没有可读取的会话文本。',
      });
    }
    return {
      messages,
      searchText: [objective, text].filter(Boolean).join('\n\n'),
      metaPatch: {
        tokens: extractTokens(taskMeta) || meta.tokens,
        status: row.task_status || meta.status,
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
    return { current: CURRENT, backup: BACKUP };
  },
};
