import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addCategory, addTag, buildBackup, categoryHasRecords, clearAll, db, ensureSeed, restoreBackup, validateBackup } from '../src/db';

describe('資料庫', () => {
  it('預設 15 個分類；名稱不可重複（忽略 emoji）', async () => {
    await ensureSeed();
    expect(await db.categories.count()).toBe(15);
    await expect(addCategory('☕️ 餐費', '☕️')).rejects.toThrow('重複');
    const c = await addCategory('寵物', '🐶');
    expect(c.order).toBe(16);
  });

  it('備份 → 清除 → 還原：筆數與金額相同；標籤 multiEntry 索引可查', async () => {
    await ensureSeed();
    const tag = await addTag('2026 冰島');
    const now = Date.now();
    await db.expenses.bulkAdd([
      { id: 'a', date: '2026-11-01', amount: 100, categoryId: 'c_meal', note: '', tagIds: [tag.id], createdAt: now, updatedAt: now },
      { id: 'b', date: '2026-11-02', amount: 250, categoryId: 'c_meal', note: 'x', tagIds: [], createdAt: now, updatedAt: now },
    ]);
    expect(await db.expenses.where('tagIds').equals(tag.id).count()).toBe(1);
    expect(await categoryHasRecords('c_meal')).toBe(true);
    const backup = validateBackup(JSON.parse(JSON.stringify(await buildBackup())));
    await clearAll();
    expect(await db.expenses.count()).toBe(0);
    await restoreBackup(backup);
    const all = await db.expenses.toArray();
    expect(all.length).toBe(2);
    expect(all.reduce((s, e) => s + e.amount, 0)).toBe(350);
    expect(await db.expenses.where('tagIds').equals(tag.id).count()).toBe(1);
  });

  it('拒絕不是記帳備份的檔案', () => {
    expect(() => validateBackup({ foo: 1 })).toThrow();
  });
});
