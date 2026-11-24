import { useEffect, useRef, useState } from 'react';
import {
  addCategory, addTag, categoryHasRecords, clearAll, db, getSettings, getSnapshot, patchSettings, restoreBackup, saveSnapshot,
  tagHasRecords, validateBackup, normName,
} from '../db';
import { useCategories, useExpenseCount, useSettings, useTags } from '../hooks';
import { exportBackup, exportYearCsv } from '../lib/backup';
import { fmtDateTime, yearOf, todayStr } from '../lib/format';
import type { BackupFile, Category, Tag } from '../types';
import { Sheet, toast } from '../components/ui';
import ImportWizard from '../components/ImportWizard';

export default function SettingsPage() {
  const cats = useCategories();
  const tags = useTags();
  const settings = useSettings();
  const count = useExpenseCount();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [panel, setPanel] = useState<null | 'cats' | 'tags' | 'import' | 'clear'>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [csvYear, setCsvYear] = useState(yearOf(todayStr()));
  const fileRef = useRef<HTMLInputElement>(null);
  const [snap, setSnap] = useState<{ reason: string; at: number } | null>(null);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;

  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false)); }, []);
  useEffect(() => { getSnapshot().then((s) => setSnap(s ? { reason: s.reason, at: s.at } : null)); }, [pendingRestore, panel]);

  async function pickRestore(f: File | undefined) {
    if (!f) return;
    try { setPendingRestore(validateBackup(JSON.parse(await f.text()))); } catch (e) { toast((e as Error).message || '無法讀取備份檔'); }
  }
  async function doRestore() {
    if (!pendingRestore) return;
    await saveSnapshot('還原前自動備份');
    await restoreBackup(pendingRestore);
    setPendingRestore(null);
    toast('已還原');
  }
  async function restoreSnapshot() {
    const s = await getSnapshot();
    if (!s) return;
    await restoreBackup(s.data);
    toast('已還原到自動備份');
  }

  const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between py-1.5 text-sm"><span className="sub">{k}</span><span>{v}</span></div>;
  const Btn = ({ children, onClick }: { children: string; onClick: () => void }) => <button className="btn w-full text-left" onClick={onClick}>{children}</button>;

  return (
    <div className="space-y-4 p-3">
      <section className="card">
        <Row k="總筆數" v={String(count)} />
        <Row k="上次備份" v={settings.lastBackupAt ? fmtDateTime(settings.lastBackupAt) : '尚未備份'} />
        <Row k="持久儲存" v={persisted === null ? '…' : persisted ? '已取得' : '未取得（建議加入主畫面）'} />
        <Row k="以主畫面 App 開啟" v={standalone ? '是' : '否'} />
      </section>

      <section className="space-y-2">
        <h3 className="sub px-1 text-sm">管理</h3>
        <Btn onClick={() => setPanel('cats')}>🗂️ 分類管理</Btn>
        <Btn onClick={() => setPanel('tags')}>🏷️ 標籤管理</Btn>
      </section>

      <section className="space-y-2">
        <h3 className="sub px-1 text-sm">備份與匯入</h3>
        <Btn onClick={async () => { const r = await exportBackup(); if (r !== 'cancelled') toast('已備份'); }}>💾 備份（匯出 JSON）</Btn>
        <Btn onClick={() => fileRef.current?.click()}>♻️ 從備份還原</Btn>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { pickRestore(e.target.files?.[0]); e.target.value = ''; }} />
        <Btn onClick={() => setPanel('import')}>📥 匯入 Numbers CSV</Btn>
        <div className="flex gap-2">
          <input className="input w-28" inputMode="numeric" value={csvYear} onChange={(e) => setCsvYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button className="btn flex-1" onClick={() => exportYearCsv(csvYear)}>📤 匯出該年 CSV</button>
        </div>
        {snap && <Btn onClick={restoreSnapshot}>{`↩️ 還原到自動備份（${snap.reason}，${fmtDateTime(snap.at)}）`}</Btn>}
        <div className="card flex items-center justify-between text-sm">
          <span>備份提醒（天）</span>
          <input className="input w-20 text-center" inputMode="numeric" value={settings.backupReminderDays}
            onChange={(e) => patchSettings({ backupReminderDays: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 7) })} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="sub px-1 text-sm">危險區</h3>
        <button className="btn-danger w-full" onClick={() => setPanel('clear')}>🗑️ 清除所有資料</button>
      </section>

      {panel === 'cats' && <CategoryManager cats={cats} onClose={() => setPanel(null)} />}
      {panel === 'tags' && <TagManager tags={tags} onClose={() => setPanel(null)} />}
      {panel === 'import' && <ImportWizard onClose={() => setPanel(null)} />}
      {panel === 'clear' && <ClearSheet onClose={() => setPanel(null)} />}

      {pendingRestore && (
        <Sheet title="還原備份" onClose={() => setPendingRestore(null)}>
          <p className="mb-1">備份時間：{fmtDateTime(pendingRestore.exportedAt)}</p>
          <p className="mb-3">支出 {pendingRestore.expenses.length} 筆、分類 {pendingRestore.categories.length}、標籤 {pendingRestore.tags.length}</p>
          <p className="sub mb-4 text-sm">會整個取代目前的資料；還原前會先自動備份一份（可在設定頁還原回來）。</p>
          <button className="btn-primary w-full" onClick={doRestore}>確認還原</button>
        </Sheet>
      )}
    </div>
  );
}

function ClearSheet({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState('');
  return (
    <Sheet title="清除所有資料" onClose={onClose}>
      <p className="mb-3">所有支出、分類、標籤都會被刪除。請輸入「清除」確認。清除前會自動留一份快照。</p>
      <input className="input mb-3" value={t} onChange={(e) => setT(e.target.value)} placeholder="清除" />
      <button className="btn-danger w-full" disabled={t !== '清除'} onClick={async () => { await saveSnapshot('清除前自動備份'); await clearAll(); toast('已清除'); onClose(); }}>清除所有資料</button>
    </Sheet>
  );
}

/* ---------- 分類管理 ---------- */
function CategoryManager({ cats, onClose }: { cats: Category[]; onClose: () => void }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const sorted = [...cats].sort((a, b) => a.order - b.order);

  async function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await db.categories.bulkPut([{ ...a, order: b.order }, { ...b, order: a.order }]);
  }
  async function add() {
    try { await addCategory(name, emoji); setName(''); setEmoji(''); toast('已新增'); } catch (e) { toast((e as Error).message); }
  }
  return (
    <Sheet title="分類管理" onClose={onClose}>
      <div className="mb-3 flex gap-2">
        <input className="input w-16 text-center" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🙂" />
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="新分類名稱" />
        <button className="btn" onClick={add}>新增</button>
      </div>
      <div className="card divide-y line p-0">
        {sorted.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1 px-2" style={{ minHeight: 52, opacity: c.archived ? 0.5 : 1 }}>
            <button className="h-11 w-8 sub" onClick={() => move(i, -1)} aria-label="上移">▲</button>
            <button className="h-11 w-8 sub" onClick={() => move(i, 1)} aria-label="下移">▼</button>
            <button className="flex flex-1 items-center gap-2 text-left" style={{ minHeight: 44 }} onClick={() => { setEditing(c); }}>
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />
              <span className="text-xl">{c.emoji}</span><span>{c.name}{c.archived ? '（已封存）' : ''}</span>
            </button>
          </div>
        ))}
      </div>
      {editing && <CategoryEdit cat={editing} all={cats} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function CategoryEdit({ cat, all, onClose }: { cat: Category; all: Category[]; onClose: () => void }) {
  const [name, setName] = useState(cat.name);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [color, setColor] = useState(cat.color);
  const [used, setUsed] = useState<boolean | null>(null);
  useEffect(() => { categoryHasRecords(cat.id).then(setUsed); }, [cat.id]);

  async function save() {
    if (!name.trim()) return toast('請輸入名稱');
    if (all.some((c) => c.id !== cat.id && normName(c.name) === normName(name))) return toast('分類名稱重複');
    await db.categories.put({ ...cat, name: name.trim(), emoji: emoji || cat.emoji, color });
    onClose();
  }
  return (
    <Sheet title="編輯分類" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="input w-16 text-center" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="color" className="h-11 w-14 rounded-xl border line" value={color} onChange={(e) => setColor(e.target.value)} aria-label="顏色" />
        </div>
        <button className="btn-primary w-full" onClick={save}>儲存</button>
        <button className="btn w-full" onClick={async () => { await db.categories.put({ ...cat, archived: !cat.archived }); onClose(); }}>
          {cat.archived ? '取消封存' : '封存（不出現在記帳選單，歷史統計照常）'}
        </button>
        {used === false ? (
          <button className="btn-danger w-full" onClick={async () => { await db.categories.delete(cat.id); onClose(); }}>刪除（沒有紀錄）</button>
        ) : (
          <p className="sub text-center text-sm">{used === null ? '' : '有紀錄的分類只能封存，不能刪除'}</p>
        )}
      </div>
    </Sheet>
  );
}

/* ---------- 標籤管理 ---------- */
function TagManager({ tags, onClose }: { tags: Tag[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Tag | null>(null);
  return (
    <Sheet title="標籤管理" onClose={onClose}>
      <div className="mb-3 flex gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="新標籤，例：2026 冰島" />
        <button className="btn" onClick={async () => { try { await addTag(name); setName(''); } catch (e) { toast((e as Error).message); } }}>新增</button>
      </div>
      <div className="card divide-y line p-0">
        {tags.length === 0 && <div className="sub p-4 text-center">還沒有標籤</div>}
        {tags.map((t) => (
          <button key={t.id} className="flex w-full items-center px-3 text-left" style={{ minHeight: 52, opacity: t.archived ? 0.5 : 1 }} onClick={() => setEditing(t)}>
            🏷️ {t.name}{t.archived ? '（已封存）' : ''}
          </button>
        ))}
      </div>
      {editing && <TagEdit tag={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function TagEdit({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const [name, setName] = useState(tag.name);
  const [used, setUsed] = useState<boolean | null>(null);
  useEffect(() => { tagHasRecords(tag.id).then(setUsed); }, [tag.id]);
  return (
    <Sheet title="編輯標籤" onClose={onClose}>
      <div className="space-y-3">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary w-full" onClick={async () => { if (!name.trim()) return; await db.tags.put({ ...tag, name: name.trim() }); onClose(); }}>儲存</button>
        <button className="btn w-full" onClick={async () => {
          await db.tags.put({ ...tag, archived: !tag.archived });
          if (!tag.archived) await patchSettings({ activeTagIds: (await getSettings()).activeTagIds.filter((i) => i !== tag.id) });
          onClose();
        }}>{tag.archived ? '取消封存' : '封存'}</button>
        {used === false ? (
          <button className="btn-danger w-full" onClick={async () => { await db.tags.delete(tag.id); onClose(); }}>刪除（沒有紀錄）</button>
        ) : (
          <p className="sub text-center text-sm">{used === null ? '' : '有紀錄的標籤只能封存，不能刪除'}</p>
        )}
      </div>
    </Sheet>
  );
}
