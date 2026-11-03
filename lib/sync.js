import {
  hash,
  safeJson,
  statSafe,
  stableSessionId,
} from './util.js';
import { adapterById, adapters } from './adapters/index.js';

const INDEX_VERSION = 1;

function messageSignature(messages) {
  return hash(
    (messages || [])
      .map((message) => [
        message.role || '',
        message.kind || '',
        message.toolName || message.tool_name || '',
        message.text || '',
      ].join('\u0001'))
      .join('\u0000'),
    20,
  );
}

function sourcePrimaryPath(adapter) {
  const paths = adapter.dataPaths || adapter.roots || [];
  for (const p of paths) {
    if (statSafe(p)) return p;
  }
  return paths[0] || '';
}

function mergePatch(meta, patch) {
  if (!patch) return meta;
  const out = { ...meta };
  for (const key of ['title', 'model', 'status', 'tokens', 'cost', 'updatedAt', 'projectPath', 'projectName']) {
    if (patch[key] !== undefined && patch[key] !== null && patch[key] !== '') out[key] = patch[key];
  }
  return out;
}

export class SyncManager {
  constructor(db, broadcast) {
    this.db = db;
    this.broadcast = broadcast || (() => {});
    this.state = {
      running: false,
      phase: 'idle',
      source: null,
      sourceName: '',
      current: 0,
      total: 0,
      indexed: 0,
      skipped: 0,
      errors: [],
      startedAt: 0,
      finishedAt: 0,
      lastSync: Number(db.getMeta('last_sync')) || 0,
    };
    this._lastEmit = 0;
    this._syncingSessions = new Set();
  }

  initSources() {
    for (const adapter of adapters) {
      const existing = this.db.getSource(adapter.id);
      this.db.upsertSource({
        id: adapter.id,
        name: adapter.name,
        shortName: adapter.shortName,
        color: adapter.color,
        glyph: adapter.glyph,
        kind: adapter.kind,
        dataPath: sourcePrimaryPath(adapter),
        detected: adapter.detect(),
        enabled: existing?.enabled !== 0,
        note: adapter.description,
        meta: { ...(adapter.meta?.() || {}), roots: adapter.roots || [] },
      });
    }
  }

  snapshot() {
    return { ...this.state, errors: [...this.state.errors] };
  }

  emit(force = false) {
    const now = Date.now();
    if (!force && now - this._lastEmit < 120) return;
    this._lastEmit = now;
    this.broadcast({ type: 'sync', state: this.snapshot() });
  }

  async run({ force = false, only = null } = {}) {
    if (this.state.running) return this.snapshot();
    this.initSources();
    const targets = adapters.filter((adapter) => {
      if (only && !only.includes(adapter.id)) return false;
      const source = this.db.getSource(adapter.id);
      return source?.detected && source?.enabled;
    });
    if (!targets.length) {
      this.state.lastSync = Date.now();
      this.state.phase = 'idle';
      this.emit(true);
      return this.snapshot();
    }

    this.state = {
      ...this.state,
      running: true,
      phase: 'scanning',
      startedAt: Date.now(),
      finishedAt: 0,
      current: 0,
      total: 0,
      indexed: 0,
      skipped: 0,
      errors: [],
      source: null,
      sourceName: '',
    };
    this.emit(true);

    for (let i = 0; i < targets.length; i += 1) {
      const adapter = targets[i];
      const source = this.db.getSource(adapter.id);
      if (!source || !source.enabled || !source.detected) continue;
      this.state.source = adapter.id;
      this.state.sourceName = adapter.shortName || adapter.name;
      this.state.phase = 'scanning';
      this.state.current = 0;
      this.state.total = 0;
      this.emit(true);

      let metas = [];
      try {
        metas = await adapter.scan();
      } catch (error) {
        this.state.errors.push({ source: adapter.id, message: String(error?.message || error) });
        this.db.setSourceScan(adapter.id, { error: String(error?.message || error) });
        this.emit(true);
        continue;
      }

      this.state.total = metas.length;
      this.state.phase = 'indexing';
      this.emit(true);
      const seenAt = Date.now();
      let sourceIndexed = 0;
      let sourceSkipped = 0;

      for (let j = 0; j < metas.length; j += 1) {
        const originalMeta = metas[j];
        const meta = {
          ...originalMeta,
          id: stableSessionId(adapter.id, originalMeta.nativeId),
          source: adapter.id,
          parentId: originalMeta.parentNativeId ? stableSessionId(adapter.id, originalMeta.parentNativeId) : '',
          fingerprint: `v${INDEX_VERSION}:${originalMeta.fingerprint || ''}`,
        };
        this.state.current = j + 1;
        try {
          const existing = this.db.existingSession(adapter.id, meta.nativeId);
          this.db.upsertSessionMeta(meta, seenAt);
          const changed = force || !existing || existing.fingerprint !== meta.fingerprint;
          if (changed) {
            const loaded = await adapter.load(meta);
            const patched = mergePatch(meta, loaded.metaPatch);
            const messages = Array.isArray(loaded.messages) ? loaded.messages : [];
            const searchText = loaded.searchText || [
              patched.title,
              ...messages.filter((m) => m.role === 'user' || m.kind === 'text').map((m) => m.text),
            ].join('\n');
            this.db.transaction(() => {
              this.db.upsertSessionMeta(patched, seenAt);
              const count = this.db.saveMessages(meta.id, messages);
              this.db.markIndexed(meta.id, meta.fingerprint, searchText, count);
            });
            sourceIndexed += 1;
            this.state.indexed += 1;
          } else {
            sourceSkipped += 1;
            this.state.skipped += 1;
          }
        } catch (error) {
          this.state.errors.push({
            source: adapter.id,
            session: meta.nativeId,
            message: String(error?.message || error),
          });
        }
        if (j % 3 === 0 || j === metas.length - 1) this.emit();
        if (j % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      }

      const removed = this.db.deleteStaleSessions(adapter.id, seenAt);
      this.db.updateSourceStats(adapter.id);
      this.db.setSourceScan(adapter.id, { error: null });
      this.state.phase = 'source-done';
      this.state.sourceName = `${adapter.shortName || adapter.name}${removed ? ` · 清理 ${removed}` : ''}`;
      this.emit(true);
      await new Promise((resolve) => setImmediate(resolve));
    }

    this.state.running = false;
    this.state.phase = 'done';
    this.state.source = null;
    this.state.sourceName = '';
    this.state.current = this.state.total;
    this.state.finishedAt = Date.now();
    this.state.lastSync = this.state.finishedAt;
    this.db.setMeta('last_sync', this.state.lastSync);
    this.emit(true);
    return this.snapshot();
  }

  async syncSession(id) {
    if (this._syncingSessions.has(id)) return { changed: false, busy: true };
    const row = this.db.getSession(id);
    if (!row) return { changed: false, missing: true };
    const adapter = adapterById.get(row.source);
    if (!adapter) return { changed: false, missing: true };
    this._syncingSessions.add(id);
    try {
      const meta = {
        id: row.id,
        source: row.source,
        nativeId: row.native_id,
        title: row.title,
        projectPath: row.project_path,
        projectName: row.project_name,
        model: row.model,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sourcePath: row.source_path,
        archived: !!row.archived,
        tokens: row.tokens,
        cost: row.cost,
        bytes: row.bytes,
        parentId: row.parent_id || '',
        parentNativeId: row.parent_native_id || '',
        extra: safeJson(row.extra_json, {}) || {},
      };
      const loaded = await adapter.load(meta);
      const messages = Array.isArray(loaded.messages) ? loaded.messages : [];
      if (!messages.length && row.message_count > 0) return { changed: false };
      const searchText = loaded.searchText || [
        meta.title,
        ...messages.filter((message) => message.role === 'user' || message.kind === 'text').map((message) => message.text),
      ].join('\n');
      const oldSignature = messageSignature(row.messages);
      const newSignature = messageSignature(messages);
      if (newSignature === oldSignature && messages.length === row.message_count && searchText.slice(0, 350_000) === (row.search_text || '')) {
        return { changed: false, session: row };
      }
      const patched = mergePatch(meta, loaded.metaPatch);
      patched.updatedAt = Date.now();
      this.db.transaction(() => {
        this.db.upsertSessionMeta(patched, Date.now());
        const count = this.db.saveMessages(id, messages);
        this.db.markIndexed(id, row.fingerprint, searchText, count, Date.now());
      });
      return { changed: true, session: this.db.getSession(id) };
    } catch (error) {
      return { changed: false, error: String(error?.message || error) };
    } finally {
      this._syncingSessions.delete(id);
    }
  }

  async reindexAll() {
    const sources = this.db.getSources();
    for (const source of sources) {
      if (!source.detected) continue;
      const adapter = adapterById.get(source.id);
      if (!adapter) continue;
      this.db.raw.exec('DELETE FROM messages');
      this.db.raw.exec('DELETE FROM sessions');
      break;
    }
    return this.run({ force: true });
  }
}

export { INDEX_VERSION };
