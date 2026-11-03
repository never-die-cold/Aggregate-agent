import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function openReadOnly(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return new DatabaseSync(file, { readOnly: true });
  } catch {
    return null;
  }
}

export function readLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim());
  } catch {
    return [];
  }
}

export function textFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        return part.text ?? part.content ?? part.value ?? '';
      })
      .filter((part) => typeof part === 'string' && part.trim())
      .join('\n');
  }
  if (typeof content === 'object') return content.text ?? content.content ?? '';
  return '';
}

export function compactJson(value, max = 2400) {
  if (value === null || value === undefined) return '';
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text.length > max) text = text.slice(0, max) + `\n… [已截断 ${text.length - max} 字符]`;
  return text;
}
