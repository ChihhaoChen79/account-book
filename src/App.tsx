import { useState } from 'react';
import EntryPage from './pages/EntryPage';
import LedgerPage, { type LedgerFilter } from './pages/LedgerPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import { monthOf, todayStr } from './lib/format';

type Tab = 'entry' | 'ledger' | 'stats' | 'settings';
const TABS: [Tab, string, string][] = [['entry', '✏️', '記帳'], ['ledger', '📒', '明細'], ['stats', '📊', '統計'], ['settings', '⚙️', '設定']];

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;

function dismissed(): boolean { try { return localStorage.getItem('a2hs-dismissed') === '1'; } catch { return false; } }

export default function App() {
  const [tab, setTab] = useState<Tab>('entry');
  const [filter, setFilter] = useState<LedgerFilter>({ month: monthOf(todayStr()) });
  const [hint, setHint] = useState(!isStandalone && isIOS && !dismissed());

  const openLedger = (f: LedgerFilter) => { setFilter(f); setTab('ledger'); };

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <div className="pt-safe" />
      {hint && (
        <div className="flex items-center justify-between bg-sky-600 px-3 py-2 text-sm text-white">
          <span>請點分享 → 「加入主畫面」使用，資料較不會被系統清除</span>
          <button className="h-11 w-11" onClick={() => { try { localStorage.setItem('a2hs-dismissed', '1'); } catch { /* ignore */ } setHint(false); }}>✕</button>
        </div>
      )}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
        {tab === 'entry' && <EntryPage />}
        {tab === 'ledger' && <LedgerPage filter={filter} setFilter={setFilter} />}
        {tab === 'stats' && <StatsPage openLedger={openLedger} />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t line" style={{ background: 'var(--card)' }}>
        <div className="mx-auto flex max-w-xl">
          {TABS.map(([k, icon, label]) => (
            <button key={k} onClick={() => { if (k === 'ledger' && tab !== 'ledger') setFilter((f) => (f.month || f.year || f.tagId || f.categoryId ? f : { month: monthOf(todayStr()) })); setTab(k); }}
              className="flex flex-1 flex-col items-center justify-center text-xs" style={{ minHeight: 56, color: tab === k ? 'var(--accent)' : 'var(--sub)' }}>
              <span className="text-xl leading-none">{icon}</span><span className="mt-0.5">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
