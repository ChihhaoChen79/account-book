import { useState } from 'react';
import { db, addTag } from '../db';
import { useCategories, useTags } from '../hooks';
import { isValidDate } from '../lib/format';
import type { Expense } from '../types';
import { CategoryGrid, Sheet, TagChips, toast } from './ui';

export default function ExpenseEditor({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const cats = useCategories();
  const tags = useTags();
  const [amount, setAmount] = useState(String(expense.amount));
  const [date, setDate] = useState(expense.date);
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [note, setNote] = useState(expense.note);
  const [tagIds, setTagIds] = useState(expense.tagIds);
  const [newTag, setNewTag] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // 已封存的分類/標籤：只有目前這筆在用時才顯示
  const pickCats = cats.filter((c) => !c.archived || c.id === expense.categoryId);
  const pickTags = tags.filter((t) => !t.archived || expense.tagIds.includes(t.id));
  const amt = Number(amount);
  const valid = Number.isInteger(amt) && amt > 0 && isValidDate(date) && !!categoryId;

  async function save() {
    await db.expenses.put({ ...expense, amount: amt, date, categoryId, note: note.trim(), tagIds, updatedAt: Date.now() });
    toast('已更新');
    onClose();
  }
  async function del() {
    await db.expenses.delete(expense.id);
    toast('已刪除');
    onClose();
  }
  async function addNewTag() {
    if (!newTag.trim()) return;
    const t = await addTag(newTag);
    setTagIds((x) => (x.includes(t.id) ? x : [...x, t.id]));
    setNewTag('');
  }

  return (
    <Sheet
      title="編輯支出" onClose={onClose}
      footer={
        <div className="flex gap-2">
          {confirmDel ? (
            <button className="btn-danger flex-1" onClick={del}>確定刪除</button>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDel(true)}>刪除</button>
          )}
          <button className="btn-primary flex-1" disabled={!valid} onClick={save}>儲存</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="金額" />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <CategoryGrid cats={pickCats} value={categoryId} onPick={setCategoryId} />
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註" />
        <div className="flex flex-wrap gap-2">
          <TagChips tags={pickTags} value={tagIds} onToggle={(id) => setTagIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))} />
        </div>
        <div className="flex gap-2">
          <input className="input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="新增標籤" />
          <button className="btn" onClick={addNewTag}>新增</button>
        </div>
      </div>
    </Sheet>
  );
}
