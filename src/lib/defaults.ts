import type { Category, Settings } from '../types';

export const PALETTE = [
  '#e6553a', '#f29b38', '#e8c53a', '#8cc152', '#37b24d', '#20c5a0', '#15aabf', '#3b8be0',
  '#5c6bc0', '#8e6bd8', '#c05cc9', '#e64f8a', '#a1887f', '#78909c', '#d4a373', '#868e96',
];

const D: [string, string, string][] = [
  ['c_meal', '☕️', '餐費'], ['c_drink', '🥤', '飲料'], ['c_rent', '🏠', '住房'], ['c_util', '💡', '水電瓦斯'],
  ['c_transport', '🚗', '交通'], ['c_daily', '📦', '日用雜貨'], ['c_cloth', '👔', '治裝'], ['c_fun', '🎮', '娛樂'],
  ['c_sport', '🏋️', '運動健身'], ['c_sub', '🔁', '訂閱'], ['c_med', '💊', '醫療'], ['c_telecom', '📱', '電信網路'],
  ['c_learn', '🎒', '學習'], ['c_ins', '🔒', '保險'], ['c_tax', '💰', '稅金'], ['c_travel', '✈️', '旅遊'],
];

export const DEFAULT_CATEGORIES: Category[] = D.map(([id, emoji, name], i) => ({
  id, emoji, name, color: PALETTE[i % PALETTE.length], order: i + 1, archived: false,
}));

export const UNSORTED_NAME = '待分類';

export const DEFAULT_SETTINGS: Settings = { activeTagIds: [], lastBackupAt: null, backupReminderDays: 7 };
