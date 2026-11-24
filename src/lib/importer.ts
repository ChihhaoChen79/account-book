import { unzipSync, strFromU8 } from 'fflate';
import { parseCsv } from './csv';
import { isValidDate, stripLeadingEmoji } from './format';

export interface RawRow { date: string; amount: number; srcCategory: string; note: string; source: string }
export interface SkippedRow { source: string; line: number; raw: string; reason: string }

export interface ParseResult { rows: RawRow[]; skipped: SkippedRow[]; files: string[] }

/** 一個 CSV 的文字 → 列。標題列、空白列自動跳過。 */
export function parseExpenseCsv(text: string, source: string): { rows: RawRow[]; skipped: SkippedRow[] } {
  const rows: RawRow[] = [];
  const skipped: SkippedRow[] = [];
  parseCsv(text).forEach((r, idx) => {
    const line = idx + 1;
    const cells = r.map((c) => c.trim());
    if (cells.every((c) => c === '')) return; // 空白列
    if (cells[0] === '日期') return; // 標題列
    const [date, amt, cat, ...rest] = cells;
    const raw = r.join(',');
    if (!isValidDate(date ?? '')) return void skipped.push({ source, line, raw, reason: '日期無效' });
    const cleaned = (amt ?? '').replace(/[,$\s]/g, '').replace(/^NT/i, '');
    if (!/^\d+$/.test(cleaned) || Number(cleaned) <= 0)
      return void skipped.push({ source, line, raw, reason: '金額不是正整數' });
    if (!cat) return void skipped.push({ source, line, raw, reason: '缺少類別' });
    rows.push({ date, amount: Number(cleaned), srcCategory: stripLeadingEmoji(cat), note: rest.join(',').trim(), source });
  });
  return { rows, skipped };
}

export interface InputFile { name: string; data: Uint8Array }

/** 是否為「支出」表（排除「支出統計」「年度統計」） */
export function isExpenseSheet(path: string): boolean {
  const base = path.split('/').pop() ?? path;
  return /\.csv$/i.test(base) && /支出\.csv$/i.test(base) && !/統計/.test(base);
}

/** zip 內檔名若沒有 UTF-8 旗標，fflate 會用 latin1 解出亂碼（Numbers 匯出的 zip 就是）；還原成 UTF-8 */
export function fixZipName(name: string): string {
  if (!/[\u0080-\u00ff]/.test(name) || /[^\u0000-\u00ff]/.test(name)) return name;
  try {
    const bytes = Uint8Array.from(name, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { return name; }
}

/** 接受 zip 或多個 CSV */
export function parseFiles(files: InputFile[]): ParseResult {
  const rows: RawRow[] = [];
  const skipped: SkippedRow[] = [];
  const used: string[] = [];
  const csvs: { name: string; text: string }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const z = unzipSync(f.data);
      for (const [path, data] of Object.entries(z)) {
        if (path.startsWith('__MACOSX') || !/\.csv$/i.test(path)) continue;
        csvs.push({ name: fixZipName(path), text: strFromU8(data) });
      }
    } else csvs.push({ name: f.name, text: strFromU8(f.data) });
  }
  // 若有任何檔名符合「支出」表就只取那些；否則（使用者單選了別的名字）全部當支出表
  const expense = csvs.filter((c) => isExpenseSheet(c.name));
  const picked = expense.length ? expense : csvs.filter((c) => !/統計/.test(c.name));
  for (const c of picked) {
    const r = parseExpenseCsv(c.text, c.name.split('/').pop() ?? c.name);
    rows.push(...r.rows);
    skipped.push(...r.skipped);
    used.push(c.name);
  }
  return { rows, skipped, files: used };
}

/* ---------- 類別對應 ---------- */

export type Target = { kind: 'category'; name: string };

const SAME = ['餐費', '飲料', '住房', '交通', '治裝', '娛樂', '醫療', '電信網路', '保險', '稅金', '旅遊'];
const ALIAS: Record<string, string> = {
  水費: '水電瓦斯', 電費: '水電瓦斯', 瓦斯: '水電瓦斯', 雜費: '日用雜貨', 學費: '學習', 刷卡: '娛樂',
};

/** 預設對應；沒對到回傳 undefined（匯入畫面要求指定） */
export function defaultTarget(src: string, existing: string[] = []): Target | undefined {
  if (ALIAS[src]) return { kind: 'category', name: ALIAS[src] };
  if (SAME.includes(src) || existing.includes(src)) return { kind: 'category', name: src };
  return undefined;
}

const UTILITY_NOTE = /水費|電費|瓦斯/;

export interface Resolved { row: RawRow; target: Target }

/** 套用對應；「住房」且備註含水電瓦斯 → 水電瓦斯 */
export function resolveRow(row: RawRow, mapping: Record<string, Target | undefined>): Target | undefined {
  const t = mapping[row.srcCategory];
  if (!t) return undefined;
  if (row.srcCategory === '住房' && t.kind === 'category' && t.name === '住房' && UTILITY_NOTE.test(row.note))
    return { kind: 'category', name: '水電瓦斯' };
  return t;
}

export const monthKey = (d: string) => d.slice(0, 7);

export function sumBy<T>(xs: T[], key: (x: T) => string, val: (x: T) => number): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + val(x);
  return m;
}
