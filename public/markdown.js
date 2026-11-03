const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeUrl(url) {
  const raw = String(url || '')
    .replace(/&amp;/g, '&')
    .trim();
  if (/^(https?:\/\/|mailto:)/i.test(raw)) return escapeAttr(raw);
  return '#';
}

function inline(raw) {
  const codeTokens = [];
  let text = String(raw || '').replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codeTokens.length;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000IC${index}\u0000`;
  });

  text = escapeHtml(text);

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  text = text.replace(/(\*\*|__)([^*_]+?)\1/g, '<strong>$2</strong>');
  text = text.replace(/(^|[\s([{>])\*([^*\n]+?)\*(?=$|[\s)\]}.,!?，。！？：；、])/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');
  text = text.replace(/\n/g, '<br>');

  text = text.replace(/\u0000IC(\d+)\u0000/g, (_, index) => codeTokens[Number(index)] || '');
  return text;
}

function codeBlock(language, code) {
  const lang = String(language || '').trim().split(/\s+/)[0];
  return `<div class="code-block"><div class="code-head"><span>${escapeHtml(lang || 'code')}</span><button type="button" data-copy-code>复制</button></div><pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`;
}

function tableFrom(lines) {
  const rows = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
  if (rows.length < 2) return '';
  const header = rows[0];
  const body = rows.slice(2);
  const headHtml = header.map((cell) => `<th>${inline(cell)}</th>`).join('');
  const bodyHtml = body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

export function renderMarkdown(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!source.trim()) return '';

  const blocks = [];
  const text = source.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = blocks.length;
    blocks.push(codeBlock(lang, code));
    return `\u0000CB${index}\u0000`;
  });

  const lines = text.split('\n');
  const out = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join('\n'))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const codeMatch = trimmed.match(/^\u0000CB(\d+)\u0000$/);
    if (codeMatch) {
      flushParagraph();
      flushList();
      out.push(blocks[Number(codeMatch[1])] || '');
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(6, heading[1].length);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      out.push('<hr>');
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      i -= 1;
      out.push(`<blockquote>${inline(quote.join('\n'))}</blockquote>`);
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flushParagraph();
      flushList();
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      const table = tableFrom(tableLines);
      if (table) out.push(table);
      continue;
    }

    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /\d+\./.test(listMatch[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(listMatch[2]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return out.join('\n').replace(/\u0000CB(\d+)\u0000/g, (_, index) => blocks[Number(index)] || '');
}

export function renderPlain(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

export function highlightHtml(value, terms = []) {
  let html = escapeHtml(value);
  const clean = terms.map((term) => String(term).trim()).filter(Boolean);
  if (!clean.length) return html;
  const pattern = clean
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  try {
    html = html.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
  } catch {
    // ignore bad patterns
  }
  return html;
}
