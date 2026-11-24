import Dexie, { type Table } from 'dexie';
import type { BackupFile, Category, Expense, Settings, Tag } from './types';
import { SCHEMA_VERSION } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, PALETTE, UNSORTED_NAME } from './lib/defaults';
import { uid } from './lib/format';

interface Meta { key: string; value: unknown }

class LedgerDB extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  tags!: Table<Tag, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('ledgerDB');
    // v1：date / categoryId / tagIds(multiEntry) 索引。日後改 schema 在此加 version(2).upgrade(...)
    this.version(1).stores({
      expenses: 'id, date, categoryId, *tagIds',
      categories: 'id, order',
      tags: 'id',
      meta: 'key',
    });
  }
}

export const db = new LedgerDB();

/** 首次開啟：寫入預設分類與設定 */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.categories, db.meta, async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkPut(DEFAULT_CATEGORIES);
    if (!(await db.meta.get('settings'))) await db.meta.put({ key: 'settings', value: DEFAULT_SETTINGS });
  });
}

export async function getSettings(): Promise<Settings> {
  const r = await db.meta.get('settings');
  return { ...DEFAULT_SETTINGS, ...((r?.value as Partial<Settings>) ?? {}) };
}
export async function patchSettings(p: Partial<Settings>): Promise<void> {
  await db.meta.put({ key: 'settings', value: { ...(await getSettings()), ...p } });
}

export async function categoryHasRecords(id: string): Promise<boolean> {
  return (await db.expenses.where('categoryId').equals(id).count()) > 0;
}
export async function tagHasRecords(id: string): Promise<boolean> {
  return (await db.expenses.where('tagIds').equals(id).count()) > 0;
}

/** 分類名稱不可重複（忽略 emoji；名稱本身不含 emoji，這裡也順手去掉前綴 emoji） */
export function normName(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();
}

export async function addCategory(name: string, emoji: string): Promise<Category> {
  const all = await db.categories.toArray();
  const n = normName(name);
  if (!n) throw new Error('請輸入分類名稱');
  if (all.some((c) => normName(c.name) === n)) throw new Error('分類名稱重複');
  const c: Category = {
    id: uid(), name: name.trim(), emoji: emoji || '🏷️',
    color: PALETTE[all.length % PALETTE.length],
    order: Math.max(0, ...all.map((x) => x.order)) + 1, archived: false,
  };
  await db.categories.add(c);
  return c;
}

export async function ensureCategoryByName(name: string): Promise<Category> {
  const found = (await db.categories.toArray()).find((c) => normName(c.name) === normName(name));
  if (found) return found;
  const c = await addCategory(name, name === UNSORTED_NAME ? '❓' : '🏷️');
  return c;
}

export async function addTag(name: string): Promise<Tag> {
  const n = name.trim();
  if (!n) throw new Error('請輸入標籤名稱');
  const exist = (await db.tags.toArray()).find((t) => t.name === n);
  if (exist) return exist;
  const t: Tag = { id: uid(), name: n, archived: false, createdAt: Date.now() };
  await db.tags.add(t);
  return t;
}

export async function buildBackup(): Promise<BackupFile> {
  const [expenses, categories, tags, settings] = await Promise.all([
    db.expenses.toArray(), db.categories.toArray(), db.tags.toArray(), getSettings(),
  ]);
  return { app: 'ledger', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), settings, categories, tags, expenses };
}

export function validateBackup(x: unknown): BackupFile {
  const b = x as BackupFile;
  if (!b || b.app !== 'ledger' || !Array.isArray(b.expenses) || !Array.isArray(b.categories) || !Array.isArray(b.tags))
    throw new Error('不是有效的記帳備份檔');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION)
    throw new Error('備份檔版本比目前 App 新，請先更新 App');
  return b;
}

/** 整個取代目前資料 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  await db.transaction('rw', db.expenses, db.categories, db.tags, db.meta, async () => {
    await Promise.all([db.expenses.clear(), db.categories.clear(), db.tags.clear()]);
    await db.categories.bulkPut(b.categories);
    await db.tags.bulkPut(b.tags);
    await db.expenses.bulkPut(b.expenses);
    await db.meta.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...b.settings } });
  });
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.expenses, db.categories, db.tags, db.meta, async () => {
    await Promise.all([db.expenses.clear(), db.categories.clear(), db.tags.clear(), db.meta.clear()]);
  });
  await ensureSeed();
}

/** 自動備份快照（匯入、還原前）：存在 IndexedDB 內，設定頁可還原 */
export async function saveSnapshot(reason: string): Promise<void> {
  await db.meta.put({ key: 'snapshot', value: { reason, at: Date.now(), data: await buildBackup() } });
}
export async function getSnapshot(): Promise<{ reason: string; at: number; data: BackupFile } | null> {
  const r = await db.meta.get('snapshot');
  return (r?.value as never) ?? null;
}
