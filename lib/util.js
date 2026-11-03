import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const IS_WIN = process.platform === 'win32';
export const HOME = os.homedir();

export function envPath(name, fallback = '') {
  return process.env[name] || fallback;
}

export function normalizePath(value) {
  if (!value) return '';
  let p = String(value).trim();
  if (!p) return '';
  if (p.startsWith('\\\\?\\')) p = p.slice(4);
  if (p.startsWith('//?/')) p = p.slice(4);
  p = p.replace(/^file:\/+/, '');
  p = p.replace(/\//g, path.sep);
  if (IS_WIN && /^[a-zA-Z]:$/.test(p)) p += '\\';
  try {
    p = path.normalize(p);
  } catch {
    // keep the original string
  }
  if (p.length > 3 && p.endsWith(path.sep)) p = p.slice(0, -1);
  return p;
}

export function projectKey(value) {
  const p = normalizePath(value);
  if (!p) return '';
  return p.toLowerCase().replace(/[\\/]+/g, '/');
}

export function displayPath(value) {
  const p = normalizePath(value);
  if (!p) return '';
  return IS_WIN ? p.replace(/\//g, '\\') : p;
}

export function baseName(value) {
  const p = normalizePath(value);
  if (!p) return '';
  const b = path.basename(p);
  return b || p;
}

export function toMs(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return 0;
    if (value < 1e11) return Math.round(value * 1000);
    return Math.round(value);
  }
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n < 1e11) return Math.round(n * 1000);
    return Math.round(n);
  }
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanText(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return s.trim();
}

export function collapse(value) {
  return cleanText(value).replace(/\s+/g, ' ').trim();
}

export function cleanTitle(value, fallback = '未命名会话') {
  let raw = cleanText(value);
  if (!raw) return fallback;
  const request = raw.match(/##\s*My request:\s*([\s\S]+)/i);
  if (request) raw = request[1];
  raw = raw.replace(/^#+\s*/, '');
  raw = raw.replace(/^Files mentioned by the user:[\s\S]*?(?=\n\n|$)/i, '');
  raw = raw.replace(/^Distinguish instructions in attached documents[\s\S]*?(?=\n\n|$)/i, '');
  raw = collapse(raw);
  if (!raw) return fallback;
  if (/^(new session|untitled|新会话)\b/i.test(raw)) {
    raw = fallback;
  }
  if (raw.length > 96) raw = raw.slice(0, 94).replace(/[\s,，。;；:：-]+$/, '') + '…';
  return raw;
}

export function truncate(value, max = 4000) {
  const s = typeof value === 'string' ? value : String(value ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n… [已截断 ${s.length - max} 字符]`;
}

export function truncateMiddle(value, max = 160) {
  const s = collapse(value);
  if (s.length <= max) return s;
  const head = Math.ceil((max - 1) * 0.65);
  return s.slice(0, head) + '…' + s.slice(s.length - (max - 1 - head));
}

export function safeJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function json(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

export function hash(value, size = 12) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, size);
}

export function stableSessionId(source, nativeId) {
  return `${source}:${nativeId}`;
}

export function statSafe(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

export function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function walkFiles(root, options = {}) {
  const { filter = () => true, maxFiles = 20000, maxDepth = 12 } = options;
  const out = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length && out.length < maxFiles) {
    const { dir, depth } = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile() && filter(full, entry)) {
        out.push(full);
      }
    }
  }
  return out;
}

export function fileSize(file) {
  const st = statSafe(file);
  return st?.isFile() ? st.size : 0;
}

export function sumSizes(files) {
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    if (!file || seen.has(file)) continue;
    seen.add(file);
    total += fileSize(file);
  }
  return total;
}

export function splitTerms(query) {
  return String(query || '')
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function makeSnippet(text, terms, max = 260) {
  const source = collapse(text);
  if (!source) return '';
  const lower = source.toLowerCase();
  let index = -1;
  for (const term of terms) {
    const i = lower.indexOf(String(term).toLowerCase());
    if (i >= 0 && (index < 0 || i < index)) index = i;
  }
  if (index < 0) return source.slice(0, max) + (source.length > max ? '…' : '');
  const half = Math.floor(max / 2);
  let start = Math.max(0, index - half);
  if (start > 0) {
    const space = source.lastIndexOf(' ', start);
    if (space > start - 40 && space > 0) start = space + 1;
  }
  let out = source.slice(start, start + max);
  if (start > 0) out = '…' + out;
  if (start + max < source.length) out += '…';
  return out;
}

export function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  const h = String(haystack).toLowerCase();
  const n = String(needle).toLowerCase();
  let count = 0;
  let from = 0;
  while (count < 50) {
    const i = h.indexOf(n, from);
    if (i < 0) break;
    count += 1;
    from = i + n.length;
  }
  return count;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function pick(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

export function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function daysAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}
