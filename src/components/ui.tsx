import { useEffect, type ReactNode } from 'react';
import type { Category, Tag } from '../types';

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="mx-auto flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl" style={{ background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="h-11 w-11 text-2xl sub" aria-label="關閉" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function CategoryGrid({ cats, value, onPick }: { cats: Category[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cats.map((c) => (
        <button
          key={c.id} type="button" onClick={() => onPick(c.id)}
          className="flex min-h-[56px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs active:opacity-70"
          style={{ borderColor: value === c.id ? c.color : 'var(--line)', background: value === c.id ? c.color + '33' : 'var(--card)', borderWidth: value === c.id ? 2 : 1 }}
        >
          <span className="text-xl leading-none">{c.emoji}</span>
          <span className="mt-0.5 max-w-full truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export function TagChips({ tags, value, onToggle, locked = [] }: { tags: Tag[]; value: string[]; onToggle: (id: string) => void; locked?: string[] }) {
  return (
    <>
      {tags.map((t) => {
        const on = value.includes(t.id) || locked.includes(t.id);
        return (
          <button key={t.id} type="button" disabled={locked.includes(t.id)} onClick={() => onToggle(t.id)} className={`chip ${on ? 'chip-on' : ''}`}>
            🏷️ {t.name}{locked.includes(t.id) ? '（旅行模式）' : ''}
          </button>
        );
      })}
    </>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl p-1" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className="flex-1 rounded-lg text-sm font-medium" style={{ minHeight: 40, background: value === v ? 'var(--accent)' : 'transparent', color: value === v ? '#fff' : undefined }}>
          {label}
        </button>
      ))}
    </div>
  );
}


let toastTimer: number | undefined;
export function toast(msg: string) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top));z-index:90;background:#111c;color:#fff;padding:10px 16px;border-radius:999px;font-size:15px;pointer-events:none;backdrop-filter:blur(8px);transition:opacity .2s';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el!.style.opacity = '0'; }, 1800);
}

export function catLabel(c: Category | undefined) { return c ? `${c.emoji} ${c.name}` : '（已刪除）'; }
