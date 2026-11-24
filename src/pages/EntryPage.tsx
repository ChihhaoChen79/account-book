import { useEffect, useMemo, useRef, useState } from 'react';
import { db, addTag, patchSettings } from '../db';
import { useAllExpenses, useCategories, useSettings, useTags } from '../hooks';
import { addDays, fmt, todayStr } from '../lib/format';
import { recentUsage } from '../lib/stats';
import { exportBackup } from '../lib/backup';
import { uid } from '../lib/format';
import { CategoryGrid, Sheet, TagChips, toast } from '../components/ui';

export default function EntryPage() {
  const cats = useCategories();
  const tags = useTags();
  const settings = useSettings();
  const all = useAllExpenses();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [travelSheet, setTravelSheet] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const today = todayStr();

  useEffect(() => { amountRef.current?.focus(); }, []);

  const usage = useMemo(() => recentUsage(all, addDays(today, -30)), [all, today]);
  const menu = useMemo(
    () => cats.filter((c) => !c.archived).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.order - b.order),
    [cats, usage],
  );
  const liveTags = tags.filter((t) => !t.archived);
  const active = settings.activeTagIds.filter((id) => liveTags.some((t) => t.id === id));
  const activeNames = active.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean).join('、');

  // 備註建議：同分類優先，依出現次數
  const suggestions = useMemo(() => {
    const m = new Map<string, { n: number; same: number }>();
    for (const e of all) {
      if (!e.note) continue;
      const x = m.get(e.note) ?? { n: 0, same: 0 };
      x.n++; if (e.categoryId === categoryId) x.same++;
      m.set(e.note, x);
    }
    const q = note.trim();
    return [...m.entries()]
      .filter(([k]) => (q ? k.includes(q) && k !== q : categoryId ? m.get(k)!.same > 0 : false))
      .sort((a, b) => (b[1].same - a[1].same) || (Number(b[0].startsWith(q)) - Number(a[0].startsWith(q))) || b[1].n - a[1].n)
      .slice(0, 6).map(([k]) => k);
  }, [all, note, categoryId]);

  const todayItems = all.filter((e) => e.date === today);
  const amt = Number(amount);
  const valid = Number.isInteger(amt) && amt > 0 && !!categoryId && !!date;

  const remindMs = settings.backupReminderDays * 86400000;
  const needBackup = all.length > 0 && (settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > remindMs);

  async function save() {
    if (!valid) return;
    const now = Date.now();
    await db.expenses.add({
      id: uid(), date, amount: amt, categoryId, note: note.trim(),
      tagIds: [...new Set([...active, ...extraTags])], createdAt: now, updatedAt: now,
    });
    setAmount(''); setNote(''); setCategoryId(''); setExtraTags([]);
    toast(`已記 ${fmt(amt)}`);
    amountRef.current?.focus();
  }

  async function createTag() {
    if (!newTag.trim()) return;
    const t = await addTag(newTag);
    setExtraTags((x) => (x.includes(t.id) ? x : [...x, t.id]));
    setNewTag('');
  }

  async function toggleTravel(id: string) {
    const next = active.includes(id) ? active.filter((i) => i !== id) : [...active, id];
    await patchSettings({ activeTagIds: next });
  }

  return (
    <div className="space-y-3 p-3">
      {needBackup && (
        <button className="w-full rounded-xl bg-amber-100 px-3 py-2 text-left text-sm text-amber-900" style={{ minHeight: 44 }}
          onClick={async () => { const r = await exportBackup(); if (r !== 'cancelled') toast('已備份'); }}>
          ⚠️ 已超過 {settings.backupReminderDays} 天沒備份，點此立即備份
        </button>
      )}

      {active.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl bg-sky-600 px-3 text-white" style={{ minHeight: 44 }}>
          <span>🧳 標籤中：{activeNames}</span>
          <button className="px-2 underline" style={{ minHeight: 44 }} onClick={() => patchSettings({ activeTagIds: [] })}>關閉</button>
        </div>
      ) : (
        <button className="chip" onClick={() => setTravelSheet(true)}>🧳 旅行模式</button>
      )}

      <div className="card space-y-3">
        <input ref={amountRef} className="input text-3xl font-semibold" style={{ minHeight: 56 }} inputMode="numeric" autoFocus placeholder="金額"
          value={amount ? fmt(Number(amount)) : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))} />
        <div className="flex gap-2">
          <input className="input min-w-0" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className={`btn whitespace-nowrap ${date === addDays(today, -1) ? 'chip-on' : ''}`} onClick={() => setDate(addDays(today, -1))}>昨天</button>
          <button className={`btn whitespace-nowrap ${date === today ? 'chip-on' : ''}`} onClick={() => setDate(today)}>今天</button>
        </div>
        <CategoryGrid cats={menu} value={categoryId} onPick={setCategoryId} />
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註（可空）" enterKeyHint="done" />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} className="chip" onClick={() => setNote(s)}>{s}</button>)}</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <TagChips tags={liveTags} value={extraTags} locked={active}
            onToggle={(id) => setExtraTags((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))} />
        </div>
        <div className="flex gap-2">
          <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="新增標籤" />
          <button className="btn" onClick={createTag}>新增</button>
        </div>
        <div className="sticky -mx-3 -mb-3 rounded-b-2xl px-3 pb-3 pt-2" style={{ bottom: 0, background: 'var(--card)' }}>
          <button className="btn-primary w-full text-lg" style={{ minHeight: 52 }} disabled={!valid} onClick={save}>儲存</button>
        </div>
      </div>

      <div className="sub px-1 text-sm">今天已記 {todayItems.length} 筆，小計 {fmt(todayItems.reduce((a, e) => a + e.amount, 0))}</div>

      {travelSheet && (
        <Sheet title="旅行模式" onClose={() => setTravelSheet(false)}>
          <p className="sub mb-3 text-sm">開啟後，之後每筆新增都會自動掛上選取的標籤。</p>
          <div className="flex flex-wrap gap-2">
            <TagChips tags={liveTags} value={active} onToggle={toggleTravel} />
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="新增旅行標籤，例：2026 冰島" />
            <button className="btn" onClick={async () => { if (!newTag.trim()) return; const t = await addTag(newTag); await toggleTravel(t.id); setNewTag(''); }}>新增並開啟</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
