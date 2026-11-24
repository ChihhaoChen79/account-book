import { useMemo, useState } from 'react';
import { db } from '../db';
import { useCategories, useExpensesBetween, useTags } from '../hooks';
import { addMonths, fmt, todayStr, weekday, monthOf } from '../lib/format';
import type { Expense } from '../types';
import ExpenseEditor from '../components/ExpenseEditor';
import { CategoryGrid, Sheet, TagChips, toast } from '../components/ui';

export interface LedgerFilter { month?: string; year?: string; categoryId?: string; tagId?: string }

export default function LedgerPage({ filter, setFilter }: { filter: LedgerFilter; setFilter: (f: LedgerFilter) => void }) {
  const cats = useCategories();
  const tags = useTags();
  const month = filter.month;
  const [from, to] = month ? [`${month}-01`, `${month}-31`] : filter.year ? [`${filter.year}-01-01`, `${filter.year}-12-31`] : ['0000-01-01', '9999-12-31'];
  const items = useExpensesBetween(from, to);
  const [q, setQ] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<null | 'cat' | 'addTag' | 'rmTag' | 'del'>(null);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items
      .filter((e) => (!filter.categoryId || e.categoryId === filter.categoryId) && (!filter.tagId || e.tagIds.includes(filter.tagId)) && (!kw || e.note.toLowerCase().includes(kw)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [items, filter, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of shown) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [shown]);

  const total = shown.reduce((a, e) => a + e.amount, 0);
  const hasFilter = !!(filter.categoryId || filter.tagId);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exit = () => { setSelecting(false); setSel(new Set()); setBatch(null); };
  const selected = shown.filter((e) => sel.has(e.id));

  async function applyBatch(fn: (e: Expense) => Expense) {
    const now = Date.now();
    await db.expenses.bulkPut(selected.map((e) => ({ ...fn(e), updatedAt: now })));
    toast(`已更新 ${selected.length} 筆`);
    exit();
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 space-y-2 p-3" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center justify-between">
          {month ? (
            <>
              <button className="h-11 w-11 text-xl" onClick={() => setFilter({ ...filter, month: addMonths(month, -1) })}>‹</button>
              <button className="text-lg font-semibold" style={{ minHeight: 44 }} onClick={() => setFilter({ ...filter, month: monthOf(todayStr()) })}>{month}</button>
              <button className="h-11 w-11 text-xl" onClick={() => setFilter({ ...filter, month: addMonths(month, 1) })}>›</button>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold">{filter.year ? `${filter.year} 全年` : '全部期間'}</span>
              <button className="chip" onClick={() => setFilter({ ...filter, month: monthOf(todayStr()), year: undefined })}>改看本月</button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="搜尋備註" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className={`btn ${hasFilter ? 'chip-on' : ''}`} onClick={() => setShowFilter(true)}>篩選</button>
          <button className={`btn ${selecting ? 'chip-on' : ''}`} onClick={() => (selecting ? exit() : setSelecting(true))}>{selecting ? '完成' : '多選'}</button>
        </div>
        {hasFilter && (
          <div className="flex flex-wrap gap-2">
            {filter.categoryId && <button className="chip chip-on" onClick={() => setFilter({ ...filter, categoryId: undefined })}>{catMap.get(filter.categoryId)?.emoji} {catMap.get(filter.categoryId)?.name} ✕</button>}
            {filter.tagId && <button className="chip chip-on" onClick={() => setFilter({ ...filter, tagId: undefined })}>🏷️ {tagMap.get(filter.tagId)?.name} ✕</button>}
          </div>
        )}
        <div className="sub text-sm">共 {shown.length} 筆 · 合計 {fmt(total)}</div>
      </div>

      <div className="space-y-3 px-3">
        {groups.length === 0 && <div className="sub py-12 text-center">沒有紀錄</div>}
        {groups.map(([date, es]) => (
          <div key={date}>
            <div className="sub flex justify-between px-1 pb-1 text-sm">
              <span>{date.slice(5)} {weekday(date)}</span><span>{fmt(es.reduce((a, e) => a + e.amount, 0))}</span>
            </div>
            <div className="card divide-y line p-0">
              {es.map((e) => {
                const c = catMap.get(e.categoryId);
                return (
                  <button key={e.id} className="flex w-full items-center gap-2 px-3 py-2 text-left active:opacity-60" style={{ minHeight: 52 }}
                    onClick={() => (selecting ? toggle(e.id) : setEditing(e))}>
                    {selecting && <span className="text-xl">{sel.has(e.id) ? '☑️' : '⬜️'}</span>}
                    <span className="text-xl">{c?.emoji ?? '❓'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{c?.name ?? '（已刪除）'}{e.note && <span className="sub"> · {e.note}</span>}</span>
                      {e.tagIds.length > 0 && <span className="sub block truncate text-xs">{e.tagIds.map((i) => '🏷️' + (tagMap.get(i)?.name ?? '')).join(' ')}</span>}
                    </span>
                    <span className="font-medium tabular-nums">{fmt(e.amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selecting && (
        <div className="pb-safe fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 border-t line p-2" style={{ background: 'var(--card)' }}>
          <div className="mx-auto flex max-w-xl items-center gap-2 overflow-x-auto">
            <button className="chip" onClick={() => setSel(new Set(sel.size === shown.length ? [] : shown.map((e) => e.id)))}>{sel.size === shown.length && shown.length ? '取消全選' : '全選'}</button>
            <span className="sub whitespace-nowrap text-sm">{sel.size} 筆</span>
            <button className="chip" disabled={!sel.size} onClick={() => setBatch('cat')}>改分類</button>
            <button className="chip" disabled={!sel.size} onClick={() => setBatch('addTag')}>加標籤</button>
            <button className="chip" disabled={!sel.size} onClick={() => setBatch('rmTag')}>移除標籤</button>
            <button className="chip text-red-600" disabled={!sel.size} onClick={() => setBatch('del')}>刪除</button>
          </div>
        </div>
      )}

      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} />}

      {showFilter && (
        <Sheet title="篩選" onClose={() => setShowFilter(false)}>
          <div className="space-y-4">
            <div>
              <div className="sub mb-2 text-sm">分類</div>
              <CategoryGrid cats={cats.filter((c) => !c.archived || c.id === filter.categoryId)} value={filter.categoryId ?? ''}
                onPick={(id) => setFilter({ ...filter, categoryId: filter.categoryId === id ? undefined : id })} />
            </div>
            <div>
              <div className="sub mb-2 text-sm">標籤</div>
              <div className="flex flex-wrap gap-2"><TagChips tags={tags} value={filter.tagId ? [filter.tagId] : []}
                onToggle={(id) => setFilter({ ...filter, tagId: filter.tagId === id ? undefined : id })} /></div>
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={() => setFilter({ month: filter.month, year: filter.year })}>清除篩選</button>
              <button className="btn-primary flex-1" onClick={() => setShowFilter(false)}>完成</button>
            </div>
          </div>
        </Sheet>
      )}

      {batch === 'cat' && (
        <Sheet title={`改分類（${sel.size} 筆）`} onClose={() => setBatch(null)}>
          <CategoryGrid cats={cats.filter((c) => !c.archived)} value="" onPick={(id) => applyBatch((e) => ({ ...e, categoryId: id }))} />
        </Sheet>
      )}
      {(batch === 'addTag' || batch === 'rmTag') && (
        <Sheet title={batch === 'addTag' ? `加標籤（${sel.size} 筆）` : `移除標籤（${sel.size} 筆）`} onClose={() => setBatch(null)}>
          <div className="flex flex-wrap gap-2">
            {tags.filter((t) => batch === 'rmTag' || !t.archived).map((t) => (
              <button key={t.id} className="chip" onClick={() => applyBatch((e) => ({
                ...e, tagIds: batch === 'addTag' ? [...new Set([...e.tagIds, t.id])] : e.tagIds.filter((i) => i !== t.id),
              }))}>🏷️ {t.name}</button>
            ))}
            {tags.length === 0 && <div className="sub">還沒有標籤，可在記帳頁或設定頁新增</div>}
          </div>
        </Sheet>
      )}
      {batch === 'del' && (
        <Sheet title="刪除" onClose={() => setBatch(null)}>
          <p className="mb-4">確定刪除選取的 {sel.size} 筆？此動作無法復原。</p>
          <button className="btn-danger w-full" onClick={async () => { await db.expenses.bulkDelete([...sel]); toast('已刪除'); exit(); }}>確定刪除</button>
        </Sheet>
      )}
    </div>
  );
}
