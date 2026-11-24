# 記帳

個人記帳 Web App（iPhone Safari「加入主畫面」使用）。純前端、資料只存在手機本機（IndexedDB），可離線使用；靠匯出 JSON 備份。介面為正體中文，單一幣別（新台幣整數）。

React 18 + Vite + TypeScript、Tailwind、Dexie、Recharts、PWA（vite-plugin-pwa）。

## 功能

- **記帳**：金額自動聚焦、日期（昨天/今天快捷）、分類依近 30 天使用次數排序、備註建議、標籤、**旅行模式**（開啟後新增的支出自動掛標籤）、備份提醒。
- **明細**：月份切換、依日分組、搜尋備註、篩選分類/標籤、編輯/刪除、**多選批次**改分類/加減標籤/刪除。
- **統計**：月表 + 甜甜圈圖、年表（類別欄固定、可橫向捲動）+ 全年圖、標籤統計；任一金額格點擊可跳到明細並套用篩選。
- **設定**：分類管理（改名、emoji、顏色、▲▼排序、封存/刪除）、標籤管理、備份/還原、Numbers CSV 匯入、年度 CSV 匯出、清除所有資料。

規則：有紀錄的分類/標籤只能封存不能刪除；分類名稱不可重複（忽略 emoji）；支出只存分類與標籤的 ID，改名不影響歷史。

## 開發

```bash
npm install
npm run dev        # 開發
npm test           # 單元測試（匯入解析、統計對帳、備份還原）
npm run build      # 型別檢查 + 建置到 dist/
```

## 部署（GitHub Pages）

repo 的 **Settings → Pages → Source** 選 **GitHub Actions**。推到 `main`（或 `claude/**` 分支）會自動測試、建置、部署。網址形如 `https://<帳號>.github.io/account-book/`，用 iPhone **Safari** 開啟 → 分享 → **加入主畫面**。

## 搬舊資料

兩種方式（解析邏輯相同）：

1. **App 內匯入**：設定 → 匯入 Numbers CSV，選 zip 或各月「支出」CSV → 檢查類別對應、旅行標籤、對帳 → 寫入（寫入前自動留快照，可在設定頁還原）。
2. **轉成備份檔再還原**（不用在手機上對應）：
   ```bash
   npm run convert -- 路徑/2026.zip      # 輸出 private/ledger-backup-*.json
   ```
   把 JSON 傳到 iPhone（AirDrop / iCloud 雲碟）→ App 設定 → 從備份還原。

## 資料安全

- **repo 內不得放任何記帳資料**：`.gitignore` 排除 `private/`、`*.csv`、`*.zip`、備份 JSON。
- iOS 仍可能清除網站資料：請加入主畫面使用，並定期備份（記帳頁會在超過 7 天沒備份時提醒）。
