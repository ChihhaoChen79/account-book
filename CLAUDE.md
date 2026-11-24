# CLAUDE.md

個人記帳 PWA（React + Vite + TS + Tailwind 3 + Dexie + Recharts）。規格見 README。資料只在手機 IndexedDB，**repo 不可含任何記帳資料**（`private/`、csv、zip、備份 json 已 gitignore）。

## 指令
`npm test`（vitest）、`npm run build`（tsc + vite）、`npm run convert -- <zip|csv…>`（Numbers → 備份 JSON，輸出到 private/）。

## 從其他專案（健身 App、trip-helper）帶來的經驗，避免重複 debug
- **離線**：不用 CDN，全部打包進去；SW 由 vite-plugin-pwa 產生（autoUpdate + precache）。改了資源後 SW 會自己換版，不必手動改版本號。`base: './'` 讓 GitHub Pages 子路徑能用。
- **iOS Safari**：`viewport-fit=cover` + `env(safe-area-inset-*)`；輸入框字級 ≥16px（否則聚焦會放大）；需要 `apple-touch-icon.png`（iOS 不吃 manifest 圖示）；可點元件 ≥44px。
- **輸入框狀態**：健身 App 曾因整頁 re-render 把輸入中的文字洗掉。這裡用 React 受控元件，狀態一律放 state，不要在儲存時才從 DOM 讀值。
- **資料層**：一律經 `src/db.ts` 的函式；改 schema 要加 `db.version(n)`（Dexie 會做遷移）。讀資料用 `useLiveQuery`（hooks.ts），寫入後畫面自動更新，不必手動 reload。
- **歷史不被改名影響**：支出只存 categoryId / tagIds；顯示時現場查名稱。
- **備份**：備份 JSON 只含資料與設定，不放任何金鑰。匯入/還原/清除前都會 `saveSnapshot()`，設定頁可還原。
- **Web Share / 下載**：`navigator.share({files})` 需要使用者手勢，失敗（非取消）就退回 `<a download>`；使用者取消不更新「上次備份」。
- **zip 檔名**：Numbers 匯出的 zip 沒有 UTF-8 旗標，fflate 會把中文檔名解成 latin1 亂碼（`fixZipName` 處理）。過濾「支出」表要在還原檔名之後。
- **日期**：一律存本地 `YYYY-MM-DD` 字串，不用 `toISOString()`（會偏時區）。
- **XSS**：React 預設跳脫；不要用 `dangerouslySetInnerHTML`。
- CI 先跑測試再部署（比照 trip-helper 的 pages.yml）。

## 驗證方式
沒有真機時用 Playwright 的 iPhone 裝置模擬跑 `vite preview`：匯入 → 統計對帳 → 離線重載。對帳基準：各月總計與 Numbers「年度統計」一致。
