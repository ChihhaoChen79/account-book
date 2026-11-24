import { useMemo, useState } from 'react';
import { useAllExpenses, useCategories, useExpensesBetween, useTags } from '../hooks';
import { addMonths, fmt, monthOf, todayStr, yearOf } from '../lib/format';
import { byCategory, tagSummaries, yearMatrix } from '../lib/stats';
import Donut from '../components/Donut';
import { Seg } from '../components/ui';
import type { LedgerFilter } from './LedgerPage';

type View = 'month' | 'year' | 'tag';
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function Amount({ v, onClick }: { v: number; onClick?: () => void }) {
  if (!onClick || v === 0) return <>{fmt(v)}</>;
  return <button onClick={onClick}>{fmt(v)}</button>;
}

export default function StatsPage({ openLedger }: { openLedger: (f: LedgerFilter) => void }) {
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(monthOf(todayStr()));
  const [year, setYear] = useState(yearOf(todayStr()));
  const [tagId, setTagId] = useState<string | null>(null);
  const cats = useCategories();
  const tags = useTags();
  const monthItems = useExpensesBetween(`${month}-01`, `${month}-31`);
  const yearItems = useExpensesBetween(`${year}-01-01`, `${year}-12-31`);
  const all = useAllExpenses();

  const m = useMemo(() => byCategory(monthItems, cats), [monthItems, cats]);
  const y = useMemo(() => yearMatrix(yearItems, cats), [yearItems, cats]);
  const yTotals = useMemo(() => byCategory(yearItems, cats), [yearItems, cats]);
  const summaries = useMemo(() => tagSummaries(all, tags).filter((s) => s.count > 0 || !s.tag.archived), [all, tags]);

  const Title = ({ children }: { children: string }) => <h2 className="mb-2 text-center text-2xl font-bold" style={{ color: 'var(--accent)' }}>{children}</h2>;

  return (
    <div className="space-y-3 p-3">
      <Seg<View> value={view} onChange={(v) => { setView(v); setTagId(null); }} options={[['month', '月'], ['year', '年'], ['tag', '標籤']]} />

      {view === 'month' && (
        <>
          <div className="flex items-center justify-between">
            <button className="h-11 w-11 text-xl" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
            <span className="text-lg font-semibold">{month}</span>
            <button className="h-11 w-11 text-xl" onClick={() => setMonth(addMonths(month, 1))}>›</button>
          </div>
          <Title>支出統計</Title>
          <table className="nt">
            <thead><tr><th>類別</th><th>實際</th></tr></thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.category.id}>
                  <td>{r.category.emoji} {r.category.name}</td>
                  <td className="num"><Amount v={r.amount} onClick={() => openLedger({ month, categoryId: r.category.id })} /></td>
                </tr>
              ))}
              <tr className="total"><td>支出總計</td><td className="num"><Amount v={m.total} onClick={() => openLedger({ month })} /></td></tr>
            </tbody>
          </table>
          <div className="card"><Donut rows={m.rows} total={m.total} /></div>
        </>
      )}

      {view === 'year' && (
        <>
          <div className="flex items-center justify-between">
            <button className="h-11 w-11 text-xl" onClick={() => setYear(String(Number(year) - 1))}>‹</button>
            <span className="text-lg font-semibold">{year}</span>
            <button className="h-11 w-11 text-xl" onClick={() => setYear(String(Number(year) + 1))}>›</button>
          </div>
          <Title>年度統計</Title>
          <div className="overflow-x-auto">
            <table className="nt">
              <thead><tr><th className="stick">類別</th>{MONTHS.map((n) => <th key={n}>{n}</th>)}<th>合計</th></tr></thead>
              <tbody>
                {y.rows.map((r) => (
                  <tr key={r.category.id}>
                    <td className="stick">{r.category.emoji} {r.category.name}</td>
                    {r.months.map((v, i) => (
                      <td key={i} className="num"><Amount v={v} onClick={() => openLedger({ month: `${year}-${String(i + 1).padStart(2, '0')}`, categoryId: r.category.id })} /></td>
                    ))}
                    <td className="num font-semibold"><Amount v={r.total} onClick={() => openLedger({ year, categoryId: r.category.id })} /></td>
                  </tr>
                ))}
                <tr className="total">
                  <td className="stick">支出總計</td>
                  {y.colTotals.map((v, i) => (
                    <td key={i} className="num"><Amount v={v} onClick={() => openLedger({ month: `${year}-${String(i + 1).padStart(2, '0')}` })} /></td>
                  ))}
                  <td className="num"><Amount v={y.total} onClick={() => openLedger({ year })} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card"><Donut rows={yTotals.rows} total={yTotals.total} /></div>
        </>
      )}

      {view === 'tag' && !tagId && (
        <>
          <Title>標籤統計</Title>
          {summaries.length === 0 && <div className="sub py-12 text-center">還沒有標籤</div>}
          <div className="card divide-y line p-0">
            {summaries.map((s) => (
              <button key={s.tag.id} className="flex w-full items-center justify-between px-3 py-2 text-left" style={{ minHeight: 56 }} onClick={() => setTagId(s.tag.id)}>
                <span>
                  <span className="block">🏷️ {s.tag.name}{s.tag.archived ? '（已封存）' : ''}</span>
                  <span className="sub text-xs">{s.from ? `${s.from} ~ ${s.to}` : '無紀錄'} · {s.count} 筆</span>
                </span>
                <span className="font-semibold tabular-nums">{fmt(s.total)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {view === 'tag' && tagId && <TagDetail tagId={tagId} onBack={() => setTagId(null)} openLedger={openLedger} />}
    </div>
  );
}

function TagDetail({ tagId, onBack, openLedger }: { tagId: string; onBack: () => void; openLedger: (f: LedgerFilter) => void }) {
  const cats = useCategories();
  const tags = useTags();
  const all = useAllExpenses();
  const items = useMemo(() => all.filter((e) => e.tagIds.includes(tagId)), [all, tagId]);
  const r = useMemo(() => byCategory(items, cats), [items, cats]);
  const tag = tags.find((t) => t.id === tagId);
  return (
    <>
      <button className="chip" onClick={onBack}>‹ 標籤列表</button>
      <h2 className="text-center text-2xl font-bold" style={{ color: 'var(--accent)' }}>🏷️ {tag?.name}</h2>
      <table className="nt">
        <thead><tr><th>類別</th><th>實際</th></tr></thead>
        <tbody>
          {r.rows.filter((x) => x.amount > 0).map((x) => (
            <tr key={x.category.id}><td>{x.category.emoji} {x.category.name}</td>
              <td className="num"><Amount v={x.amount} onClick={() => openLedger({ tagId, categoryId: x.category.id })} /></td></tr>
          ))}
          <tr className="total"><td>支出總計</td><td className="num"><Amount v={r.total} onClick={() => openLedger({ tagId })} /></td></tr>
        </tbody>
      </table>
      <div className="card"><Donut rows={r.rows} total={r.total} /></div>
      <button className="btn w-full" onClick={() => openLedger({ tagId })}>查看明細（{items.length} 筆）</button>
    </>
  );
}
