import type { BackupFile, Category, Expense, Tag } from '../types';
import { SCHEMA_VERSION } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, PALETTE } from './defaults';
import { defaultTarget, monthKey, resolveRow, sumBy, type RawRow, type Target } from './importer';
import { uid } from './format';

export interface Report { monthTotals: Record<string, number>; categoryTotals: Record<string, number>; total: number }

/** 從空白狀態（預設分類）把原始列直接組成一份完整備份。命令列工具用。 */
export function buildImportBackup(rows: RawRow[]): { backup: BackupFile; report: Report } {
  const cats: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  const tags: Tag[] = [];
  const catId = (name: string) => {
    let c = cats.find((x) => x.name === name);
    if (!c) {
      c = { id: uid(), name, emoji: '🏷️', color: PALETTE[cats.length % PALETTE.length], order: cats.length + 1, archived: false };
      cats.push(c);
    }
    return c.id;
  };
  const mapping: Record<string, Target | undefined> = {};
  for (const r of rows) if (!(r.srcCategory in mapping)) mapping[r.srcCategory] = defaultTarget(r.srcCategory);
  const unmapped = Object.keys(mapping).filter((k) => !mapping[k]);
  if (unmapped.length) throw new Error('無法對應的類別：' + unmapped.join('、') + '（請在 App 匯入畫面指定）');

  const now = Date.now();
  const expenses: Expense[] = rows.map((r) => {
    const t = resolveRow(r, mapping)!;
    const base = { id: uid(), date: r.date, amount: r.amount, note: r.note, createdAt: now, updatedAt: now };
    return { ...base, categoryId: catId(t.name), tagIds: [] };
  });
  const cn = new Map(cats.map((c) => [c.id, c.name]));
  return {
    backup: { app: 'ledger', schemaVersion: SCHEMA_VERSION, exportedAt: now, settings: { ...DEFAULT_SETTINGS }, categories: cats, tags, expenses },
    report: {
      monthTotals: sumBy(expenses, (e) => monthKey(e.date), (e) => e.amount),
      categoryTotals: sumBy(expenses, (e) => cn.get(e.categoryId) ?? '?', (e) => e.amount),
      total: expenses.reduce((a, e) => a + e.amount, 0),
    },
  };
}
