import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ensureSeed } from './db';
import './index.css';

registerSW({ immediate: true });
// 申請持久儲存，降低 iOS 清除資料的機率（結果顯示在設定頁）
navigator.storage?.persist?.().catch(() => {});

ensureSeed().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
