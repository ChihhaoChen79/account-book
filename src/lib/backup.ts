import { buildBackup, patchSettings } from '../db';
import { stamp } from './format';
import { toCsv } from './csv';
import { db } from '../db';

async function deliver(blob: Blob, filename: string, mime: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // 其他錯誤（例如失去使用者手勢）→ 改用下載
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

/** 一鍵備份：分享選單 → 失敗改下載。成功才更新「上次備份」。 */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const r = await deliver(blob, `ledger-backup-${stamp()}.json`, 'application/json');
  if (r !== 'cancelled') await patchSettings({ lastBackupAt: Date.now() });
  return r;
}

export async function exportYearCsv(year: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const [exps, cats, tags] = await Promise.all([db.expenses.toArray(), db.categories.toArray(), db.tags.toArray()]);
  const cn = new Map(cats.map((c) => [c.id, `${c.emoji} ${c.name}`]));
  const tn = new Map(tags.map((t) => [t.id, t.name]));
  const rows: (string | number)[][] = [['日期', '金額', '類別', '備註', '標籤']];
  exps.filter((e) => e.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => rows.push([e.date, e.amount, cn.get(e.categoryId) ?? '', e.note, e.tagIds.map((i) => tn.get(i) ?? '').join(' ')]));
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv' });
  return deliver(blob, `ledger-${year}.csv`, 'text/csv');
}
