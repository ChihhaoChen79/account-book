import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from './db';
import { DEFAULT_SETTINGS } from './lib/defaults';
import type { Category, Expense, Settings, Tag } from './types';

export const useCategories = (): Category[] =>
  useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [] as Category[]);
export const useTags = (): Tag[] => useLiveQuery(() => db.tags.toArray(), [], [] as Tag[]);
export const useSettings = (): Settings => useLiveQuery(getSettings, [], DEFAULT_SETTINGS);

/** 日期區間（含頭尾，字串比較） */
export const useExpensesBetween = (from: string, to: string): Expense[] =>
  useLiveQuery(() => db.expenses.where('date').between(from, to, true, true).toArray(), [from, to], [] as Expense[]);
export const useAllExpenses = (): Expense[] => useLiveQuery(() => db.expenses.toArray(), [], [] as Expense[]);
export const useExpenseCount = (): number => useLiveQuery(() => db.expenses.count(), [], 0);
