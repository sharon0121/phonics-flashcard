# 英雄學習平台 — 交接總覽（給接手的 Claude）

> 2026-10-16 打包。接手時先讀完本檔，再依需要讀 `docs/handoff/` 裡的詳細開發紀錄。
> 本 repo 是 **public**，這裡不放任何金鑰。

## 1. 專案是什麼
Sharon（擁有者）幫 4 歲半兒子做的學習網站：英文自然發音字卡＋英文／數學／小遊戲三大分類。
所有 UI 文字用**繁體中文**，和 Sharon 溝通也用繁體中文。Sharon 是程式初學者，指令直接執行、不用反覆確認。

| 項目 | 內容 |
|---|---|
| 正式網址 | https://phonics-flashcard.vercel.app |
| GitHub | https://github.com/sharon0121/phonics-flashcard （分支 `master`） |
| 目前版本 | **v2.17.0**（2026-09-21，`dpl_9GcgzfeZpuias8QRy3foXMZBjeav`）— 版本歷史見 `DEPLOYMENTS.md` |
| Vercel | 團隊 `tsa-product-mgmt`，專案 `phonics-flashcard`（`prj_oEs1bRAPPLV3iN1vVEbwre9lB3TN`） |
| 技術 | Next.js 16（App Router，**有 breaking changes，見 AGENTS.md**）、React 19、TypeScript、Tailwind 4、three.js、Vercel KV |

## 2. 接手前要先確認的權限（新帳號／新電腦）
1. **GitHub**：能 push `sharon0121/phonics-flashcard`（`gh auth status` 或 `git push --dry-run`）。
2. **Vercel CLI**：`npx vercel login`，要能存取團隊 `tsa-product-mgmt`；接著 `npx vercel link` 連到 `phonics-flashcard`。
3. **環境變數**：`npx vercel env pull .env.local`（KV 金鑰在 Vercel 標成 sensitive，本機抓不到明文 → 本機無法測真正的雲端同步，只能部署後用 curl 測 `/api/sync`）。
4. `npm install` → `npm run dev`。
5. **多裝置開發**：開工前一定先 `git fetch` / `git pull`，可能有別台裝置推了新版本。

## 3. 部署流程（嚴格遵守）
`git push` **不會**自動部署，一定要手動跑 Vercel CLI。
```
git status                       # 必須乾淨，不能有未 commit 的修改（vercel 會把本機檔案全部傳上去）
git add <指定檔案>
git commit -m "..."
git tag vX.Y.Z
git push && git push --tags
npx vercel --prod --scope tsa-product-mgmt
```
- 部署後更新 `DEPLOYMENTS.md`（日期、deployment id、版本、本次更新內容，用 Sharon 看得懂的中文寫）。
- 功能完成先 `npx tsc --noEmit`、`npx eslint <改到的檔案>`、`npm run build`，可以的話用 Playwright 實測，**等 Sharon 明確說要部署才部署**。
- ESLint 有既有的 baseline 錯誤（TetrisView、puyo.ts 等），只要求「沒有新增錯誤」；懷疑時用 `git stash` 比對改動前的結果。

## 4. Sharon 的快捷指令
- **「補充上課單字」＋單字清單** → 完整流程見 `docs/handoff/流程_補充上課單字.md`。重點：
  1. 在 `src/data/words.ts`（自然發音）與 `src/data/sightWords.ts`（重要單字）grep 檢查；沒有的字**優先只加進 `words.ts`**，抓不到發音規律才放 `sightWords.ts`，同一字不要兩邊都加。
  2. 整份清單的 id 加進「本週單字」：存在 Vercel KV，透過正式站 API 讀寫。
     **v2.17.0 起 API 需要同步代碼**：`GET/POST https://phonics-flashcard.vercel.app/api/sync?code=sharon`（兒子的進度代碼是 `sharon`）。
     先 GET 最新狀態 → 把 id 併入 `curriculum[本週週一 YYYY-MM-DD]`（Set 去重）→ 其他欄位原封不動 → `updatedAt` 設現在 → POST → 再 GET 驗證。這是兒子真實的學習資料，不可覆蓋其他欄位。
  3. 新增字後要 commit＋部署（版本號 +0.0.1，寫進 DEPLOYMENTS.md）。
- 背景 agent 回報的「延伸優化建議」→ 只列待辦，下次先問 Sharon，不要自動做。

## 5. 架構重點
- **跨裝置同步**：`src/lib/sync.ts`＋`src/app/api/sync/route.ts`＋`src/lib/syncCode.ts`。KV key `phonics_sync_state:<代碼>`；last-write-wins by `updatedAt`，首次同步改比「哪邊有實質資料」。新增要同步的 localStorage 狀態要改 3 處：`SyncState`（sync.ts 與 route.ts 兩處，新欄位設 optional）、`applyServerState`、`pushNow`。`/sync` 頁面可看/換代碼。
- **localStorage 狀態**一律用 `useSyncExternalStore`；**getSnapshot 在資料沒變時必須回傳同一個參考**（用 raw string 比對快取），否則無限重渲染、手機當機 — 本專案反覆出現的地雷。
- 有 `Math.random()` 初始 state 的頁面用 `dynamic(() => import(...), { ssr: false })` 包在 `'use client'` 的 page.tsx。
- 會呼叫 `Math.random()`/`Date.now()` 的 helper 要放在**模組層級**（元件外），否則 `react-hooks/purity` lint 會擋。
- 不要在 setState updater 裡放副作用（StrictMode 會呼叫兩次 → 分數加倍等 bug）；需要即時最新值用 ref 鏡射。
- 音效統一用 `src/lib/sound.ts`（Web Audio）；語音用 Web Speech API，要「唸完再繼續」時用 Promise 版 `speakAsync`（onend/onerror＋8 秒保底）。
- 英文出題遊戲共用題目來源模型 `WordSourceKey`（`thisWeek`/`reinforcement`/`custom`/`phonics`/`sightWords`，定義在 `heroClimbSettings.ts`）；數學難度隊列共用 `ladderTierValue()`。
- 每個遊戲自己的 `xxxSettings.ts`（cache/subscribe/notify 模式）＋`/games/xxx/settings` 設定頁。設定頁說明文字裡的數字用 `{常數}` 插值，不要寫死。
- 圖片素材：`public/heroes/`（英雄去背）、`public/sprites/`（像素素材）。
- 已有 PWA（`src/app/manifest.ts`）。

## 6. 遊戲清單（`src/app/games/`）
space-racer（邏輯數列賽車）、block-puzzle（積木消除）、puyo（魔法氣泡）、tetris（俄羅斯方塊）、angry-cow（射擊吧！憤怒牛！）、klotski（動物華容道）、monster-dessert（怪獸點心店）、detective-venn（豬探長維恩圖）、schulte（舒爾特訓練）、hero-climb（小英雄下樓梯）、word-vault（小精靈大探險）、pixel-invaders（時空戰術隊）、coordinate-hunt（座標寶藏迷宮）、smart-grid、pizza-chef、puzzle、word-grid、hanzi。
Puyo/Tetris/Block Puzzle/Space Racer 每玩 2 分鐘跳英文單字測驗，連續答對 5 題才能繼續。

## 7. 測試小技巧
- 純邏輯（出題、計分）直接 `npx tsx` 呼叫函式驗證，不要從畫面截圖判斷。
- 這個環境的 Playwright resize 寬度會乘 2，先用 `window.innerWidth` 校驗（要 390px 實際寬度請求 195）。
- `next dev` 跑久了出現莫名 404 → 重開 dev server。

## 8. 已知待辦／小缺口
- Tetris 最高分只存在 `useState`，沒寫 localStorage（重新整理就歸零）。
- 動物華容道進度只存本機，沒有跨裝置同步；關卡數仍少。
- 怪獸點心店的甜點圖仍是 emoji 佔位，Sharon 之後可能補圖。
- Tetris 的消除特效分支（`lockAndAdvance` 內 `linesCleared > 0`）未曾實測觸發過。

## 9. 詳細紀錄
`docs/handoff/` 內是之前 Claude 的完整開發筆記（含每次改版原因、踩過的坑）：
- `開發紀錄_英雄學習平台.md`（主紀錄，記到 v2.15.0；之後版本看 DEPLOYMENTS.md）
- `開發紀錄_動物華容道.md`、`開發紀錄_憤怒牛.md`
- `流程_補充上課單字.md`（注意：寫於同步代碼上線前，API 現在要加 `?code=sharon`）
- `流程_部署規範.md`
