export interface Expense {
  id: string;
  date: string; // 'YYYY-MM-DD' 本地日期
  amount: number; // 新台幣整數 > 0
  categoryId: string;
  note: string;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
  archived: boolean;
}

export interface Tag {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
}

export interface Settings {
  activeTagIds: string[];
  lastBackupAt: number | null;
  backupReminderDays: number;
}

export const SCHEMA_VERSION = 1;

export interface BackupFile {
  app: 'ledger';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  categories: Category[];
  tags: Tag[];
  expenses: Expense[];
}
