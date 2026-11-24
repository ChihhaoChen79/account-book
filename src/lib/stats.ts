import type { Category, Expense, Tag } from '../types';

export interface Row { category: Category; amount: number }

const sum = (xs: Expense[]) => xs.reduce((a, e) => a + e.amount, 0);

/** 依分類彙總；未封存分類全列（含 0），封存分類有金額才列 */
export function byCategory(expenses: Expense[], cats: Category[]): { rows: Row[]; total: number } {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + e.amount);
  const rows = [...cats]
    .sort((a, b) => a.order - b.order)
    .map((category) => ({ category, amount: m.get(category.id) ?? 0 }))
    .filter((r) => !r.category.archived || r.amount > 0);
  return { rows, total: sum(expenses) };
}

export interface MatrixRow { category: Category; months: number[]; total: number }

/** 年表：months[0..11] 為一月至十二月 */
export function yearMatrix(expenses: Expense[], cats: Category[]) {
  const map = new Map<string, number[]>();
  const colTotals = Array<number>(12).fill(0);
  for (const e of expenses) {
    const mi = Number(e.date.slice(5, 7)) - 1;
    if (!map.has(e.categoryId)) map.set(e.categoryId, Array<number>(12).fill(0));
    map.get(e.categoryId)![mi] += e.amount;
    colTotals[mi] += e.amount;
  }
  const rows: MatrixRow[] = [...cats]
    .sort((a, b) => a.order - b.order)
    .map((category) => {
      const months = map.get(category.id) ?? Array<number>(12).fill(0);
      return { category, months, total: months.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => !r.category.archived || r.total > 0);
  return { rows, colTotals, total: colTotals.reduce((a, b) => a + b, 0) };
}

export interface TagSummary { tag: Tag; count: number; total: number; from: string; to: string }

export function tagSummaries(expenses: Expense[], tags: Tag[]): TagSummary[] {
  const out = tags.map((tag) => {
    const xs = expenses.filter((e) => e.tagIds.includes(tag.id)).sort((a, b) => a.date.localeCompare(b.date));
    return { tag, count: xs.length, total: sum(xs), from: xs[0]?.date ?? '', to: xs[xs.length - 1]?.date ?? '' };
  });
  return out.sort((a, b) => b.to.localeCompare(a.to)); // 最近使用的在上
}

/** 近 N 天各分類使用次數，供記帳頁排序 */
export function recentUsage(expenses: Expense[], sinceDate: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of expenses) if (e.date >= sinceDate) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
  return m;
}
