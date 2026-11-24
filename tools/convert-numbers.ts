/**
 * 把 Numbers 匯出的 zip / CSV 轉成 App 的備份 JSON（還原即可）。
 * 用法：npm run convert -- <zip 或 csv...> [--out private/xxx.json]
 * 輸出預設在 private/（已被 .gitignore 排除），記帳資料絕對不要進 repo。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { buildImportBackup } from '../src/lib/convert';
import { parseFiles } from '../src/lib/importer';
import { fmt, stamp } from '../src/lib/format';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
let out = oi >= 0 ? args[oi + 1] : `private/ledger-backup-${stamp()}.json`;
const inputs = args.filter((a, i) => !a.startsWith('--') && (oi < 0 || (i !== oi + 1)));
if (!inputs.length) { console.error('請提供 zip 或 csv 檔'); process.exit(1); }

const parsed = parseFiles(inputs.map((p) => ({ name: basename(p), data: new Uint8Array(readFileSync(p)) })));
const { backup, report } = buildImportBackup(parsed.rows);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(backup));

console.log(`讀取 ${parsed.files.length} 個支出表，${parsed.rows.length} 筆，略過 ${parsed.skipped.length} 筆`);
parsed.skipped.forEach((s) => console.log('  略過', s.source, s.line, s.reason, s.raw));
console.log('各月總計：');
Object.entries(report.monthTotals).forEach(([m, v]) => console.log(' ', m, fmt(v)));
console.log('各分類總計：');
Object.entries(report.categoryTotals).forEach(([m, v]) => console.log(' ', m, fmt(v)));
console.log('總計', fmt(report.total), '→', out);
