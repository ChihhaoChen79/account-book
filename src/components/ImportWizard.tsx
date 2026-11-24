import { useMemo, useRef, useState } from 'react';
import { addTag, db, ensureCategoryByName, saveSnapshot } from '../db';
import { useCategories, useTags } from '../hooks';
import { fmt, uid } from '../lib/format';
import { UNSORTED_NAME } from '../lib/defaults';
import { defaultTarget, defaultTravelTag, monthKey, parseFiles, resolveRow, sumBy, type ParseResult, type Target } from '../lib/importer';
import type { Expense } from '../types';
import { Sheet, toast } from './ui';

const TRAVEL = '__travel__';
const toVal = (t?: Target) => (!t ? '' : t.kind === 'travel' ? TRAVEL : t.name);
const fromVal = (v: string): Target | undefined => (!v ? undefined : v === TRAVEL ? { kind: 'travel' } : { kind: 'category', name: v });

export default function ImportWizard({ onClose }: { onClose: () => void }) {
  const cats = useCategories();
  const tags = useTags();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, Target | undefined>>({});
  const [tagNames, setTagNames] = useState<Record<string, string>>({});
  const [yearMode, setYearMode] = useState<'replace' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const catNames = useMemo(() => cats.map((c) => c.name), [cats]);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErr('');
    try {
      const inputs = await Promise.all([...files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
      const r = parseFiles(inputs);
      if (!r.rows.length) { setErr('找不到可匯入的支出資料'); return; }
      const mp: Record<string, Target | undefined> = {};
      for (const row of r.rows) if (!(row.srcCategory in mp)) mp[row.srcCategory] = defaultTarget(row.srcCategory, catNames);
      setMapping(mp);
      const tn: Record<string, string> = {};
      for (const row of r.rows) if (row.srcCategory === '旅遊') tn[monthKey(row.date)] = defaultTravelTag(monthKey(row.date));
      setTagNames(tn);
      setParsed(r);
    } catch { setErr('讀取檔案失敗，請確認是 Numbers 匯出的 zip 或 CSV'); }
  }

  // 已對應後的結果
  const view = useMemo(() => {
    if (!parsed) return null;
    const resolved = parsed.rows.map((row) => ({ row, target: resolveRow(row, mapping) }));
    const unmapped = [...new Set(parsed.rows.filter((r) => !mapping[r.srcCategory]).map((r) => r.srcCategory))];
    const label = (x: { row: { srcCategory: string }; target?: Target }) =>
      !x.target ? '（未指定）' : x.target.kind === 'travel' ? UNSORTED_NAME : x.target.name;
    const ok = resolved.filter((x) => x.target);
    return {
      resolved, unmapped,
      monthTotals: sumBy(ok, (x) => monthKey(x.row.date), (x) => x.row.amount),
      catTotals: sumBy(ok, label, (x) => x.row.amount),
      total: ok.reduce((a, x) => a + x.row.amount, 0),
      travelMonths: Object.entries(sumBy(ok.filter((x) => x.target!.kind === 'travel'), (x) => monthKey(x.row.date), () => 1)),
      years: [...new Set(parsed.rows.map((r) => r.date.slice(0, 4)))],
    };
  }, [parsed, mapping]);

  const [existingYears, setExistingYears] = useState<string[] | null>(null);
  async function checkExisting() {
    if (!view) return;
    const found: string[] = [];
    for (const y of view.years) if ((await db.expenses.where('date').between(`${y}-01-01`, `${y}-12-31`, true, true).count()) > 0) found.push(y);
    setExistingYears(found);
    setYearMode(null);
  }

  async function commit() {
    if (!view || !parsed) return;
    setBusy(true);
    try {
      await saveSnapshot('匯入前自動備份');
      if (existingYears?.length) {
        for (const y of existingYears) {
          const old = await db.expenses.where('date').between(`${y}-01-01`, `${y}-12-31`, true, true).primaryKeys();
          await db.expenses.bulkDelete(old);
        }
      }
      const catIds = new Map<string, string>();
      const getCat = async (name: string) => {
        if (!catIds.has(name)) catIds.set(name, (await ensureCategoryByName(name)).id);
        return catIds.get(name)!;
      };
      const tagIds = new Map<string, string>();
      const now = Date.now();
      const out: Expense[] = [];
      for (const { row, target } of view.resolved) {
        if (!target) continue;
        let categoryId: string; let tIds: string[] = [];
        if (target.kind === 'travel') {
          categoryId = await getCat(UNSORTED_NAME);
          const tn = (tagNames[monthKey(row.date)] || defaultTravelTag(monthKey(row.date))).trim();
          if (!tagIds.has(tn)) tagIds.set(tn, (await addTag(tn)).id);
          tIds = [tagIds.get(tn)!];
        } else categoryId = await getCat(target.name);
        out.push({ id: uid(), date: row.date, amount: row.amount, categoryId, note: row.note, tagIds: tIds, createdAt: now, updatedAt: now });
      }
      await db.expenses.bulkAdd(out);
      toast(`已匯入 ${out.length} 筆`);
      onClose();
    } catch (e) { setErr('匯入失敗：' + (e as Error).message); } finally { setBusy(false); }
  }

  const options = [...cats.filter((c) => !c.archived).map((c) => c.name)];
  for (const n of ['水電瓦斯', '日用雜貨', '學習', UNSORTED_NAME]) if (!options.includes(n)) options.push(n);

  return (
    <Sheet title="匯入 Numbers CSV" onClose={onClose}
      footer={view && (
        existingYears === null ? (
          <button className="btn-primary w-full" disabled={view.unmapped.length > 0} onClick={checkExisting}>
            {view.unmapped.length ? `還有 ${view.unmapped.length} 個類別未指定` : '下一步：確認'}
          </button>
        ) : existingYears.length > 0 && yearMode === null ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">⚠️ {existingYears.join('、')} 年已有資料，匯入會先刪除該年所有現有支出。</p>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose}>取消</button>
              <button className="btn-danger flex-1" onClick={() => setYearMode('replace')}>取代該年</button>
            </div>
          </div>
        ) : (
          <button className="btn-primary w-full" disabled={busy} onClick={commit}>確認寫入 {view.resolved.length} 筆（會先自動備份）</button>
        )
      )}>
      {!parsed && (
        <div className="space-y-3">
          <p className="sub text-sm">選擇 Numbers「匯出 → CSV」產生的 zip，或多選各月份的「支出」CSV。只會讀「支出」表，忽略「支出統計」。</p>
          <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>選擇檔案</button>
          <input ref={fileRef} type="file" multiple hidden accept=".zip,.csv,application/zip,text/csv" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}

      {parsed && view && (
        <div className="space-y-4">
          <p className="text-sm">讀取 {parsed.files.length} 個支出表，共 {parsed.rows.length} 筆，略過 {parsed.skipped.length} 筆。</p>

          <section>
            <h3 className="sub mb-1 text-sm">類別對應</h3>
            <div className="card space-y-2">
              {Object.keys(mapping).map((src) => (
                <div key={src} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm">{src}</span><span>→</span>
                  <select className="input" value={toVal(mapping[src])} onChange={(e) => setMapping({ ...mapping, [src]: fromVal(e.target.value) })}>
                    <option value="">請指定…</option>
                    {options.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value={TRAVEL}>旅行（待分類＋標籤）</option>
                  </select>
                </div>
              ))}
              <p className="sub text-xs">住房且備註含水費／電費／瓦斯者，自動歸到水電瓦斯。</p>
            </div>
          </section>

          {view.travelMonths.length > 0 && (
            <section>
              <h3 className="sub mb-1 text-sm">旅行標籤（依月份，可用同一個標籤）</h3>
              <div className="card space-y-2">
                {view.travelMonths.map(([m, n]) => (
                  <div key={m} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-sm">{m} 共 {n} 筆</span>
                    <input className="input" value={tagNames[m] ?? ''} onChange={(e) => setTagNames({ ...tagNames, [m]: e.target.value })} list="tagnames" />
                  </div>
                ))}
                <datalist id="tagnames">{tags.map((t) => <option key={t.id} value={t.name} />)}</datalist>
                <p className="sub text-xs">這些支出的分類先設為「{UNSORTED_NAME}」，匯入後到明細頁用「多選」批次改分類。</p>
              </div>
            </section>
          )}

          {parsed.skipped.length > 0 && (
            <section>
              <h3 className="sub mb-1 text-sm">略過的列（不匯入）</h3>
              <div className="card max-h-40 overflow-y-auto text-xs">
                {parsed.skipped.map((s, i) => <div key={i}>{s.source} 第 {s.line} 列：{s.reason}（{s.raw}）</div>)}
              </div>
            </section>
          )}

          <section>
            <h3 className="sub mb-1 text-sm">對帳</h3>
            <table className="nt text-sm"><thead><tr><th>月份</th><th>總計</th></tr></thead><tbody>
              {Object.entries(view.monthTotals).sort().map(([m, v]) => <tr key={m}><td>{m}</td><td className="num">{fmt(v)}</td></tr>)}
              <tr className="total"><td>合計</td><td className="num">{fmt(view.total)}</td></tr>
            </tbody></table>
            <table className="nt mt-3 text-sm"><thead><tr><th>分類</th><th>總計</th></tr></thead><tbody>
              {Object.entries(view.catTotals).sort((a, b) => b[1] - a[1]).map(([m, v]) => <tr key={m}><td>{m}</td><td className="num">{fmt(v)}</td></tr>)}
            </tbody></table>
          </section>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
