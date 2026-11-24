export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const p2 = (n: number) => String(n).padStart(2, '0');

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export const todayStr = () => dateStr(new Date());

/** 'YYYY-MM-DD' → 本地 Date（正午，避開夏令時間邊界） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
export const monthOf = (s: string) => s.slice(0, 7);
export const yearOf = (s: string) => s.slice(0, 4);

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
export function monthRange(ym: string): [string, string] {
  return [`${ym}-01`, `${ym}-31`];
}
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return dateStr(d) === s;
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const weekday = (s: string) => '週' + WEEK[parseDate(s).getDay()];

export function stamp(d = new Date()): string {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
}
export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${dateStr(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** 去掉開頭的 emoji / 符號 / 空白（含 U+FE0F） */
export function stripLeadingEmoji(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}
