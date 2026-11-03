import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  cleanTitle,
  collapse,
  json,
  makeSnippet,
  normalizePath,
  projectKey,
  toMs,
  truncate,
} from './util.js';

const SCHEMA_VERSION = 1;

export function openDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec(`    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = OFF;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT,
      short_name TEXT,
      color TEXT,
      glyph TEXT,
      kind TEXT,
      data_path TEXT,
      detected INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      session_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      indexed_bytes INTEGER DEFAULT 0,
      last_scan INTEGER,
      error TEXT,
      note TEXT,
      meta_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      native_id TEXT NOT NULL,
      title TEXT,
      project_path TEXT,
      project_key TEXT,
      project_name TEXT,
      model TEXT,
      status TEXT,
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0,
      indexed_at INTEGER DEFAULT 0,
      seen_at INTEGER DEFAULT 0,
      source_path TEXT,
      archived INTEGER DEFAULT 0,
      parent_id TEXT,
      parent_native_id TEXT,
      message_count INTEGER DEFAULT 0,
      tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      bytes INTEGER DEFAULT 0,
      fingerprint TEXT,
      extra_json TEXT,
      search_text TEXT,
      UNIQUE(source, native_id)
    );

    CREATE INDEX IF NOT EXISTS sessions_updated ON sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_source ON sessions(source, updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_project ON sessions(project_key, updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_seen ON sessions(source, seen_at);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT,
      tool_name TEXT,
      created_at INTEGER DEFAULT 0,
      meta_json TEXT
    );

    CREATE INDEX IF NOT EXISTS messages_session ON messages(session_id, seq);
  `);
  raw.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('schema_version', String(SCHEMA_VERSION));
  const columns = new Set(raw.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name));
  if (!columns.has('parent_id')) raw.exec('ALTER TABLE sessions ADD COLUMN parent_id TEXT');
  if (!columns.has('parent_native_id')) raw.exec('ALTER TABLE sessions ADD COLUMN parent_native_id TEXT');
  raw.exec('CREATE INDEX IF NOT EXISTS sessions_parent ON sessions(parent_id)');
  return new Database(raw, file);
}

class Database {
  constructor(raw, file) {
    this.raw = raw;
    this.file = file;
    this._insertMessage = raw.prepare(`
      INSERT INTO messages(session_id, seq, role, kind, text, tool_name, created_at, meta_json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  transaction(fn) {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.raw.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  }

  getMeta(key) {
    return this.raw.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value ?? null;
  }

  setMeta(key, value) {
    this.raw.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, String(value));
  }

  upsertSource(source) {
    this.raw.prepare(`
      INSERT INTO sources(id, name, short_name, color, glyph, kind, data_path, detected, enabled, note, meta_json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        short_name=excluded.short_name,
        color=excluded.color,
        glyph=excluded.glyph,
        kind=excluded.kind,
        data_path=excluded.data_path,
        detected=excluded.detected,
        note=excluded.note,
        meta_json=excluded.meta_json
    `).run(
      source.id,
      source.name ?? source.id,
      source.shortName ?? source.name ?? source.id,
      source.color ?? '#888',
      source.glyph ?? '·',
      source.kind ?? 'local',
      source.dataPath ?? '',
      source.detected ? 1 : 0,
      source.enabled === false ? 0 : 1,
      source.note ?? '',
      json(source.meta ?? {}),
    );
  }

  setSourceEnabled(id, enabled) {
    this.raw.prepare('UPDATE sources SET enabled=? WHERE id=?').run(enabled ? 1 : 0, id);
  }

  setSourceScan(id, { error = null, lastScan = Date.now() } = {}) {
    this.raw.prepare('UPDATE sources SET last_scan=?, error=? WHERE id=?').run(lastScan, error, id);
  }

  updateSourceStats(id) {
    const stats = this.raw.prepare(`
      SELECT COUNT(*) AS sessions, COALESCE(SUM(message_count), 0) AS messages,
             COALESCE(SUM(bytes), 0) AS bytes
      FROM sessions WHERE source=?
    `).get(id);
    this.raw.prepare('UPDATE sources SET session_count=?, message_count=?, indexed_bytes=? WHERE id=?')
      .run(stats.sessions, stats.messages, stats.bytes, id);
    return stats;
  }

  getSources() {
    return this.raw.prepare('SELECT * FROM sources ORDER BY detected DESC, session_count DESC, name').all();
  }

  getSource(id) {
    return this.raw.prepare('SELECT * FROM sources WHERE id=?').get(id) ?? null;
  }

  existingSession(source, nativeId) {
    return this.raw.prepare(`
      SELECT id, fingerprint, indexed_at, title, project_path, project_key, project_name
      FROM sessions WHERE source=? AND native_id=?
    `).get(source, nativeId) ?? null;
  }

  upsertSessionMeta(session, seenAt) {
    this.raw.prepare(`
      INSERT INTO sessions(
        id, source, native_id, title, project_path, project_key, project_name, model, status,
        created_at, updated_at, source_path, archived, parent_id, parent_native_id,
        bytes, extra_json, seen_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        project_path=excluded.project_path,
        project_key=excluded.project_key,
        project_name=excluded.project_name,
        model=excluded.model,
        status=excluded.status,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at,
        source_path=excluded.source_path,
        archived=excluded.archived,
        parent_id=excluded.parent_id,
        parent_native_id=excluded.parent_native_id,
        bytes=excluded.bytes,
        extra_json=excluded.extra_json,
        seen_at=excluded.seen_at
    `).run(
      session.id,
      session.source,
      session.nativeId,
      session.title,
      session.projectPath ?? '',
      projectKey(session.projectPath),
      session.projectName || (session.projectPath ? path.basename(normalizePath(session.projectPath)) : '未归类'),
      session.model ?? '',
      session.status ?? 'completed',
      toMs(session.createdAt),
      toMs(session.updatedAt),
      session.sourcePath ?? '',
      session.archived ? 1 : 0,
      session.parentId ?? '',
      session.parentNativeId ?? '',
      Number(session.bytes) || 0,
      json(session.extra ?? {}),
      seenAt,
    );
  }

  markIndexed(id, fingerprint, searchText, messageCount, indexedAt = Date.now()) {
    this.raw.prepare(`
      UPDATE sessions SET fingerprint=?, search_text=?, message_count=?, indexed_at=? WHERE id=?
    `).run(fingerprint, truncate(searchText, 350_000), messageCount, indexedAt, id);
  }

  saveMessages(sessionId, messages) {
    this.raw.prepare('DELETE FROM messages WHERE session_id=?').run(sessionId);
    let seq = 0;
    for (const message of messages) {
      const role = ['user', 'assistant', 'tool', 'system'].includes(message.role) ? message.role : 'assistant';
      const kind = message.kind || 'text';
      const text = message.text == null ? '' : String(message.text);
      if (!text.trim() && !message.toolName) continue;
      this._insertMessage.run(
        sessionId,
        seq,
        role,
        kind,
        truncate(text, kind === 'tool' ? 12_000 : 60_000),
        message.toolName ?? '',
        toMs(message.createdAt),
        json(message.meta ?? {}),
      );
      seq += 1;
    }
    return seq;
  }

  deleteStaleSessions(source, seenAt) {
    const stale = this.raw.prepare('SELECT id FROM sessions WHERE source=? AND seen_at < ?').all(source, seenAt);
    if (!stale.length) return 0;
    const removeMessages = this.raw.prepare('DELETE FROM messages WHERE session_id=?');
    const removeSession = this.raw.prepare('DELETE FROM sessions WHERE id=?');
    for (const row of stale) {
      removeMessages.run(row.id);
      removeSession.run(row.id);
    }
    return stale.length;
  }

  getSession(id) {
    const session = this.raw.prepare('SELECT * FROM sessions WHERE id=?').get(id);
    if (!session) return null;
    const messages = this.raw.prepare(`
      SELECT id, seq, role, kind, text, tool_name, created_at, meta_json
      FROM messages WHERE session_id=? ORDER BY seq ASC
    `).all(id);
    return { ...session, messages };
  }

  getSessionMeta(id) {
    return this.raw.prepare('SELECT * FROM sessions WHERE id=?').get(id) ?? null;
  }

  getSessionRelations(id) {
    const parent = this.raw.prepare(`
      SELECT * FROM sessions
      WHERE id = (SELECT parent_id FROM sessions WHERE id=?)
    `).get(id) ?? null;
    const children = this.raw.prepare(`
      SELECT * FROM sessions WHERE parent_id=? ORDER BY updated_at DESC
    `).all(id);
    return { parent, children };
  }

  _filters({ source, project, q, archived, since, until } = {}) {
    const where = [];
    const params = [];
    if (source) {
      where.push('source = ?');
      params.push(source);
    }
    if (project) {
      where.push('project_key = ?');
      params.push(projectKey(project));
    }
    if (archived === 'all') {
      // no filter
    } else if (archived === '1' || archived === true) {
      where.push('archived = 1');
    } else {
      where.push('archived = 0');
    }
    if (since) {
      where.push('updated_at >= ?');
      params.push(toMs(since));
    }
    if (until) {
      where.push('updated_at <= ?');
      params.push(toMs(until));
    }
    const terms = String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const term of terms) {
      const needle = term.toLowerCase();
      where.push(`(
        instr(lower(title), ?) > 0 OR
        instr(lower(project_path), ?) > 0 OR
        instr(lower(COALESCE(search_text, '')), ?) > 0
      )`);
      params.push(needle, needle, needle);
    }
    return { where, params, terms };
  }

  listSessions(options = {}) {
    const { limit = 40, offset = 0, sort = 'updated_desc' } = options;
    const { where, params, terms } = this._filters(options);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderMap = {
      updated_desc: 'updated_at DESC',
      updated_asc: 'updated_at ASC',
      created_desc: 'created_at DESC',
      messages_desc: 'message_count DESC, updated_at DESC',
    };
    let order = orderMap[sort] || orderMap.updated_desc;
    let orderParams = [];
    if (terms.length) {
      order = `(CASE WHEN instr(lower(title), ?) > 0 THEN 1 ELSE 0 END) DESC, ${order}`;
      orderParams = [terms[0].toLowerCase()];
    }
    const total = this.raw.prepare(`SELECT COUNT(*) AS n FROM sessions ${whereSql}`).get(...params).n;
    const rows = this.raw.prepare(`
      SELECT id, source, native_id, title, project_path, project_key, project_name, model, status,
             created_at, updated_at, archived, parent_id, parent_native_id,
             message_count, tokens, cost, source_path, extra_json, search_text,
             (SELECT title FROM sessions p WHERE p.id=sessions.parent_id) AS parent_title,
             (SELECT COUNT(*) FROM sessions c WHERE c.parent_id=sessions.id) AS child_count
      FROM sessions ${whereSql}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `).all(...params, ...orderParams, Math.max(1, Math.min(500, limit)), Math.max(0, offset));

    const items = rows.map((row) => {
      const snippet = terms.length ? makeSnippet(row.search_text || row.title || '', terms) : '';
      return {
        ...row,
        snippet,
        hasMore: false,
      };
    });
    return { total, items, limit, offset };
  }

  search(options = {}) {
    return this.listSessions(options);
  }

  getProjects() {
    const rows = this.raw.prepare(`
      SELECT project_key, project_path, project_name,
             COUNT(*) AS session_count,
             COALESCE(SUM(message_count), 0) AS message_count,
             MAX(updated_at) AS last_active,
             MIN(created_at) AS first_active
      FROM sessions
      WHERE archived=0 AND project_key <> ''
      GROUP BY project_key
      ORDER BY last_active DESC
    `).all();
    const bySource = this.raw.prepare(`
      SELECT project_key, source, COUNT(*) AS n
      FROM sessions
      WHERE archived=0 AND project_key <> ''
      GROUP BY project_key, source
    `).all();
    const map = new Map();
    for (const row of bySource) {
      if (!map.has(row.project_key)) map.set(row.project_key, []);
      map.get(row.project_key).push({ source: row.source, count: row.n });
    }
    return rows.map((row) => ({
      ...row,
      sources: map.get(row.project_key) || [],
      name: row.project_name || path.basename(normalizePath(row.project_path || '')) || '未归类',
    }));
  }

  getStats() {
    const totals = this.raw.prepare(`
      SELECT COUNT(*) AS sessions,
             COUNT(DISTINCT CASE WHEN project_key <> '' THEN project_key END) AS projects,
             COALESCE(SUM(message_count), 0) AS messages,
             COALESCE(SUM(tokens), 0) AS tokens,
             COALESCE(SUM(bytes), 0) AS bytes,
             MIN(CASE WHEN updated_at > 0 THEN updated_at END) AS earliest
      FROM sessions WHERE archived=0
    `).get();
    const bySource = this.raw.prepare(`
      SELECT source, COUNT(*) AS sessions, COALESCE(SUM(message_count), 0) AS messages,
             MAX(updated_at) AS last_active
      FROM sessions WHERE archived=0 GROUP BY source
    `).all();
    const activity = this.raw.prepare(`
      SELECT updated_at, source FROM sessions WHERE archived=0 ORDER BY updated_at DESC LIMIT 1500
    `).all();
    const recent = this.raw.prepare(`
      SELECT id, source, title, project_name, project_path, updated_at, message_count, model, status
      FROM sessions WHERE archived=0 ORDER BY updated_at DESC LIMIT 8
    `).all();
    const sourceMap = new Map(bySource.map((row) => [row.source, row]));
    return {
      totals: { ...totals, projects: totals.projects || 0 },
      sources: bySource,
      sourceMap: Object.fromEntries(sourceMap),
      activity,
      recent,
    };
  }

  getIndexInfo() {
    const size = (() => {
      try {
        return fs.statSync(this.file).size;
      } catch {
        return 0;
      }
    })();
    const counts = this.raw.prepare(`
      SELECT (SELECT COUNT(*) FROM sessions) AS sessions,
             (SELECT COUNT(*) FROM messages) AS messages,
             (SELECT COUNT(*) FROM sources) AS sources
    `).get();
    return { ...counts, bytes: size, file: this.file };
  }

  clearAll() {
    this.raw.exec('DELETE FROM messages; DELETE FROM sessions; UPDATE sources SET session_count=0, message_count=0, indexed_bytes=0;');
  }
}

export { SCHEMA_VERSION };
