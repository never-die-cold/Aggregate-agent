import fs from 'node:fs';
import path from 'node:path';
import {
  HOME,
  baseName,
  cleanText,
  cleanTitle,
  collapse,
  normalizePath,
  safeJson,
  statSafe,
  truncate,
} from '../util.js';
import { compactJson, openReadOnly, textFromContent } from './common.js';

const ID = 'codex';
const ROOT = path.join(HOME, '.codex');
const STATE_DB = path.join(ROOT, 'state_5.sqlite');
const HISTORY_DB = path.join(ROOT, 'thread_history_1.sqlite');
const SESSIONS_DIR = path.join(ROOT, 'sessions');

function projectMap(db) {
  const map = new Map();
  try {
    const projects = db.prepare('SELECT id, name FROM projects').all();
    const roots = db.prepare('SELECT project_id, position, path FROM project_roots ORDER BY position').all();
    const byId = new Map(projects.map((row) => [row.id, row]));
    for (const root of roots) {
      const project = byId.get(root.project_id);
      if (!map.has(root.project_id)) map.set(root.project_id, { name: project?.name || '', path: root.path });
    }
    for (const project of projects) {
      if (!map.has(project.id)) map.set(project.id, { name: project.name || '', path: '' });
    }
  } catch {
    // projects are optional
  }
  return map;
}

function cleanModel(value) {
  if (!value) return '';
  return String(value).replace(/^openai\//, '');
}

function itemText(item) {
  return {
    user: textFromContent(item.content),
    assistant: cleanText(item.text || textFromContent(item.content)),
    reasoning: [
      ...(Array.isArray(item.summary) ? item.summary : []),
      ...(Array.isArray(item.content) ? item.content : []),
    ]
      .map((part) => part?.text || part?.summary_text || '')
      .filter(Boolean)
      .join('\n'),
  };
}

function renderCommand(item) {
  const command = cleanText(item.command || '');
  const output = cleanText(item.aggregatedOutput || item.output || '');
  const exit = item.exitCode === undefined || item.exitCode === null ? '' : `exit ${item.exitCode}`;
  return [command && `$ ${command}`, output, exit].filter(Boolean).join('\n\n');
}

function renderMcp(item) {
  const label = [item.server, item.tool].filter(Boolean).join('.') || 'mcp';
  const args = item.arguments && Object.keys(item.arguments).length ? compactJson(item.arguments, 1200) : '';
  const result = textFromContent(item.result?.content) || compactJson(item.result, 1600);
  return [label, args, result].filter(Boolean).join('\n\n');
}

function renderChanges(item) {
  const changes = Array.isArray(item.changes) ? item.changes : [];
  const lines = changes.slice(0, 12).map((change) => {
    const kind = typeof change.kind === 'object' ? change.kind.type : change.kind;
    return `${kind || 'change'}  ${change.path || ''}`;
  });
  if (changes.length > 12) lines.push(`… 另有 ${changes.length - 12} 个文件`);
  const diff = changes.map((change) => change.diff || '').filter(Boolean).join('\n');
  return [lines.join('\n'), diff ? truncate(diff, 2400) : ''].filter(Boolean).join('\n\n');
}

function renderWebSearch(item) {
  const query = item.query || '';
  const results = Array.isArray(item.results) ? item.results : [];
  const lines = results.slice(0, 5).map((result) => {
    const title = result.title || result.domain || result.url || '';
    const snippet = result.snippet ? collapse(result.snippet).slice(0, 180) : '';
    return [title, snippet].filter(Boolean).join(' — ');
  });
  return [query && `搜索：${query}`, ...lines].filter(Boolean).join('\n');
}

function itemToMessage(item, itemType, createdAt) {
  const text = itemText(item);
  switch (itemType) {
    case 'userMessage':
      if (!text.user.trim()) return null;
      return { role: 'user', kind: 'text', text: text.user, createdAt };
    case 'agentMessage':
      if (!text.assistant.trim()) return null;
      return { role: 'assistant', kind: 'text', text: text.assistant, createdAt };
    case 'reasoning':
      if (!text.reasoning.trim()) return null;
      return { role: 'assistant', kind: 'reasoning', text: text.reasoning, createdAt };
    case 'commandExecution':
      return { role: 'tool', kind: 'tool', toolName: 'shell', text: renderCommand(item), createdAt };
    case 'mcpToolCall':
      return { role: 'tool', kind: 'tool', toolName: [item.server, item.tool].filter(Boolean).join('.') || 'mcp', text: renderMcp(item), createdAt };
    case 'fileChange':
      return { role: 'tool', kind: 'tool', toolName: 'apply_patch', text: renderChanges(item), createdAt };
    case 'webSearch':
      return { role: 'tool', kind: 'tool', toolName: 'web_search', text: renderWebSearch(item), createdAt };
    case 'imageView':
      return { role: 'tool', kind: 'tool', toolName: 'view_image', text: item.path || '', createdAt };
    case 'imageGeneration':
      return { role: 'tool', kind: 'tool', toolName: 'image_generation', text: item.revisedPrompt || item.status || '', createdAt };
    case 'plan':
      return { role: 'assistant', kind: 'plan', text: item.text || '', createdAt };
    case 'contextCompaction':
      return { role: 'system', kind: 'note', text: '上下文已自动压缩', createdAt };
    case 'subAgentActivity':
      return {
        role: 'tool',
        kind: 'tool',
        toolName: 'subagent',
        text: `${item.kind || 'activity'} ${item.agentPath || item.agentThreadId || ''}`.trim(),
        createdAt,
      };
    case 'collabAgentToolCall':
      return { role: 'tool', kind: 'tool', toolName: `collab.${item.tool || 'agent'}`, text: item.prompt || item.status || '', createdAt };
    default:
      return null;
  }
}

export const codexAdapter = {
  id: ID,
  name: 'ChatGPT / Codex',
  shortName: 'ChatGPT',
  color: '#10a37f',
  glyph: 'C',
  description: 'ChatGPT 桌面端的 Codex 线程与本地 rollout 记录',
  kind: 'sqlite+jsonl',
  roots: [ROOT],
  dataPaths: [STATE_DB, HISTORY_DB, SESSIONS_DIR],

  detect() {
    return fs.existsSync(STATE_DB) || fs.existsSync(HISTORY_DB) || fs.existsSync(SESSIONS_DIR);
  },

  scan() {
    if (!fs.existsSync(STATE_DB)) return [];
    const db = openReadOnly(STATE_DB);
    if (!db) return [];
    try {
      const projects = projectMap(db);
      const rows = db.prepare(`
        SELECT id, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms,
               source, model_provider, cwd, title, name, sandbox_policy, approval_mode,
               tokens_used, archived, git_sha, git_branch, git_origin_url, model,
               reasoning_effort, thread_source, first_user_message, project_id, originator
        FROM threads
        ORDER BY COALESCE(updated_at_ms, updated_at * 1000) DESC
      `).all();
      const out = [];
      for (const row of rows) {
        const project = projects.get(row.project_id);
        const projectPath = normalizePath(row.cwd || project?.path || '');
        const projectName = project?.name || (projectPath ? baseName(projectPath) : '未归类');
        let subagent = null;
        if (row.thread_source === 'subagent') {
          subagent = safeJson(row.source, {})?.subagent?.thread_spawn || null;
        }
        const agentPath = subagent?.agent_path || '';
        const agentName = agentPath.split('/').filter(Boolean).pop() || '';
        const rawTitle = row.name || row.title || row.first_user_message || '';
        const title = cleanTitle(
          rawTitle,
          agentName ? `子代理 · ${agentName}` : `ChatGPT 会话 ${String(row.id).slice(0, 8)}`,
        );
        const updatedAt = row.updated_at_ms || (row.updated_at ? row.updated_at * 1000 : 0);
        const createdAt = row.created_at_ms || (row.created_at ? row.created_at * 1000 : 0);
        const rollout = row.rollout_path || '';
        const stat = statSafe(rollout);
        out.push({
          source: ID,
          nativeId: row.id,
          title,
          projectPath,
          projectName,
          model: cleanModel(row.model || row.model_provider),
          status: row.archived ? 'archived' : 'completed',
          createdAt,
          updatedAt: updatedAt || createdAt,
          sourcePath: rollout,
          archived: !!row.archived,
          tokens: Number(row.tokens_used) || 0,
          cost: 0,
          bytes: stat?.size || 0,
          fingerprint: `codex:v1:${row.updated_at_ms || row.updated_at || ''}:${row.tokens_used || 0}:${row.title ? row.title.length : 0}`,
          extra: {
            firstUserMessage: truncate(cleanText(row.first_user_message || ''), 3000),
            modelProvider: row.model_provider || '',
            threadSource: row.thread_source || row.source || '',
            originator: row.originator || '',
            gitBranch: row.git_branch || '',
            gitSha: row.git_sha || '',
            projectId: row.project_id || '',
            approvalMode: row.approval_mode || '',
            subagent: subagent
              ? {
                  parentThreadId: subagent.parent_thread_id || '',
                  depth: subagent.depth || 0,
                  agentPath,
                  agentName,
                }
              : null,
          },
        });
      }
      return out;
    } finally {
      db.close();
    }
  },

  load(meta) {
    const messages = [];
    let hasStructured = false;
    if (fs.existsSync(HISTORY_DB)) {
      const db = openReadOnly(HISTORY_DB);
      if (db) {
        try {
          const rows = db.prepare(`
            SELECT item_json, item_type, created_at_ms, rollout_ordinal
            FROM thread_items
            WHERE thread_id=?
            ORDER BY rollout_ordinal ASC, created_at_ms ASC
          `).all(meta.nativeId);
          for (const row of rows) {
            let item;
            try {
              item = JSON.parse(row.item_json);
            } catch {
              continue;
            }
            const message = itemToMessage(item, row.item_type, row.created_at_ms);
            if (message) {
              messages.push(message);
              hasStructured = true;
            }
          }
        } finally {
          db.close();
        }
      }
    }

    if (!hasStructured && meta.extra?.firstUserMessage) {
      messages.push({ role: 'user', kind: 'text', text: meta.extra.firstUserMessage, createdAt: meta.createdAt });
      messages.push({
        role: 'system',
        kind: 'note',
        text: '该线程的结构化事件没有投影到本地数据库，仅能展示首条用户消息。原始 rollout 仍保存在源目录。',
      });
    }

    const searchText = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.kind === 'text' || m.kind === 'plan')))
      .map((m) => m.text)
      .join('\n\n');
    return { messages, searchText, metaPatch: {} };
  },

  resumeCommand(meta) {
    return `codex resume ${meta.nativeId}`;
  },

  sourceFolder(meta) {
    if (meta.sourcePath) {
      const dir = path.dirname(meta.sourcePath);
      if (fs.existsSync(dir)) return dir;
    }
    return path.join(ROOT, 'sessions');
  },

  meta() {
    return { stateDb: STATE_DB, historyDb: HISTORY_DB };
  },
};
