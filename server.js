import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openDatabase } from './lib/db.js';
import { SyncManager } from './lib/sync.js';
import { adapterById } from './lib/adapters/index.js';
import { HOME, safeJson, statSafe } from './lib/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname);
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA, 'agenthub.db');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const OPEN_BROWSER = !args.includes('--no-open');
const FORCE_REINDEX = args.includes('--reindex');
const START_PORT = Number(argValue('--port', process.env.AGENTHUB_PORT || 5173)) || 5173;

fs.mkdirSync(DATA, { recursive: true });

if (FORCE_REINDEX && fs.existsSync(DB_FILE)) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(DB_FILE + suffix, { force: true });
    } catch {
      // ignore
    }
  }
}

const db = openDatabase(DB_FILE);
const clients = new Set();

function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch {
      clients.delete(client);
    }
  }
}

const sync = new SyncManager(db, broadcast);

function sessionView(row, { withSnippet = false } = {}) {
  const extra = safeJson(row.extra_json, {}) || {};
  return {
    id: row.id,
    source: row.source,
    nativeId: row.native_id,
    title: row.title,
    projectPath: row.project_path || '',
    projectKey: row.project_key || '',
    projectName: row.project_name || '未归类',
    model: row.model || '',
    status: row.status || 'completed',
    createdAt: row.created_at || 0,
    updatedAt: row.updated_at || 0,
    indexedAt: row.indexed_at || 0,
    sourcePath: row.source_path || '',
    archived: !!row.archived,
    messageCount: row.message_count || 0,
    tokens: row.tokens || 0,
    cost: row.cost || 0,
    extra,
    ...(withSnippet ? { snippet: row.snippet || '' } : {}),
  };
}

function messageView(row) {
  return {
    id: row.id,
    seq: row.seq,
    role: row.role,
    kind: row.kind,
    text: row.text || '',
    toolName: row.tool_name || '',
    createdAt: row.created_at || 0,
    meta: safeJson(row.meta_json, {}) || {},
  };
}

function sourceView(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    glyph: row.glyph,
    kind: row.kind,
    dataPath: row.data_path || '',
    detected: !!row.detected,
    enabled: !!row.enabled,
    sessionCount: row.session_count || 0,
    messageCount: row.message_count || 0,
    indexedBytes: row.indexed_bytes || 0,
    lastScan: row.last_scan || 0,
    error: row.error || '',
    note: row.note || '',
    meta: safeJson(row.meta_json, {}) || {},
  };
}

function projectView(row) {
  return {
    key: row.project_key,
    path: row.project_path,
    name: row.name,
    sessionCount: row.session_count,
    messageCount: row.message_count,
    lastActive: row.last_active,
    firstActive: row.first_active,
    sources: row.sources,
  };
}

function localDayKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function activitySeries(rows) {
  const valid = rows.filter((row) => Number(row.updated_at) > 0);
  if (!valid.length) return [];
  const floor = Date.now() - 730 * 24 * 60 * 60 * 1000;
  const earliest = Math.max(floor, Math.min(...valid.map((row) => Number(row.updated_at))));
  const start = new Date(earliest);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const map = new Map();
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = localDayKey(cursor.getTime());
    map.set(key, {
      date: key,
      label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      total: 0,
      sources: {},
    });
  }
  for (const row of valid) {
    const key = localDayKey(Number(row.updated_at));
    const entry = map.get(key);
    if (!entry) continue;
    entry.total += 1;
    entry.sources[row.source] = (entry.sources[row.source] || 0) + 1;
  }
  return [...map.values()];
}

function statsView() {
  const stats = db.getStats();
  const sources = db.getSources().filter((row) => row.detected);
  const totals = stats.totals;
  return {
    sessions: totals.sessions || 0,
    projects: totals.projects || 0,
    messages: totals.messages || 0,
    tokens: totals.tokens || 0,
    earliest: totals.earliest || 0,
    agents: sources.length,
    activeAgents: sources.filter((s) => s.session_count > 0).length,
    activity: activitySeries(stats.activity),
    bySource: stats.sources,
    recent: stats.recent,
  };
}

function bootstrap() {
  const sources = db.getSources().map(sourceView);
  const projects = db.getProjects().slice(0, 8).map(projectView);
  return {
    app: { name: 'AgentHub', version: '0.1.0', root: ROOT, dbFile: DB_FILE, dataDir: DATA, home: HOME },
    sources,
    stats: statsView(),
    projects,
    sync: sync.snapshot(),
    now: Date.now(),
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => resolve(safeJson(raw, {}) || {}));
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

function openFolder(dir) {
  const target = path.resolve(dir);
  const st = statSafe(target);
  if (!st || !st.isDirectory()) return false;
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    spawn(command, [target], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return false;
  }
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, relative);
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  const stat = statSafe(file);
  if (!stat || !stat.isFile()) {
    sendText(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };
  const headers = {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=0, must-revalidate',
  };
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';

  try {
    if (pathname === '/api/health') {
      sendJson(res, 200, { ok: true, now: Date.now(), version: '0.1.0' });
      return;
    }
    if (pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      res.write(`data: ${JSON.stringify({ type: 'sync', state: sync.snapshot() })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (pathname === '/api/bootstrap') {
      sendJson(res, 200, bootstrap());
      return;
    }
    if (pathname === '/api/status') {
      sendJson(res, 200, { sync: sync.snapshot(), sources: db.getSources().map(sourceView) });
      return;
    }
    if (pathname === '/api/sessions') {
      const result = db.listSessions({
        source: url.searchParams.get('source') || '',
        project: url.searchParams.get('project') || '',
        q: url.searchParams.get('q') || '',
        archived: url.searchParams.get('archived') || '0',
        sort: url.searchParams.get('sort') || 'updated_desc',
        limit: Number(url.searchParams.get('limit') || 40),
        offset: Number(url.searchParams.get('offset') || 0),
        since: url.searchParams.get('since') || '',
      });
      sendJson(res, 200, {
        total: result.total,
        items: result.items.map((row) => sessionView(row, { withSnippet: true })),
        limit: result.limit,
        offset: result.offset,
      });
      return;
    }
    if (pathname.startsWith('/api/sessions/')) {
      const id = pathname.slice('/api/sessions/'.length);
      const session = db.getSession(id);
      if (!session) {
        sendJson(res, 404, { error: 'session_not_found' });
        return;
      }
      const adapter = adapterById.get(session.source);
      const view = sessionView(session);
      const meta = { ...view, nativeId: session.native_id, sourcePath: session.source_path };
      sendJson(res, 200, {
        session: view,
        messages: session.messages.map(messageView),
        commands: {
          resume: adapter?.resumeCommand?.(meta) || null,
          sourceFolder: adapter?.sourceFolder?.(meta) || meta.sourcePath || '',
        },
      });
      return;
    }
    if (pathname === '/api/projects') {
      sendJson(res, 200, { items: db.getProjects().map(projectView) });
      return;
    }
    if (pathname === '/api/sources') {
      sendJson(res, 200, { items: db.getSources().map(sourceView) });
      return;
    }
    if (pathname === '/api/sync' && method === 'POST') {
      const body = await readBody(req);
      if (sync.state.running) {
        sendJson(res, 202, { ok: true, running: true, sync: sync.snapshot() });
        return;
      }
      const only = body.source ? [body.source] : null;
      sendJson(res, 202, { ok: true, started: true });
      sync.run({ force: !!body.force, only }).catch((error) => console.error('[sync]', error));
      return;
    }
    if (pathname === '/api/reindex' && method === 'POST') {
      if (sync.state.running) {
        sendJson(res, 202, { ok: true, running: true, sync: sync.snapshot() });
        return;
      }
      sendJson(res, 202, { ok: true, started: true });
      sync.reindexAll().catch((error) => console.error('[reindex]', error));
      return;
    }
    if (pathname.startsWith('/api/sources/') && method === 'POST') {
      const id = pathname.slice('/api/sources/'.length);
      if (!adapterById.has(id)) {
        sendJson(res, 404, { error: 'source_not_found' });
        return;
      }
      const body = await readBody(req);
      if (typeof body.enabled === 'boolean') {
        db.setSourceEnabled(id, body.enabled);
        broadcast({ type: 'source', source: sourceView(db.getSource(id)) });
      }
      if (body.sync) {
        sync.run({ only: [id], force: !!body.force }).catch((error) => console.error('[sync]', error));
      }
      sendJson(res, 200, { ok: true, source: sourceView(db.getSource(id)) });
      return;
    }
    if (pathname === '/api/open' && method === 'POST') {
      const body = await readBody(req);
      let dir = '';
      if (body.sessionId) {
        const session = db.getSession(body.sessionId);
        if (session) {
          const adapter = adapterById.get(session.source);
          const meta = {
            ...sessionView(session),
            nativeId: session.native_id,
            sourcePath: session.source_path,
          };
          dir = body.target === 'project' ? session.project_path : adapter?.sourceFolder?.(meta) || path.dirname(session.source_path || '');
        }
      } else if (body.source) {
        const adapter = adapterById.get(body.source);
        const source = db.getSource(body.source);
        dir = adapter?.sourceFolder?.({ nativeId: '', sourcePath: source?.data_path || '' }) || source?.data_path || '';
      } else if (body.path) {
        dir = body.path;
      }
      if (!dir || !openFolder(dir)) {
        sendJson(res, 400, { error: 'folder_not_found', path: dir });
        return;
      }
      sendJson(res, 200, { ok: true, path: dir });
      return;
    }
    if (pathname === '/api/shutdown' && method === 'POST') {
      sendJson(res, 200, { ok: true });
      setTimeout(() => process.exit(0), 80);
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      sendText(res, 405, 'Method not allowed');
      return;
    }
    serveStatic(req, res, pathname);
  } catch (error) {
    console.error('[agenthub]', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error', message: String(error?.message || error) });
    else res.end();
  }
});

function openBrowser(url) {
  if (!OPEN_BROWSER) return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // browser opening is best effort
  }
}

function listen(port, attempts = 8) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempts > 0) {
      listen(port + 1, attempts - 1);
    } else {
      console.error(error);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actual = typeof address === 'object' ? address.port : port;
    const url = `http://127.0.0.1:${actual}`;
    console.log('');
    console.log('  AgentHub · 智能体会话中枢');
    console.log(`  ${url}`);
    console.log(`  索引库: ${DB_FILE}`);
    console.log('');
    openBrowser(url);
    sync.initSources();
    setTimeout(() => {
      sync.run().catch((error) => console.error('[sync]', error));
    }, 250);
  });
}

const heartbeat = setInterval(() => {
  for (const client of clients) {
    try {
      client.write(': ping\n\n');
    } catch {
      clients.delete(client);
    }
  }
}, 20_000);
heartbeat.unref?.();

const autoSync = setInterval(() => {
  if (!sync.state.running) {
    sync.run().catch((error) => console.error('[auto-sync]', error));
  }
}, 60_000);
autoSync.unref?.();

process.on('SIGINT', () => {
  console.log('\n[agenthub] 正在退出…');
  process.exit(0);
});

listen(START_PORT);
