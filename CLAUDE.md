# 字卡學習平台（小朋友的英語自然發音字卡）

## 專案說明
幫 Sharon 4 歲半的兒子製作英語自然發音字卡工具。
可在瀏覽器互動練習，也可列印成 A4 紙張字卡。

## 技術架構
- **框架**：Next.js 14（App Router）
- **樣式**：Tailwind CSS
- **語言**：TypeScript
- **進度追蹤**：localStorage
- **部署目標**：Vercel

---

## 字卡設計規格

### 正面（英文面）
- 英文單字，音韻重點用 **紅色（text-red-500）＋粗體（font-bold）＋底線（underline）** 標示
- KK 音標
- 英文解釋（≤10 字，兒童程度）

### 反面（中文面）
- 大 Emoji（約 60% 面積）
- 繁體中文
- 注音符號（使用 HTML `<ruby>` 標籤）

範例：`<ruby>貓<rt>ㄇㄠ</rt></ruby>`

---

## 功能規格

### 列印功能
- A4 紙張，每頁 2 / 4 / 6 / 8 張可選
- 「列印正面」/ 「列印背面」分開按鈕
- 背面自動左右鏡像（雙面列印對齊用）
- 字卡間有虛線裁切線

### 學習進度追蹤（localStorage）
- ⭐ 可以念出來（canPronounce）
- 🌟 知道意思（canUnderstand）
- 首頁顯示各階段完成百分比

### 🔊 朗讀功能
- 使用瀏覽器內建 Web Speech API（`window.speechSynthesis`）
- `lang: 'en-US'`
- 不需要 API key，離線也可使用
- UI：喇叭圖示按鈕（🔊）

### 📝 小測驗功能
- **看圖選字**：顯示 Emoji，從四個選項選出正確英文單字
- **看字選圖**：顯示英文單字，從四個 Emoji 選出正確的

---

## 六階段課程架構（共約 467 字）

| 階段 | 主題 | 子分類 | 字數 |
|------|------|--------|------|
| Phase 1 | 短母音 | A / E / I / O / U | ~152 |
| Phase 2 | 複合輔音 | SH / CH / TH / CK / WH | ~70 |
| Phase 3 | 輔音連音 | L-blends / R-blends | ~70 |
| Phase 4 | Magic E | a_e / i_e / o_e / u_e | ~60 |
| Phase 5 | 母音組合 | AI / AY / EE / EA / OA / OW / OO | ~70 |
| Phase 6 | R 控母音 | AR / OR / ER / IR / UR | ~45 |

---

## 音韻標色規則（WordHighlight 元件）

| 階段 | highlight 值 | 標色對象 |
|------|-------------|---------|
| Phase 1 短母音 A | `a` | 單字中的 a |
| Phase 1 短母音 E | `e` | 單字中的 e |
| Phase 1 短母音 I | `i` | 單字中的 i |
| Phase 1 短母音 O | `o` | 單字中的 o |
| Phase 1 短母音 U | `u` | 單字中的 u |
| Phase 2 SH | `sh` | 單字中的 sh |
| Phase 2 CH | `ch` | 單字中的 ch |
| Phase 2 TH | `th` | 單字中的 th |
| Phase 2 CK | `ck` | 單字中的 ck |
| Phase 2 WH | `wh` | 單字中的 wh |
| Phase 3 L-blends | `bl`/`cl`/`fl`/`gl`/`pl`/`sl` | 各自的連音 |
| Phase 3 R-blends | `br`/`cr`/`dr`/`fr`/`gr`/`pr`/`tr` | 各自的連音 |
| Phase 4 a_e | `a_e` | 第一個 a ＋最後的 e（Magic E） |
| Phase 4 i_e | `i_e` | 第一個 i ＋最後的 e |
| Phase 4 o_e | `o_e` | 第一個 o ＋最後的 e |
| Phase 4 u_e | `u_e` | 第一個 u ＋最後的 e |
| Phase 5 AI | `ai` | ai |
| Phase 5 AY | `ay` | ay |
| Phase 5 EE | `ee` | ee |
| Phase 5 EA | `ea` | ea |
| Phase 5 OA | `oa` | oa |
| Phase 5 OW | `ow` | ow |
| Phase 5 OO | `oo` | oo |
| Phase 6 AR | `ar` | ar |
| Phase 6 OR | `or` | or |
| Phase 6 ER | `er` | er |
| Phase 6 IR | `ir` | ir |
| Phase 6 UR | `ur` | ur |

---

## 已完成的檔案

- `src/lib/types.ts` — Word 介面定義（含 zh、zhuyin、kk、en、emoji、phase、highlight 欄位）
- `src/lib/progress.ts` — localStorage 進度讀寫（loadProgress、saveProgress、updateWordProgress）
- `src/components/WordHighlight.tsx` — 音韻標色元件（支援一般 highlight 和 Magic E 雙標）

## 待完成的檔案（請繼續建置）

依此順序建立：
1. `src/data/words.ts` — 467 個單字完整資料（**最重要，分批寫入避免超限**）
2. `src/app/layout.tsx` — 導覽列（繁體中文），連結：首頁、瀏覽、列印、進度、測驗
3. `src/app/globals.css` — 加入 A4 列印 CSS（`.no-print`、`.print-only`、print media query）
4. `src/app/page.tsx` — 首頁（六階段進度卡片總覽）
5. `src/components/SpeakButton.tsx` — 朗讀按鈕（Web Speech API）
6. `src/components/FlashCard.tsx` — 翻牌元件（正面英文／反面圖片＋注音）
7. `src/components/PrintCard.tsx` — 列印用靜態字卡
8. `src/app/browse/page.tsx` — 瀏覽字卡（按階段篩選）
9. `src/app/print/page.tsx` — 列印設定頁面
10. `src/app/progress/page.tsx` — 學習進度頁面
11. `src/app/quiz/page.tsx` — 小測驗頁面

## Word 介面（types.ts）

```typescript
interface Word {
  id: string;          // e.g. "p1-short-a-cat"
  word: string;        // "cat"
  kk: string;          // "/kæt/"
  zh: string;          // "貓"（繁體中文）
  zhuyin: string;      // "ㄇㄠ"（注音）
  en: string;          // "a soft furry pet that meows"
  emoji: string;       // "🐱"
  phase: number;       // 1-6
  phaseLabel: string;  // "Phase 1：短母音"
  subPhase: string;    // "短母音 A (æ)"
  subPhaseKey: string; // "short-a"
  category: string;    // "animal"|"action"|"adjective"|"noun"
  highlight: string;   // "a"（音韻標色樣式）
}
```

## 注意事項
- 所有 UI 文字使用**繁體中文**
- 使用瀏覽器客戶端功能的元件需加 `'use client'`
- 完成後先給 Sharon 確認再部署到 Vercel
- Windows 部署指令：`npx vercel --prod`
