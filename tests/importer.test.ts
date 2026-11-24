import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { fixZipName, defaultTarget, parseExpenseCsv, parseFiles, resolveRow } from '../src/lib/importer';
import { buildImportBackup } from '../src/lib/convert';
import { byCategory, yearMatrix } from '../src/lib/stats';

const SHEET = '﻿日期,金額,類別,備註\r\n,,,\r\n,,,\r\n2026-01-19,45,☕️ 餐費,午餐\r\n2026-01-21,"1,200",🏠 住房,電費\r\n2026-02-30,10,☕️ 餐費,壞日期\r\n2026-02-01,abc,☕️ 餐費,壞金額\r\n2026-02-02,$80,✈️ 旅遊,機場\r\n2026-02-03,5,🔮 神秘,x\r\n';

describe('parseExpenseCsv', () => {
  const r = parseExpenseCsv(SHEET, 'a.csv');
  it('跳過空白列與標題，去掉金額逗號與 $', () => {
    expect(r.rows.map((x) => x.amount)).toEqual([45, 1200, 80, 5]);
  });
  it('無效日期與金額列出來', () => {
    expect(r.skipped.map((s) => s.reason)).toEqual(['日期無效', '金額不是正整數']);
  });
  it('類別去掉 emoji（含 U+FE0F）', () => {
    expect(r.rows[0].srcCategory).toBe('餐費');
    expect(r.rows[2].srcCategory).toBe('旅遊');
  });
});

describe('類別對應', () => {
  it('預設對應', () => {
    expect(defaultTarget('水費')).toEqual({ kind: 'category', name: '水電瓦斯' });
    expect(defaultTarget('雜費')).toEqual({ kind: 'category', name: '日用雜貨' });
    expect(defaultTarget('學費')).toEqual({ kind: 'category', name: '學習' });
    expect(defaultTarget('刷卡')).toEqual({ kind: 'category', name: '娛樂' });
    expect(defaultTarget('旅遊')).toEqual({ kind: 'travel' });
    expect(defaultTarget('神秘')).toBeUndefined();
  });
  it('住房＋備註含水電瓦斯 → 水電瓦斯', () => {
    const [row] = parseExpenseCsv('2026-01-21,1200,🏠 住房,電費', 'a').rows;
    expect(resolveRow(row, { 住房: { kind: 'category', name: '住房' } })).toEqual({ kind: 'category', name: '水電瓦斯' });
    const [row2] = parseExpenseCsv('2026-01-21,1200,🏠 住房,房租', 'a').rows;
    expect(resolveRow(row2, { 住房: { kind: 'category', name: '住房' } })).toEqual({ kind: 'category', name: '住房' });
  });
});

describe('parseFiles', () => {
  const zip = zipSync({
    '2026/一月-支出.csv': strToU8(SHEET),
    '2026/一月-支出統計.csv': strToU8('類別,實際\n☕️ 餐費,999\n'),
    '2026/年度統計-支出統計.csv': strToU8('類別,一月\n'),
    '__MACOSX/x-支出.csv': strToU8('junk'),
  });
  it('zip：只讀「支出」表，忽略統計與 __MACOSX', () => {
    const r = parseFiles([{ name: 'a.zip', data: zip }]);
    expect(r.files).toEqual(['2026/一月-支出.csv']);
    expect(r.rows).toHaveLength(4);
  });
});

describe('zip 檔名沒有 UTF-8 旗標', () => {
  it('latin1 亂碼檔名還原成中文', () => {
    const mojibake = String.fromCharCode(...new TextEncoder().encode('一月-支出.csv'));
    expect(fixZipName(mojibake)).toBe('一月-支出.csv');
    expect(fixZipName('一月-支出.csv')).toBe('一月-支出.csv');
    expect(fixZipName('plain.csv')).toBe('plain.csv');
  });
});

describe('轉成備份 + 統計對帳', () => {
  const rows = parseExpenseCsv('2026-01-19,45,☕️ 餐費,午餐\n2026-01-21,1200,🏠 住房,電費\n2026-07-02,80,✈️ 旅遊,a\n2026-08-02,20,✈️ 旅遊,b\n2026-08-03,5,🎮 娛樂,c', 'a').rows;
  const { backup, report } = buildImportBackup(rows);
  it('總計不變，旅遊變待分類＋月份標籤', () => {
    expect(report.total).toBe(1350);
    expect(backup.tags.map((t) => t.name).sort()).toEqual(['2026-07 旅遊', '2026-08 旅遊']);
    expect(report.categoryTotals['待分類']).toBe(100);
    expect(report.categoryTotals['水電瓦斯']).toBe(1200);
  });
  it('年表每月總計 = 月表總計；分類合計之和 = 全年總計', () => {
    const y = yearMatrix(backup.expenses, backup.categories);
    expect(y.total).toBe(1350);
    expect(y.rows.reduce((a, r) => a + r.total, 0)).toBe(y.total);
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, '0');
      const month = byCategory(backup.expenses.filter((e) => e.date.startsWith(`2026-${mm}`)), backup.categories);
      expect(y.colTotals[m]).toBe(month.total);
    }
  });
  it('封存分類：有金額才顯示', () => {
    const cats = backup.categories.map((c) => (c.name === '餐費' || c.name === '運動健身' ? { ...c, archived: true } : c));
    const names = byCategory(backup.expenses, cats).rows.map((r) => r.category.name);
    expect(names).toContain('餐費');
    expect(names).not.toContain('運動健身');
    expect(names).toContain('飲料'); // 未封存、0 也要列出
  });
});
