import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ensureSeed } from './db';
import './index.css';

registerSW({ immediate: true });
// 申請持久儲存，降低 iOS 清除資料的機率（結果顯示在設定頁）
navigator.storage?.persist?.().catch(() => {});

// 資料庫打不開（例如 Safari 隱私模式或 IndexedDB 卡住）時，要顯示原因而不是空白
const fail = (window as unknown as { __bootFail?: (m: string) => void }).__bootFail;
const timer = window.setTimeout(() => fail?.('資料庫 5 秒內沒有回應（IndexedDB 無法開啟）。請關閉隱私瀏覽、重新整理，或重開 Safari。'), 5000);

ensureSeed()
  .then(() => {
    clearTimeout(timer);
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((e) => { clearTimeout(timer); fail?.('資料庫錯誤：' + (e?.stack || e?.message || e)); });
