import { escapeHtml, highlightHtml, renderMarkdown } from './markdown.js';

/* ------------------------------------------------------------------ *
 *  AgentHub front-end — local-first, no framework, no tracking.
 * ------------------------------------------------------------------ */

const ICONS = {
  grid: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.6"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.6"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.6"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.6"/>',
  chat: '<path d="M20 11.5a7.7 7.7 0 0 1-8 7.7 9 9 0 0 1-3.5-.7L4 20l1.4-4.1A7.4 7.4 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z"/>',
  folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sparkle: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9Z"/><path d="M19 16.5 19.8 19l2.5.8-2.5.8L19 23l-.8-2.4-2.5-.8 2.5-.8Z"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  message: '<path d="M4 5.5h16v10H9l-4.5 3.5v-3.5H4Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  terminal: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="m7 9 2.5 2.5L7 14M12.5 14.5H17"/>',
  brain: '<path d="M9.5 4.5a3 3 0 0 0-3 3 2.8 2.8 0 0 0-1.5 5 3 3 0 0 0 2.2 4.8 3 3 0 0 0 5.3-1.8V7.2a2.8 2.8 0 0 0-3-2.7Z"/><path d="M14.5 4.5a3 3 0 0 1 3 3 2.8 2.8 0 0 1 1.5 5 3 3 0 0 1-2.2 4.8 3 3 0 0 1-5.3-1.8"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  alert: '<path d="M12 3.5 21 20H3Z"/><path d="M12 9v4.5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  shield: '<path d="M12 3.5 20 7v5.5c0 4.6-3.3 7.4-8 8.5-4.7-1.1-8-3.9-8-8.5V7Z"/><path d="m8.5 12 2.4 2.4 4.6-5"/>',
  file: '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4"/>',
  layers: '<path d="m12 3.5 9 5-9 5-9-5Z"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5"/>',
  activity: '<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  github: '<path d="M12 2.8a9.2 9.2 0 0 0-2.9 17.9c.5.1.7-.2.7-.5v-1.8c-2.6.6-3.2-1.1-3.2-1.1-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.4-2-.2-4.2-1-4.2-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9 9 0 0 1 4.8 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.2 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.2 9.2 0 0 0 12 2.8Z"/>',
  inbox: '<path d="M4 5.5h16v13H4Z"/><path d="M4 13h4l1.5 2h5L16 13h4"/>',
  pin: '<path d="m9 4 6 6-2 1 4 4-3 1-3 3-1-4-4-4 2-1Z"/>',
};

function icon(name) {
  const body = ICONS[name] || ICONS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone) return;
    el.innerHTML = icon(el.dataset.icon);
    el.dataset.iconDone = '1';
  });
}

/* ------------------------------ state ------------------------------ */

const state = {
  data: null,
  sources: [],
  sourceMap: new Map(),
  projects: [],
  route: 'overview',
  sync: null,
  theme: localStorage.getItem('agenthub.theme') || 'system',
  sessions: {
    items: [],
    total: 0,
    offset: 0,
    loading: false,
    filters: { source: '', project: '', q: '', sort: 'updated_desc', archived: '0' },
    hasMore: false,
  },
  selected: null,
  selectedLoading: false,
  showReasoning: false,
  detailOpen: false,
  palette: {
    open: false,
    q: '',
    items: [],
    selected: 0,
    loading: false,
    emptyItems: [],
  },
  pendingSession: null,
  lastSyncDone: 0,
};

const view = document.getElementById('view');
const breadcrumb = document.getElementById('breadcrumb');
const syncText = document.getElementById('sync-text');
const syncPill = document.getElementById('sync-pill');
const quickSync = document.getElementById('quick-sync');
const railStatus = document.getElementById('rail-status');

/* ------------------------------ utils ------------------------------ */

function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function color(value) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : '#888888';
}

function fmtNum(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('zh-CN').format(number);
}

function fmtCompact(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (number >= 10_000) return `${Math.round(number / 1000)}k`;
  if (number >= 1_000) return `${(number / 1000).toFixed(1).replace('.0', '')}k`;
  return String(number);
}

function fmtBytes(bytes) {
  const number = Number(bytes) || 0;
  if (!number) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = number;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function fmtDate(ms, withTime = false) {
  if (!ms) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const options = sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('zh-CN', options);
}

function fmtTime(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return fmtDate(ms);
}

function relative(ms) {
  if (!ms) return '';
  const diff = Date.now() - Number(ms);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return fmtDate(ms);
}

function dayLabel(ms) {
  const date = new Date(ms);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((today - target) / 86_400_000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
}

function sourceInfo(id) {
  return state.sourceMap.get(id) || { id, shortName: id, name: id, color: '#888', glyph: '?' };
}

function sourceBadge(id, size = '') {
  const source = sourceInfo(id);
  return `<span class="source-badge ${size}" style="--agent:${color(source.color)}" title="${attr(source.name)}">${escapeHtml(source.glyph || '?')}</span>`;
}

function statusTag(status) {
  if (!status) return '';
  if (status === 'active') return '<span class="tag tag-green">进行中</span>';
  if (status === 'archived') return '<span class="tag">已归档</span>';
  if (status === 'error' || status === 'failed') return '<span class="tag tag-red">失败</span>';
  if (status === 'running') return '<span class="tag tag-green">运行中</span>';
  return '';
}

function toast(message, isError = false) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast${isError ? ' is-error' : ''}`;
  el.innerHTML = `${icon(isError ? 'alert' : 'check')}<span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json()).error || '';
    } catch {
      // ignore
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('agenthub.theme', theme);
  const resolved = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme;
  document.documentElement.dataset.theme = resolved;
  for (const id of ['theme-toggle', 'theme-toggle-mobile']) {
    const button = document.getElementById(id);
    if (button) button.innerHTML = resolved === 'dark' ? icon('sun') : icon('moon');
  }
}

/* ------------------------------ routing ------------------------------ */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'overview';
  const [path, query] = raw.split('?');
  return { path: path || 'overview', params: new URLSearchParams(query || '') };
}

function navigate(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  }
  const hash = `#/${path}${query.toString() ? `?${query}` : ''}`;
  if (location.hash === hash) {
    handleRoute();
  } else {
    location.hash = hash;
  }
}

function setActiveNav(path) {
  const active = path === 'sessions' || path === 'session' ? 'sessions'
    : path === 'projects' ? 'projects'
      : path === 'agents' ? 'agents'
        : path === 'settings' ? 'settings' : 'overview';
  document.querySelectorAll('.rail-link[data-route], .mobile-nav [data-route]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.route === active);
  });
}

async function handleRoute() {
  if (!state.data) return;
  const { path, params } = parseHash();
  state.route = path;
  setActiveNav(path);

  if (path === 'overview') {
    breadcrumb.textContent = '总览';
    document.title = 'AgentHub · 智能体会话中枢';
    renderOverview();
    return;
  }
  if (path === 'sessions') {
    if (params.get('source') !== null) state.sessions.filters.source = params.get('source') || '';
    if (params.get('project') !== null) state.sessions.filters.project = params.get('project') || '';
    if (params.get('q') !== null) state.sessions.filters.q = params.get('q') || '';
    if (params.get('archived') !== null) state.sessions.filters.archived = params.get('archived') || '0';
    breadcrumb.textContent = '会话库';
    document.title = '会话库 · AgentHub';
    await renderSessions();
    return;
  }
  if (path === 'projects') {
    breadcrumb.textContent = '项目';
    document.title = '项目 · AgentHub';
    await renderProjects();
    return;
  }
  if (path === 'agents') {
    breadcrumb.textContent = '智能体';
    document.title = '智能体 · AgentHub';
    await renderAgents();
    return;
  }
  if (path === 'settings') {
    breadcrumb.textContent = '设置';
    document.title = '设置 · AgentHub';
    renderSettings();
    return;
  }
  navigate('overview');
}

/* ------------------------------ sync UI ------------------------------ */

function updateSyncUI(syncState) {
  if (!syncState) return;
  state.sync = syncState;
  const running = syncState.running;
  syncPill.classList.toggle('is-busy', running);
  quickSync.classList.toggle('is-spinning', running);
  if (running) {
    if (syncState.phase === 'scanning') {
      syncText.textContent = `扫描 ${syncState.sourceName || ''}`.trim();
    } else {
      syncText.textContent = `索引 ${syncState.current}/${syncState.total}`;
    }
    railStatus.innerHTML = `<span class="status-dot"></span><span class="rail-label">同步中</span>`;
  } else {
    const errors = syncState.errors?.length || 0;
    syncText.textContent = errors ? `${errors} 个错误` : '已同步';
    railStatus.innerHTML = `<span class="status-dot"></span><span class="rail-label">${errors ? '有错误' : '本地'}</span>`;
  }
}

function connectEvents() {
  const events = new EventSource('/api/events');
  events.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === 'sync') {
      const wasRunning = state.sync?.running;
      updateSyncUI(payload.state);
      if (wasRunning && !payload.state.running) {
        state.lastSyncDone = Date.now();
        refreshAfterSync();
      }
    }
    if (payload.type === 'source') {
      const index = state.sources.findIndex((source) => source.id === payload.source.id);
      if (index >= 0) state.sources[index] = payload.source;
      else state.sources.push(payload.source);
      state.sourceMap = new Map(state.sources.map((source) => [source.id, source]));
      if (state.route === 'agents') renderAgents();
    }
  };
}

let refreshTimer = null;
function refreshAfterSync() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      const data = await api('/api/bootstrap');
      state.data = data;
      state.sources = data.sources;
      state.sourceMap = new Map(data.sources.map((source) => [source.id, source]));
      if (state.route === 'overview') renderOverview();
      if (state.route === 'sessions') await refreshSessionList();
      if (state.route === 'projects') await renderProjects();
      if (state.route === 'agents') await renderAgents();
    } catch (error) {
      console.error(error);
    }
  }, 450);
}

async function triggerSync(force = false, source = '') {
  try {
    await api('/api/sync', { method: 'POST', body: JSON.stringify({ force, source }) });
    toast('已开始同步');
  } catch (error) {
    toast(`同步失败：${error.message}`, true);
  }
}

/* ------------------------------ overview ------------------------------ */

function statDelta(activity) {
  if (!activity?.length) return 0;
  const recent = activity.slice(-7).reduce((sum, day) => sum + day.total, 0);
  const previous = activity.slice(-14, -7).reduce((sum, day) => sum + day.total, 0);
  return recent - previous;
}

function renderActivityChart(activity) {
  const days = activity || [];
  const width = 640;
  const height = 176;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 138;
  const plotWidth = width - left - right;
  const plotHeight = bottom - top;
  const max = Math.max(1, ...days.map((day) => day.total));
  const step = plotWidth / Math.max(1, days.length);
  const barWidth = Math.max(5, Math.min(16, step * 0.52));
  const sources = [...new Set(days.flatMap((day) => Object.keys(day.sources)))];
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = bottom - plotHeight * ratio;
    return `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/>`;
  }).join('');

  const bars = days.map((day, index) => {
    const x = left + index * step + (step - barWidth) / 2;
    let y = bottom;
    const segments = [];
    for (const source of sources) {
      const value = day.sources[source] || 0;
      if (!value) continue;
      const segmentHeight = (value / max) * plotHeight;
      y -= segmentHeight;
      segments.push(`<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1, segmentHeight).toFixed(1)}" rx="1.5" fill="${color(sourceInfo(source).color)}"><title>${escapeHtml(day.label)} · ${escapeHtml(sourceInfo(source).shortName)} ${value}</title></rect>`);
    }
    return segments.join('');
  }).join('');

  const labels = days.map((day, index) => {
    if (index % 4 !== 0 && index !== days.length - 1) return '';
    const x = left + index * step + step / 2;
    return `<text class="chart-label" x="${x.toFixed(1)}" y="${height - 6}" text-anchor="middle">${escapeHtml(day.label)}</text>`;
  }).join('');

  const maxLabel = `<text class="chart-total" x="${left + 18}" y="${top + 4}">${max}</text>`;
  return `<svg class="activity-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="近三周各智能体会话活跃度">${grid}${bars}${labels}${maxLabel}</svg>`;
}

function renderOverview() {
  const data = state.data;
  const stats = data.stats;
  const sources = state.sources.filter((source) => source.detected);
  const recent = stats.recent || [];
  const projects = data.projects || [];
  const delta = statDelta(stats.activity);
  const now = new Date();
  const dateLabel = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const activeSources = sources.filter((source) => source.sessionCount > 0);
  const bySource = new Map((stats.bySource || []).map((row) => [row.source, row]));

  const orbitAgents = activeSources.slice(0, 5).map((source, index) => {
    const positions = [
      { left: '2%', top: '18%' },
      { right: '0%', top: '11%' },
      { left: '-1%', bottom: '14%' },
      { right: '3%', bottom: '10%' },
      { right: '18%', bottom: '-3%' },
    ];
    const pos = positions[index] || {};
    const style = Object.entries(pos).map(([key, value]) => `${key}:${value}`).join(';');
    return `<span class="orbit-agent" style="${style}">${sourceBadge(source.id)}${escapeHtml(source.shortName)}</span>`;
  }).join('');

  view.innerHTML = `
    <div class="page overview">
      <section class="hero">
        <div class="hero-main">
          <div class="eyebrow"><span class="live-dot"></span> 本地会话中枢 · ${escapeHtml(dateLabel)}</div>
          <h1>把五个 Agent 的<br/><em>会话</em>，收进一个地方。</h1>
          <p>ChatGPT、Kimi、ZCode、OpenCode、DeepSeek Harness 的记录分散在各自的目录、JSONL 和 SQLite 里。AgentHub 在本机把它们归一成同一份索引，让历史对话、项目和上下文重新变得可找、可读、可管理。</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-action="quick-search">${icon('search')}全局搜索 <kbd>Ctrl K</kbd></button>
            <button class="btn" data-action="sync-all">${icon('refresh')}同步全部来源</button>
          </div>
          <div class="hero-note">${icon('shield')} 只读本地数据，不上传、不联网、不改写任何 Agent 的历史。</div>
        </div>
        <div class="hero-side">
          <div class="orbit">
            <div class="orbit-ring one"></div>
            <div class="orbit-ring two"></div>
            <div class="orbit-ring three"></div>
            <div class="orbit-center">${icon('layers')}</div>
            ${orbitAgents}
          </div>
          <div class="orbit-caption">${activeSources.length} 个 Agent 已接入 · ${fmtNum(stats.sessions)} 段会话</div>
        </div>
      </section>

      <section class="stat-grid">
        <article class="card stat-card" style="--stat-tint:var(--accent-soft)">
          <div class="stat-label"><span>总会话</span>${icon('chat')}</div>
          <div class="stat-value">${fmtNum(stats.sessions)}<small>段</small></div>
          <div class="stat-foot"><span class="${delta >= 0 ? 'up' : ''}">${delta >= 0 ? '+' : ''}${delta}</span> 相比前 7 天</div>
        </article>
        <article class="card stat-card" style="--stat-tint:#e8edf8">
          <div class="stat-label"><span>项目</span>${icon('folder')}</div>
          <div class="stat-value">${fmtNum(stats.projects)}<small>个</small></div>
          <div class="stat-foot">跨 Agent 合并同一工作目录</div>
        </article>
        <article class="card stat-card" style="--stat-tint:#f5ecd9">
          <div class="stat-label"><span>消息</span>${icon('message')}</div>
          <div class="stat-value">${fmtCompact(stats.messages)}<small>条</small></div>
          <div class="stat-foot">已解析的对话与工具调用</div>
        </article>
        <article class="card stat-card" style="--stat-tint:#e7f0e9">
          <div class="stat-label"><span>已接入</span>${icon('cpu')}</div>
          <div class="stat-value">${activeSources.length}<small>/ ${sources.length}</small></div>
          <div class="stat-foot">${sources.filter((source) => source.enabled).length} 个来源启用</div>
        </article>
      </section>

      <div class="dash-grid">
        <section class="panel activity-panel">
          <div class="panel-head">
            <h2>会话活跃度</h2>
            <span class="link">近 21 天 ${icon('activity')}</span>
          </div>
          <div class="legend">${sources.map((source) => `<span class="legend-item" style="--agent:${color(source.color)}"><i class="legend-dot"></i>${escapeHtml(source.shortName)}</span>`).join('')}</div>
          <div class="chart-wrap">${renderActivityChart(stats.activity)}</div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Agent 来源</h2>
            <a class="link" href="#/agents">管理 ${icon('chevron')}</a>
          </div>
          <div class="agent-list">
            ${sources.map((source) => {
              const row = bySource.get(source.id);
              return `<div class="agent-row" data-route="agents">
                ${sourceBadge(source.id)}
                <div class="agent-row-main">
                  <div class="agent-row-name">${escapeHtml(source.shortName)} ${source.enabled ? '' : '<span class="tag">停用</span>'}</div>
                  <div class="agent-row-sub">${escapeHtml(source.note || source.kind)}</div>
                </div>
                <div class="agent-row-count"><strong>${fmtNum(row?.sessions ?? source.sessionCount)}</strong><span>${row?.last_active ? relative(row.last_active) : '暂无会话'}</span></div>
                <span class="agent-row-arrow">${icon('chevron')}</span>
              </div>`;
            }).join('')}
          </div>
        </section>
      </div>

      <div class="dash-grid-2">
        <section class="panel">
          <div class="panel-head">
            <h2>最近会话</h2>
            <a class="link" href="#/sessions">查看全部 ${icon('arrow')}</a>
          </div>
          <div class="recent-list">
            ${recent.map((session) => `
              <div class="recent-row" data-action="open-recent" data-id="${attr(session.id)}">
                ${sourceBadge(session.source)}
                <div class="recent-main">
                  <div class="recent-title">${escapeHtml(session.title || '未命名会话')}</div>
                  <div class="recent-sub">${statusTag(session.status)}<span class="path">${escapeHtml(session.project_name || '未归类')}</span><span>·</span><span>${fmtNum(session.message_count)} 条</span></div>
                </div>
                <div class="recent-time">${relative(session.updated_at)}</div>
              </div>`).join('') || '<div class="empty"><div class="empty-icon">' + icon('inbox') + '</div><h3>还没有索引到会话</h3><p>点击右上角同步，或检查智能体数据目录。</p></div>'}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>项目</h2>
            <a class="link" href="#/projects">全部 ${icon('arrow')}</a>
          </div>
          <div class="project-mini-grid">
            ${projects.slice(0, 4).map((project) => `
              <div class="project-mini" data-action="open-project" data-project="${attr(project.key)}">
                <h4>${escapeHtml(project.name)}</h4>
                <div class="path">${escapeHtml(project.path)}</div>
                <div class="project-mini-foot">
                  <span>${fmtNum(project.sessionCount)} 段会话</span>
                  <span class="mini-agents">${project.sources.slice(0, 4).map((item) => sourceBadge(item.source, 'sm')).join('')}</span>
                </div>
              </div>`).join('') || '<div class="empty" style="grid-column:1/-1"><p>还没有可归并的项目。</p></div>'}
          </div>
        </section>
      </div>
    </div>`;

  hydrateIcons(view);
  wireOverview();
}

function wireOverview() {
  view.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(el.dataset.route);
    });
  });
}

/* ------------------------------ sessions ------------------------------ */

function filterSummary() {
  const filters = state.sessions.filters;
  return {
    active: !!(filters.source || filters.project || filters.q || filters.archived !== '0'),
    label: filters.q ? `搜索 “${filters.q}”` : filters.project ? '按项目筛选' : filters.source ? '按 Agent 筛选' : '全部会话',
  };
}

async function renderSessions() {
  const filters = state.sessions.filters;
  const sources = state.sources;
  const projects = state.projects.length ? state.projects : [];
  const activeSource = filters.source ? sourceInfo(filters.source) : null;
  const counts = new Map((state.data.stats.bySource || []).map((row) => [row.source, row.sessions]));

  view.innerHTML = `
    <div class="page sessions">
      <div class="page-head">
        <div>
          <div class="eyebrow">SESSION LIBRARY</div>
          <h1>会话库 <span class="count" id="session-total">${fmtNum(state.sessions.total)}</span></h1>
          <p>所有 Agent 的历史会话在这里按时间归一。点开任意一段，查看完整对话、工具调用与上下文。</p>
        </div>
        <div class="page-head-actions">
          ${activeSource ? `<span class="chip is-active" style="--agent:${color(activeSource.color)}"><span class="dot"></span>${escapeHtml(activeSource.shortName)}</span>` : ''}
          <button class="btn" data-action="sync-all">${icon('refresh')}同步</button>
          <button class="btn btn-primary" data-action="quick-search">${icon('search')}搜索</button>
        </div>
      </div>

      <div class="filterbar">
        <div class="filter-group">
          <button class="chip ${filters.source ? '' : 'is-active'}" data-filter-source="">全部 Agent</button>
          ${sources.filter((source) => source.detected).map((source) => `<button class="chip ${filters.source === source.id ? 'is-active' : ''}" data-filter-source="${attr(source.id)}" style="--agent:${color(source.color)}"><span class="dot"></span>${escapeHtml(source.shortName)}<span class="chip-count">${fmtNum(counts.get(source.id) ?? source.sessionCount)}</span></button>`).join('')}
          ${filters.project ? `<button class="chip is-active" data-clear-project>项目：${escapeHtml(projects.find((project) => project.key === filters.project)?.name || '已选')} ×</button>` : ''}
          ${filters.q ? `<button class="chip is-active" data-clear-query>搜索：${escapeHtml(filters.q)} ×</button>` : ''}
        </div>
        <div class="filter-right">
          <button class="chip ${filters.archived === 'all' ? 'is-active' : ''}" data-toggle-archived>含归档</button>
          <select class="select" id="sort-select" aria-label="排序">
            <option value="updated_desc" ${filters.sort === 'updated_desc' ? 'selected' : ''}>最近更新</option>
            <option value="created_desc" ${filters.sort === 'created_desc' ? 'selected' : ''}>最近创建</option>
            <option value="messages_desc" ${filters.sort === 'messages_desc' ? 'selected' : ''}>消息最多</option>
            <option value="updated_asc" ${filters.sort === 'updated_asc' ? 'selected' : ''}>最久未动</option>
          </select>
        </div>
      </div>

      <div class="sessions-layout">
        <section class="panel session-list-panel">
          <div class="list-toolbar">
            <span class="count">共 <strong id="list-total">${fmtNum(state.sessions.total)}</strong> 段</span>
            <span class="count" id="list-filter-label">${escapeHtml(filterSummary().label)}</span>
          </div>
          <div class="session-scroll" id="session-scroll">
            <div class="skeleton" style="height:64px;margin:8px"></div>
            <div class="skeleton" style="height:64px;margin:8px"></div>
            <div class="skeleton" style="height:64px;margin:8px"></div>
          </div>
          <div class="session-list-foot" id="session-list-foot" hidden>
            <button class="btn btn-sm" data-action="load-more">加载更多</button>
          </div>
        </section>

        <section class="panel session-detail ${state.detailOpen ? 'is-open' : ''}" id="session-detail">
          <div class="detail-empty" id="detail-empty">
            <div class="empty">
              <div class="empty-icon">${icon('chat')}</div>
              <h3>选择一段会话</h3>
              <p>左侧按时间列出所有 Agent 的历史。可以按来源筛选，也可以用全局搜索直接跳到某段对话。</p>
            </div>
          </div>
        </section>
      </div>
    </div>`;

  hydrateIcons(view);
  bindSessionEvents();
  await refreshSessionList();
  if (state.pendingSession) {
    const id = state.pendingSession;
    state.pendingSession = null;
    await openSession(id);
  }
}

async function refreshSessionList() {
  const filters = state.sessions.filters;
  const query = new URLSearchParams({
    source: filters.source,
    project: filters.project,
    q: filters.q,
    sort: filters.sort,
    archived: filters.archived,
    limit: '120',
  });
  state.sessions.loading = true;
  try {
    const result = await api(`/api/sessions?${query}`);
    state.sessions.items = result.items;
    state.sessions.total = result.total;
    state.sessions.offset = result.items.length;
    state.sessions.hasMore = result.items.length < result.total;
    const totalEl = document.getElementById('session-total');
    const listTotal = document.getElementById('list-total');
    if (totalEl) totalEl.textContent = fmtNum(result.total);
    if (listTotal) listTotal.textContent = fmtNum(result.total);
    renderSessionRows();
  } catch (error) {
    const scroll = document.getElementById('session-scroll');
    if (scroll) scroll.innerHTML = `<div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>读取会话失败</h3><p>${escapeHtml(error.message)}</p></div>`;
    toast(error.message, true);
  } finally {
    state.sessions.loading = false;
  }
}

function renderSessionRows() {
  const scroll = document.getElementById('session-scroll');
  if (!scroll) return;
  const items = state.sessions.items;
  if (!items.length) {
    scroll.innerHTML = `<div class="empty"><div class="empty-icon">${icon('inbox')}</div><h3>没有匹配的会话</h3><p>换一个 Agent、项目或搜索词试试。</p></div>`;
    const foot = document.getElementById('session-list-foot');
    if (foot) foot.hidden = true;
    return;
  }
  let lastDay = '';
  let html = '';
  for (const item of items) {
    const label = dayLabel(item.updatedAt);
    if (label !== lastDay) {
      html += `<div class="day-label">${escapeHtml(label)}</div>`;
      lastDay = label;
    }
    const active = state.selected?.id === item.id ? ' is-active' : '';
    html += `<button class="session-row${active}" data-session="${attr(item.id)}">
      ${sourceBadge(item.source)}
      <div class="session-row-main">
        <div class="session-row-top">
          <span class="session-row-title">${escapeHtml(item.title || '未命名会话')}</span>
          <span class="session-row-time">${fmtTime(item.updatedAt)}</span>
        </div>
        <div class="session-row-sub"><span>${escapeHtml(sourceInfo(item.source).shortName)}</span><span>·</span><span class="path">${escapeHtml(item.projectName || item.projectPath || '未归类')}</span><span>·</span><span>${fmtNum(item.messageCount)} 条</span>${item.model ? `<span>·</span><span>${escapeHtml(shortModel(item.model))}</span>` : ''}</div>
        ${item.snippet ? `<div class="session-row-snippet">${highlightHtml(item.snippet, state.sessions.filters.q.split(/\s+/))}</div>` : ''}
        <div class="session-row-meta">${statusTag(item.status)}${item.extra?.subagent ? '<span class="tag">子代理</span>' : ''}${item.archived ? '<span class="tag">归档</span>' : ''}${item.tokens ? `<span class="tag">${fmtCompact(item.tokens)} tokens</span>` : ''}</div>
      </div>
    </button>`;
  }
  scroll.innerHTML = html;
  scroll.querySelectorAll('[data-session]').forEach((el) => {
    el.addEventListener('click', () => openSession(el.dataset.session));
  });
  const foot = document.getElementById('session-list-foot');
  if (foot) foot.hidden = !state.sessions.hasMore;
}

async function loadMoreSessions() {
  if (state.sessions.loading || !state.sessions.hasMore) return;
  try {
    const filters = state.sessions.filters;
    const query = new URLSearchParams({
      source: filters.source,
      project: filters.project,
      q: filters.q,
      sort: filters.sort,
      archived: filters.archived,
      limit: '120',
      offset: String(state.sessions.offset),
    });
    const result = await api(`/api/sessions?${query}`);
    state.sessions.items.push(...result.items);
    state.sessions.offset += result.items.length;
    state.sessions.total = result.total;
    state.sessions.hasMore = state.sessions.items.length < result.total;
    renderSessionRows();
  } catch (error) {
    toast(error.message, true);
  }
}

function shortModel(model) {
  if (!model) return '';
  return String(model).replace(/^account:[^/]+\//, '').replace(/^[a-z0-9_-]+\s*\/\s*/i, '').slice(0, 32);
}

function bindSessionEvents() {
  view.querySelectorAll('[data-filter-source]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sessions.filters.source = el.dataset.filterSource || '';
      state.sessions.filters.q = '';
      state.detailOpen = false;
      state.selected = null;
      navigate('sessions', {
        source: state.sessions.filters.source,
        project: state.sessions.filters.project,
        archived: state.sessions.filters.archived !== '0' ? state.sessions.filters.archived : '',
      });
    });
  });
  view.querySelectorAll('[data-clear-project]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sessions.filters.project = '';
      navigate('sessions');
    });
  });
  view.querySelectorAll('[data-clear-query]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sessions.filters.q = '';
      navigate('sessions');
    });
  });
  view.querySelectorAll('[data-toggle-archived]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sessions.filters.archived = state.sessions.filters.archived === 'all' ? '0' : 'all';
      navigate('sessions', { archived: state.sessions.filters.archived === 'all' ? 'all' : '' });
    });
  });
  const sort = document.getElementById('sort-select');
  if (sort) {
    sort.addEventListener('change', () => {
      state.sessions.filters.sort = sort.value;
      refreshSessionList();
    });
  }
}

async function openSession(id) {
  state.selectedLoading = true;
  state.detailOpen = true;
  const detail = document.getElementById('session-detail');
  if (!detail) return;
  detail.classList.add('is-open');
  detail.innerHTML = `<div class="detail-empty"><div class="boot"><div class="boot-mark"></div><p>正在读取会话…</p></div></div>`;
  try {
    const data = await api(`/api/sessions/${encodeURIComponent(id)}`);
    state.selected = { ...data.session, messages: data.messages, commands: data.commands };
    state.showReasoning = false;
    renderDetail();
    document.querySelectorAll('[data-session]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.session === id);
    });
  } catch (error) {
    detail.innerHTML = `<div class="detail-empty"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h3>读取失败</h3><p>${escapeHtml(error.message)}</p></div></div>`;
    toast(error.message, true);
  } finally {
    state.selectedLoading = false;
  }
}

function renderDetail() {
  const detail = document.getElementById('session-detail');
  const session = state.selected;
  if (!detail || !session) return;
  const source = sourceInfo(session.source);
  const messages = session.messages || [];
  const visibleMessages = state.showReasoning ? messages : messages.filter((message) => message.kind !== 'reasoning');
  const textOnly = session.extra?.textOnly;

  detail.innerHTML = `
    <div class="detail-head">
      <div class="detail-topline">
        <div class="detail-source">${sourceBadge(session.source)}<span class="source-name"><strong>${escapeHtml(source.name)}</strong></span>${statusTag(session.status)}${session.archived ? '<span class="tag">归档</span>' : ''}</div>
        <button class="icon-btn detail-close" data-action="close-detail" aria-label="关闭详情">${icon('close')}</button>
      </div>
      <h2>${escapeHtml(session.title || '未命名会话')}</h2>
      <div class="detail-path">${icon('folder')}<span>${escapeHtml(session.projectPath || (session.extra?.subagent ? '子代理线程' : '未归类项目'))}</span></div>
      <div class="detail-meta">
        <span class="tag">${fmtNum(session.messageCount)} 条消息</span>
        ${session.extra?.subagent ? '<span class="tag">子代理</span>' : ''}
        ${session.model ? `<span class="tag">${escapeHtml(shortModel(session.model))}</span>` : ''}
        ${session.tokens ? `<span class="tag">${fmtCompact(session.tokens)} tokens</span>` : ''}
        ${session.cost ? `<span class="tag">$${Number(session.cost).toFixed(3)}</span>` : ''}
        <span class="tag">${escapeHtml(fmtDate(session.createdAt, true))}</span>
      </div>
      <div class="detail-actions">
        ${session.commands?.resume ? `<button class="btn btn-sm btn-soft" data-action="copy-resume">${icon('copy')}复制继续命令</button>` : `<button class="btn btn-sm" data-action="copy-id">${icon('copy')}复制会话 ID</button>`}
        <button class="btn btn-sm" data-action="open-project">${icon('external')}项目目录</button>
        <button class="btn btn-sm" data-action="open-source">${icon('database')}数据目录</button>
      </div>
    </div>
    <div class="detail-body">
      ${textOnly ? `<div class="text-note">${icon('info')}<span>ZCode 本地索引保存的是拼接后的可检索文本，没有逐条消息结构。下面的记录仍可全文搜索，但角色边界可能不完整。</span></div>` : ''}
      <div class="transcript-toolbar">
        <div class="left">${icon('message')}<span>${visibleMessages.length} 条展示 · 共 ${messages.length} 条</span></div>
        ${messages.some((message) => message.kind === 'reasoning') ? `<button class="btn btn-sm btn-quiet" data-action="toggle-reasoning">${state.showReasoning ? '隐藏思考过程' : '显示思考过程'}</button>` : ''}
      </div>
      <div class="transcript">
        ${visibleMessages.map(renderMessage).join('') || `<div class="empty transcript-empty"><div class="empty-icon">${icon('inbox')}</div><h3>这段会话没有正文</h3><p>源数据库里只有元数据。</p></div>`}
      </div>
    </div>`;
  hydrateIcons(detail);
  bindDetailEvents();
}

function renderMessage(message) {
  const role = message.role;
  if (message.kind === 'reasoning') {
    return `<div class="msg msg-reasoning">
      <div class="msg-avatar">${icon('brain')}</div>
      <div class="msg-body"><div class="msg-head"><strong>思考过程</strong><span>${fmtTime(message.createdAt)}</span></div><div class="md">${renderMarkdown(message.text)}</div></div>
    </div>`;
  }
  if (role === 'user') {
    return `<div class="msg msg-user">
      <div class="msg-avatar">你</div>
      <div class="msg-body"><div class="msg-head"><strong>你</strong><span>${fmtTime(message.createdAt)}</span></div><div class="md">${renderMarkdown(message.text)}</div></div>
    </div>`;
  }
  if (role === 'tool' || message.kind === 'tool' || message.kind === 'tool-call') {
    const size = (message.text || '').length;
    return `<div class="msg msg-tool">
      <div class="msg-avatar">${icon('terminal')}</div>
      <div class="msg-body">
        <div class="msg-head"><strong>${escapeHtml(message.toolName || 'tool')}</strong><span>${size > 1000 ? `${fmtCompact(size)} 字符` : ''}</span></div>
        <details ${size < 700 ? 'open' : ''}>
          <summary>${size < 700 ? '收起' : '展开'}输出</summary>
          <div class="tool-body"><pre>${escapeHtml(message.text || '')}</pre></div>
        </details>
      </div>
    </div>`;
  }
  if (role === 'system' || message.kind === 'note') {
    return `<div class="msg msg-system"><div class="msg-avatar"></div><div class="msg-body">${escapeHtml(message.text || '')}</div></div>`;
  }
  if (message.kind === 'log') {
    return `<div class="msg msg-log">
      <div class="msg-avatar">${sourceBadge(state.selected?.source, 'sm')}</div>
      <div class="msg-body"><div class="msg-head"><strong>执行记录</strong><span>${fmtTime(message.createdAt)}</span></div><div class="md">${renderMarkdown(message.text)}</div></div>
    </div>`;
  }
  const source = state.selected ? sourceInfo(state.selected.source) : null;
  return `<div class="msg msg-assistant">
    <div class="msg-avatar">${source ? escapeHtml(source.glyph) : 'A'}</div>
    <div class="msg-body"><div class="msg-head"><strong>${source ? escapeHtml(source.shortName) : '助手'}</strong><span>${fmtTime(message.createdAt)}</span></div><div class="md">${renderMarkdown(message.text)}</div></div>
  </div>`;
}

function bindDetailEvents() {
  const detail = document.getElementById('session-detail');
  if (!detail) return;
  detail.querySelector('[data-action="close-detail"]')?.addEventListener('click', () => {
    detail.classList.remove('is-open');
    state.detailOpen = false;
  });
  detail.querySelector('[data-action="toggle-reasoning"]')?.addEventListener('click', () => {
    state.showReasoning = !state.showReasoning;
    renderDetail();
  });
  detail.querySelector('[data-action="copy-resume"]')?.addEventListener('click', async () => {
    await copyText(state.selected?.commands?.resume || '');
  });
  detail.querySelector('[data-action="copy-id"]')?.addEventListener('click', async () => {
    await copyText(state.selected?.nativeId || state.selected?.id || '');
  });
  detail.querySelector('[data-action="open-project"]')?.addEventListener('click', () => openFolder({ sessionId: state.selected.id, target: 'project' }));
  detail.querySelector('[data-action="open-source"]')?.addEventListener('click', () => openFolder({ sessionId: state.selected.id, target: 'source' }));
  detail.querySelectorAll('[data-copy-code]').forEach((button) => {
    button.addEventListener('click', async () => {
      const code = button.closest('.code-block')?.querySelector('code')?.textContent || '';
      await copyText(code);
    });
  });
}

async function copyText(text) {
  if (!text) {
    toast('这段会话没有可复制的命令', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制到剪贴板');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast('已复制到剪贴板');
  }
}

async function openFolder({ sessionId, target, source, path }) {
  try {
    const body = sessionId ? { sessionId, target } : source ? { source } : { path };
    const result = await api('/api/open', { method: 'POST', body: JSON.stringify(body) });
    toast(result.path ? '已在资源管理器中打开' : '已打开');
  } catch (error) {
    toast(`打开失败：${error.message}`, true);
  }
}

/* ------------------------------ projects ------------------------------ */

async function renderProjects() {
  const data = await api('/api/projects');
  state.projects = data.items;
  const totalSessions = data.items.reduce((sum, project) => sum + project.sessionCount, 0);
  view.innerHTML = `
    <div class="page projects">
      <div class="page-head">
        <div>
          <div class="eyebrow">PROJECTS</div>
          <h1>项目 <span class="count">${fmtNum(data.items.length)}</span></h1>
          <p>按工作目录把不同 Agent 的会话合并在一起。同一个项目里，谁在什么时候做过什么，一眼就能看到。</p>
        </div>
        <div class="page-head-actions">
          <button class="btn" data-action="sync-all">${icon('refresh')}同步</button>
          <button class="btn btn-primary" data-action="quick-search">${icon('search')}搜索会话</button>
        </div>
      </div>
      <div class="project-toolbar">
        <span class="chip">${fmtNum(totalSessions)} 段会话 · ${fmtNum(data.items.length)} 个项目</span>
        <span class="muted" style="font-size:11px">按最近活动排序</span>
      </div>
      <div class="project-grid">
        ${data.items.map((project) => `
          <article class="card project-card" data-action="open-project" data-project="${attr(project.key)}">
            <div class="project-card-top">
              <div class="project-icon">${icon('folder')}</div>
              <span class="tag">${fmtNum(project.sessionCount)} 会话</span>
            </div>
            <h3>${escapeHtml(project.name)}</h3>
            <div class="project-path">${escapeHtml(project.path || '未归类')}</div>
            <div class="project-agents">
              ${project.sources.slice(0, 5).map((item) => `<span class="project-agent-chip">${sourceBadge(item.source, 'sm')}${escapeHtml(sourceInfo(item.source).shortName)} ${item.count}</span>`).join('')}
            </div>
            <div class="project-card-foot"><span>${fmtNum(project.messageCount)} 条消息</span><span>${relative(project.lastActive)}</span></div>
          </article>`).join('') || `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${icon('folder')}</div><h3>还没有项目</h3><p>同步后，带工作目录的会话会自动归并到这里。</p></div>`}
      </div>
    </div>`;
  hydrateIcons(view);
  view.querySelectorAll('[data-action="open-project"]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sessions.filters.project = el.dataset.project;
      state.sessions.filters.source = '';
      state.sessions.filters.q = '';
      navigate('sessions', { project: el.dataset.project });
    });
  });
}

/* ------------------------------ agents ------------------------------ */

async function renderAgents() {
  const data = await api('/api/sources');
  state.sources = data.items;
  state.sourceMap = new Map(data.items.map((source) => [source.id, source]));
  const detected = data.items.filter((source) => source.detected);
  const totalSessions = data.items.reduce((sum, source) => sum + source.sessionCount, 0);
  view.innerHTML = `
    <div class="page agents">
      <div class="page-head">
        <div>
          <div class="eyebrow">AGENTS & SOURCES</div>
          <h1>智能体 <span class="count">${detected.length}</span></h1>
          <p>每个 Agent 保留自己的数据目录和格式，AgentHub 只做只读解析。可以单独暂停来源、重新扫描，或直接打开原始目录。</p>
        </div>
        <div class="page-head-actions">
          <button class="btn" data-action="sync-all">${icon('refresh')}同步全部</button>
          <button class="btn btn-primary" data-action="quick-search">${icon('search')}搜索</button>
        </div>
      </div>
      <div class="project-toolbar">
        <span class="chip">${fmtNum(totalSessions)} 段已索引会话</span>
        <span class="muted" style="font-size:11px">数据只在本机读取；停用来源不会删除原始记录</span>
      </div>
      <div class="agent-grid">
        ${data.items.map((source) => `
          <article class="card agent-card ${source.enabled ? '' : 'is-disabled'}" style="--agent:${color(source.color)}">
            <div class="agent-head">
              <div class="agent-identity">
                ${sourceBadge(source.id, 'lg')}
                <div>
                  <h3>${escapeHtml(source.name)}</h3>
                  <div class="agent-kind">${escapeHtml(source.kind || 'local')}${source.detected ? '' : ' · 未检测到'}</div>
                </div>
              </div>
              <button class="switch ${source.enabled ? 'is-on' : ''}" data-action="toggle-source" data-source="${attr(source.id)}" aria-label="${source.enabled ? '停用' : '启用'} ${attr(source.name)}" ${source.detected ? '' : 'disabled'}></button>
            </div>
            <p class="agent-desc">${escapeHtml(source.note || '')}</p>
            <div class="agent-stats">
              <div class="agent-stat"><strong>${fmtNum(source.sessionCount)}</strong><span>会话</span></div>
              <div class="agent-stat"><strong>${fmtCompact(source.messageCount)}</strong><span>消息</span></div>
              <div class="agent-stat"><strong>${source.lastScan ? relative(source.lastScan) : '—'}</strong><span>最近扫描</span></div>
            </div>
            <div class="agent-path">${icon('database')}<span title="${attr(source.dataPath)}">${escapeHtml(source.dataPath || '未找到数据目录')}</span></div>
            ${source.error ? `<div class="agent-error">${escapeHtml(source.error)}</div>` : ''}
            <div class="agent-actions">
              <button class="btn btn-sm" data-action="rescan-source" data-source="${attr(source.id)}">${icon('refresh')}重新扫描</button>
              <button class="btn btn-sm" data-action="open-source" data-source="${attr(source.id)}">${icon('external')}打开目录</button>
              ${source.id === 'codex' ? '<span class="tag">codex resume</span>' : ''}
              ${source.id === 'kimi' ? '<span class="tag">kimi -S</span>' : ''}
              ${source.id === 'opencode' ? '<span class="tag">opencode --session</span>' : ''}
            </div>
          </article>`).join('')}
      </div>
    </div>`;
  hydrateIcons(view);
  view.querySelectorAll('[data-action="toggle-source"]').forEach((el) => {
    el.addEventListener('click', async () => {
      const source = state.sourceMap.get(el.dataset.source);
      if (!source) return;
      try {
        await api(`/api/sources/${encodeURIComponent(source.id)}`, {
          method: 'POST',
          body: JSON.stringify({ enabled: !source.enabled, sync: !source.enabled }),
        });
        toast(source.enabled ? '已停用该来源' : '已启用，正在同步');
        await renderAgents();
      } catch (error) {
        toast(error.message, true);
      }
    });
  });
  view.querySelectorAll('[data-action="rescan-source"]').forEach((el) => {
    el.addEventListener('click', () => triggerSync(false, el.dataset.source));
  });
  view.querySelectorAll('[data-action="open-source"]').forEach((el) => {
    el.addEventListener('click', () => openFolder({ source: el.dataset.source }));
  });
}

/* ------------------------------ settings ------------------------------ */

function renderSettings() {
  const app = state.data.app;
  const stats = state.data.stats;
  const sync = state.data.sync || {};
  const sources = state.sources;
  view.innerHTML = `
    <div class="page settings">
      <div class="page-head">
        <div>
          <div class="eyebrow">SETTINGS</div>
          <h1>设置 <span class="count">本地优先</span></h1>
          <p>AgentHub 是一台本地只读聚合器。它不会上传会话，也不会向任何 Agent 的历史写入内容。</p>
        </div>
        <div class="page-head-actions">
          <button class="btn" data-action="open-data-dir">${icon('folder')}数据目录</button>
          <button class="btn btn-primary" data-action="sync-all">${icon('refresh')}立即同步</button>
        </div>
      </div>
      <div class="settings-grid">
        <div class="settings-stack">
          <section class="panel settings-section">
            <h2>外观</h2>
            <p>跟随系统，或固定主题。</p>
            <div class="setting-row">
              <div><strong>主题</strong><span>当前：${state.theme === 'system' ? '跟随系统' : state.theme === 'dark' ? '深色' : '浅色'}</span></div>
              <div class="filter-group">
                <button class="chip ${state.theme === 'light' ? 'is-active' : ''}" data-theme-choice="light">浅色</button>
                <button class="chip ${state.theme === 'dark' ? 'is-active' : ''}" data-theme-choice="dark">深色</button>
                <button class="chip ${state.theme === 'system' ? 'is-active' : ''}" data-theme-choice="system">系统</button>
              </div>
            </div>
            <div class="setting-row">
              <div><strong>自动同步</strong><span>每 60 秒扫描一次有变化的会话</span></div>
              <span class="tag tag-green">运行中</span>
            </div>
          </section>

          <section class="panel settings-section">
            <h2>索引</h2>
            <p>索引只保存归一化后的文本与元数据，原文件保持不变。重建会清空本地索引并重新解析所有来源。</p>
            <div class="setting-row">
              <div><strong>索引库</strong><span>${fmtNum(stats.sessions)} 段会话 · ${fmtNum(stats.messages)} 条消息</span></div>
              <button class="btn btn-sm" data-action="reindex">${icon('refresh')}重建索引</button>
            </div>
            <div class="setting-row">
              <div><strong>最近同步</strong><span>${sync.finishedAt ? fmtDate(sync.finishedAt, true) : '尚未运行'}</span></div>
              <button class="btn btn-sm" data-action="force-sync">强制重扫</button>
            </div>
            <div class="setting-row">
              <div><strong>索引文件</strong><span>${escapeHtml(app.dbFile)}</span></div>
              <button class="btn btn-sm" data-action="open-data-dir">${icon('external')}打开</button>
            </div>
          </section>

          <section class="panel settings-section">
            <h2>数据源</h2>
            <p>每个来源独立解析，不修改原始文件。停用来源仅停止扫描，不删除历史。</p>
            ${sources.map((source) => `<div class="setting-row">
              <div><strong>${escapeHtml(source.name)}</strong><span>${fmtNum(source.sessionCount)} 段 · ${escapeHtml(source.dataPath || '未检测到')}</span></div>
              <span class="tag ${source.detected ? 'tag-green' : ''}">${source.detected ? '已检测' : '未安装'}</span>
            </div>`).join('')}
          </section>

          <section class="panel settings-section">
            <h2>快捷键</h2>
            <div class="kbd-list">
              <div class="kbd-row"><span>全局搜索</span><span><kbd>Ctrl</kbd><kbd>K</kbd></span></div>
              <div class="kbd-row"><span>关闭搜索 / 详情</span><span><kbd>Esc</kbd></span></div>
              <div class="kbd-row"><span>搜索结果上下选择</span><span><kbd>↑</kbd><kbd>↓</kbd></span></div>
              <div class="kbd-row"><span>打开选中结果</span><span><kbd>Enter</kbd></span></div>
            </div>
          </section>
        </div>

        <div class="settings-stack">
          <section class="panel settings-section">
            <div class="about-box">
              <span class="brand-mark">${icon('layers')}</span>
              <div><h3>AgentHub <span class="muted" style="font-weight:400;font-size:11px">v${escapeHtml(app.version)}</span></h3><p>一个本地的会话聚合与 Agent 管理面板。</p></div>
            </div>
            <p>所有解析都在本机完成，服务只监听 127.0.0.1。没有账号、没有遥测、没有云端索引。</p>
            <div class="mono-block" style="margin-top:12px">${escapeHtml(app.root)}</div>
          </section>

          <section class="panel settings-section">
            <h2>隐私边界</h2>
            <p>AgentHub 只读取各 Agent 自己写在本机的会话文件。它不会调用模型 API，不会把会话发送到网络；本项目也不包含任何会话数据或本地路径配置。</p>
            <div class="setting-row"><div><strong>只读</strong><span>不修改源文件</span></div><span class="tag tag-green">开启</span></div>
            <div class="setting-row"><div><strong>网络</strong><span>仅本机回环地址</span></div><span class="tag tag-green">离线</span></div>
            <div class="setting-row"><div><strong>遥测</strong><span>无</span></div><span class="tag">0</span></div>
          </section>

          <section class="panel settings-section">
            <h2>参考与致谢</h2>
            <p>同类项目提供了很好的产品参照；AgentHub 选择无框架、无依赖的本地 Web 形态，便于审计与扩展。</p>
            <div class="ref-list">
              <a class="ref-link" href="https://github.com/Atituiset/agent-viewer" target="_blank" rel="noopener noreferrer">Agent Viewer <span>Electron · 多端会话浏览 ${icon('external')}</span></a>
              <a class="ref-link" href="https://github.com/egroup-labs/kept" target="_blank" rel="noopener noreferrer">kept <span>ChatGPT / Claude / Kimi 本地归档 ${icon('external')}</span></a>
              <a class="ref-link" href="https://github.com/userFRM/llm-deep-trace" target="_blank" rel="noopener noreferrer">llm-deep-trace <span>编码 Agent 会话浏览器 ${icon('external')}</span></a>
            </div>
          </section>

          <section class="panel settings-section">
            <h2>关于数据格式</h2>
            <p>ChatGPT 读取 Codex 的 SQLite 线程库；Kimi 读取 wire 事件；ZCode 读取任务索引；OpenCode 读取 opencode.db；DSH 读取压缩的 v4 事件流。不同来源的字段会归一成统一的消息模型。</p>
          </section>
        </div>
      </div>
    </div>`;
  hydrateIcons(view);
  view.querySelectorAll('[data-theme-choice]').forEach((el) => {
    el.addEventListener('click', () => {
      setTheme(el.dataset.themeChoice);
      renderSettings();
    });
  });
}

/* ------------------------------ palette ------------------------------ */

function renderPalette() {
  const root = document.getElementById('modal-root');
  if (!state.palette.open) {
    root.innerHTML = '';
    return;
  }
  const items = state.palette.q ? state.palette.items : state.palette.emptyItems;
  root.innerHTML = `
    <div class="palette-backdrop" data-action="close-palette">
      <div class="palette" role="dialog" aria-modal="true" aria-label="全局搜索">
        <div class="palette-input">
          ${icon('search')}
          <input id="palette-input" type="text" placeholder="搜索所有会话、项目、代码片段…" value="${attr(state.palette.q)}" autocomplete="off" spellcheck="false" />
          <kbd>Esc</kbd>
        </div>
        <div class="palette-body" id="palette-body">
          ${state.palette.loading ? '<div class="palette-empty"><div class="palette-spinner" style="margin:0 auto 10px"></div>正在搜索…</div>' : ''}
          ${!state.palette.loading ? renderPaletteItems(items) : ''}
        </div>
        <div class="palette-nav"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span><span style="margin-left:auto">${state.palette.q ? '搜索本地索引' : '最近会话'}</span></div>
      </div>
    </div>`;
  hydrateIcons(root);
  const input = document.getElementById('palette-input');
  input?.focus();
  input?.addEventListener('input', () => {
    state.palette.q = input.value;
    state.palette.selected = 0;
    schedulePaletteSearch();
    renderPalette();
    const next = document.getElementById('palette-input');
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  });
  root.querySelector('.palette-backdrop')?.addEventListener('mousedown', (event) => {
    if (event.target === event.currentTarget) closePalette();
  });
  root.querySelectorAll('[data-palette-index]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      state.palette.selected = Number(el.dataset.paletteIndex);
      root.querySelectorAll('[data-palette-index]').forEach((node) => node.classList.toggle('is-selected', node === el));
    });
    el.addEventListener('click', () => activatePaletteItem(Number(el.dataset.paletteIndex)));
  });
}

function renderPaletteItems(items) {
  if (!items.length) {
    return `<div class="palette-empty">${state.palette.q ? '没有找到匹配的会话。' : '还没有最近会话。'}</div>`;
  }
  const terms = state.palette.q.split(/\s+/).filter(Boolean);
  return items.map((item, index) => `
    <button class="palette-result ${index === state.palette.selected ? 'is-selected' : ''}" data-palette-index="${index}">
      ${sourceBadge(item.source)}
      <div class="palette-result-main">
        <div class="palette-result-title">${highlightHtml(item.title || '未命名会话', terms)}</div>
        <div class="palette-result-sub"><span>${escapeHtml(sourceInfo(item.source).shortName)}</span><span>·</span><span class="path">${escapeHtml(item.projectName || item.projectPath || '未归类')}</span><span>·</span><span>${relative(item.updatedAt)}</span></div>
        ${item.snippet ? `<div class="palette-result-snippet">${highlightHtml(item.snippet, terms)}</div>` : ''}
      </div>
    </button>`).join('');
}

let paletteTimer = null;
function schedulePaletteSearch() {
  clearTimeout(paletteTimer);
  paletteTimer = setTimeout(async () => {
    if (!state.palette.q.trim()) {
      state.palette.items = [];
      state.palette.loading = false;
      renderPalette();
      return;
    }
    state.palette.loading = true;
    renderPalette();
    try {
      const result = await api(`/api/sessions?q=${encodeURIComponent(state.palette.q)}&limit=12`);
      state.palette.items = result.items;
      state.palette.selected = 0;
    } catch (error) {
      state.palette.items = [];
      toast(error.message, true);
    } finally {
      state.palette.loading = false;
      renderPalette();
      const input = document.getElementById('palette-input');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, 180);
}

function openPalette() {
  state.palette.open = true;
  state.palette.q = '';
  state.palette.items = [];
  state.palette.selected = 0;
  state.palette.emptyItems = (state.data?.stats?.recent || []).map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    projectName: row.project_name,
    projectPath: row.project_path,
    updatedAt: row.updated_at,
    snippet: '',
  }));
  renderPalette();
}

function closePalette() {
  state.palette.open = false;
  renderPalette();
}

function activatePaletteItem(index) {
  const items = state.palette.q ? state.palette.items : state.palette.emptyItems;
  const item = items[index];
  if (!item) return;
  closePalette();
  state.pendingSession = item.id;
  state.sessions.filters = { source: '', project: '', q: '', sort: 'updated_desc', archived: '0' };
  navigate('sessions');
}

/* ------------------------------ global events ------------------------------ */

function bindGlobalEvents() {
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const resolved = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(resolved);
    if (state.route === 'settings') renderSettings();
  });
  document.getElementById('theme-toggle-mobile')?.addEventListener('click', () => {
    const resolved = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(resolved);
    if (state.route === 'settings') renderSettings();
  });
  document.getElementById('search-trigger')?.addEventListener('click', openPalette);
  document.getElementById('quick-sync')?.addEventListener('click', () => triggerSync());
  syncPill?.addEventListener('click', () => navigate('agents'));

  document.querySelectorAll('[data-route]').forEach((el) => {
    if (el.closest('#view')) return;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      if (el.dataset.route === 'search') {
        openPalette();
        return;
      }
      navigate(el.dataset.route);
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'quick-search') {
      event.preventDefault();
      openPalette();
    }
    if (action === 'sync-all') {
      event.preventDefault();
      triggerSync();
    }
    if (action === 'open-recent') {
      event.preventDefault();
      state.pendingSession = target.dataset.id;
      state.sessions.filters = { source: '', project: '', q: '', sort: 'updated_desc', archived: '0' };
      navigate('sessions');
    }
    if (action === 'open-project') {
      event.preventDefault();
      state.sessions.filters.project = target.dataset.project;
      state.sessions.filters.source = '';
      state.sessions.filters.q = '';
      navigate('sessions', { project: target.dataset.project });
    }
    if (action === 'load-more') {
      event.preventDefault();
      loadMoreSessions();
    }
    if (action === 'force-sync') {
      event.preventDefault();
      triggerSync(true);
    }
    if (action === 'open-data-dir') {
      event.preventDefault();
      openFolder({ path: state.data.app.dataDir || `${state.data.app.root}\\data` });
    }
    if (action === 'reindex') {
      event.preventDefault();
      if (!window.confirm('重建索引会清空当前本地索引并重新解析全部来源，确定继续？')) return;
      fetch('/api/reindex', { method: 'POST' }).then(() => toast('已开始重建索引')).catch((error) => toast(error.message, true));
    }
    if (action === 'close-palette') {
      event.preventDefault();
      closePalette();
    }
  });

  document.addEventListener('keydown', (event) => {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (state.palette.open) closePalette();
      else openPalette();
      return;
    }
    if (event.key === 'Escape') {
      if (state.palette.open) {
        event.preventDefault();
        closePalette();
      } else if (state.detailOpen && window.innerWidth <= 860) {
        document.getElementById('session-detail')?.classList.remove('is-open');
        state.detailOpen = false;
      }
      return;
    }
    if (!state.palette.open) return;
    const items = state.palette.q ? state.palette.items : state.palette.emptyItems;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.palette.selected = Math.min(items.length - 1, state.palette.selected + 1);
      renderPalette();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.palette.selected = Math.max(0, state.palette.selected - 1);
      renderPalette();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (items.length) activatePaletteItem(state.palette.selected);
      else {
        const q = state.palette.q.trim();
        if (q) {
          closePalette();
          navigate('sessions', { q });
        }
      }
    }
  });
}

/* ------------------------------ boot ------------------------------ */

async function boot() {
  setTheme(state.theme);
  hydrateIcons(document);
  bindGlobalEvents();
  connectEvents();
  try {
    const data = await api('/api/bootstrap');
    state.data = data;
    state.sources = data.sources;
    state.sourceMap = new Map(data.sources.map((source) => [source.id, source]));
    state.projects = data.projects;
    updateSyncUI(data.sync);
    window.addEventListener('hashchange', handleRoute);
    if (!location.hash) history.replaceState(null, '', '#/overview');
    await handleRoute();
  } catch (error) {
    view.innerHTML = `<div class="boot-error"><h2>无法启动 AgentHub</h2><p>${escapeHtml(error.message)}</p><button class="btn" onclick="location.reload()">重试</button></div>`;
  }
}

boot();
