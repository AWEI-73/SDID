# train-dashboard Design Spec

**Date**: 2026-03-18
**Status**: Approved
**Comparison target**: `training-dashboard/` (original, module-based structure)

---

## Goal

本地端訓練計畫管理系統，讓辦訓人員能管理年度班別資料、追蹤流程節點、查看 Dashboard 總覽。

與 `training-dashboard` 相同需求範圍（iter-1 + iter-2），但採用 feature-first 架構重新打造，作為架構對照版本。

---

## Architecture

**Stack**: Node.js + Express + SQLite (better-sqlite3) + React + TypeScript + Vite + Tailwind CSS

**Pattern**: Monorepo，前後端同資料夾，一個 `npm start` 啟動。

**Structure**:

```
train-dashboard/
├── src/
│   ├── features/
│   │   ├── classes/          # 班別 CRUD
│   │   │   ├── types.ts
│   │   │   ├── service.ts    # DB 操作（只 import core/db）
│   │   │   ├── routes.ts     # Express routes
│   │   │   ├── components/   # React UI (ClassForm, ClassTable)
│   │   │   └── index.ts      # barrel: export types + service + routes
│   │   ├── nodes/            # 節點管控
│   │   │   ├── types.ts
│   │   │   ├── service.ts
│   │   │   ├── routes.ts
│   │   │   ├── lib/
│   │   │   │   ├── calc-node-date.ts   # startDate + offsetDays → actualDate
│   │   │   │   └── generate-ics.ts     # 產生 .ics 檔
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   ├── import/           # CSV 匯入 + 範本下載
│   │   │   ├── types.ts
│   │   │   ├── routes.ts
│   │   │   ├── lib/
│   │   │   │   ├── parse-csv.ts
│   │   │   │   └── generate-template.ts
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   └── dashboard/        # 總覽 + 待辦節點
│   │       ├── types.ts
│   │       ├── service.ts    # 可 import classes/ 和 nodes/ service
│   │       ├── routes.ts
│   │       ├── components/
│   │       └── index.ts
│   ├── core/
│   │   ├── db/
│   │   │   ├── init.ts       # SQLite 初始化 + schema migration
│   │   │   └── index.ts
│   │   └── types/
│   │       └── index.ts      # 跨 feature 共用型別
│   ├── app.ts                # Express app 組裝（mount all routes）
│   └── server.ts             # 入口點
├── client/
│   └── src/
│       ├── pages/            # React pages (router)
│       └── main.tsx
├── docs/superpowers/specs/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Dependency Rules

```
dashboard/service  →  classes/index.ts, nodes/index.ts  (OK, via barrel only)
classes/service    →  core/db                            (OK)
nodes/service      →  core/db                            (OK)
classes/*          →  nodes/*                            (FORBIDDEN)
nodes/*            →  classes/*                          (FORBIDDEN)
any feature        →  another feature's internals        (FORBIDDEN, use index.ts only)
```

---

## Data Model

### training_classes
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, PK |
| year_term | TEXT | 年度期別，e.g. 115-1 |
| code | TEXT | 班別代號 |
| name | TEXT | 班別名稱 |
| category | TEXT | 訓練類別 |
| training_type | TEXT | 授課方式 |
| start_date | TEXT | ISO date |
| end_date | TEXT | ISO date |
| days | INTEGER | 訓練天數 |
| location | TEXT | 訓練地點 |
| room | TEXT | 指定教室 |
| capacity | INTEGER | 人數 |
| status | TEXT | 開班狀態 |
| notes | TEXT | 備註 |
| created_at | TEXT | ISO datetime |

### class_nodes
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, PK |
| class_id | TEXT | FK → training_classes.id |
| name | TEXT | 節點名稱 |
| offset_days | INTEGER | 相對開訓日偏移（負數=開訓前） |
| notes | TEXT | |
| created_at | TEXT | |

### node_templates
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, PK |
| name | TEXT | 模板名稱 |
| is_default | INTEGER | 1=預設 |

> 模板為 seed-only（DB 初始化時塞入），本版本不提供管理 API。

### node_template_items
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, PK |
| template_id | TEXT | FK → node_templates.id |
| name | TEXT | 節點名稱 |
| offset_days | INTEGER | |
| sort_order | INTEGER | |

---

## Features

### F1: 班別管理 (classes)
- CRUD：新增、編輯、刪除班別
- 欄位：四大維度（基本資訊、時程、場地、狀態）
- API: `GET/POST /api/classes`, `PUT/DELETE /api/classes/:id`

### F2: CSV 匯入 + 範本下載 (import)
- 匯入：解析 CSV → 預覽 → 確認匯入 → 呼叫 `classes/index.ts` 的 createClass 批次寫入 DB
- 範本下載：純前端產生，包含所有欄位標頭 + 一行範例（不需後端）
- API: `POST /api/import/csv`（回傳預覽結果）, `POST /api/import/confirm`（批次寫入）

### F3: 節點管控 (nodes)
- 每個班別可新增多個節點
- 自動計算實際日期：`startDate + offsetDays`
- .ics 匯出（單一班別所有節點）
- DB 預設塞「基層主管班」7 個節點模板
- API: `GET/POST /api/classes/:id/nodes`, `PUT/DELETE /api/nodes/:id`, `GET /api/classes/:id/nodes/ics`

### F4: Dashboard (dashboard)
- 班別列表（篩選、排序、搜尋）
- 衝突旗標（教室衝突、時程重疊）
- 近期待辦節點（未來 7 天，顯示節點名稱、班別、實際日期、距今天數）
- API: `GET /api/dashboard/classes`, `GET /api/dashboard/upcoming-nodes`

---

## Error Handling

- API 統一回傳 `{ error: string }` + 對應 HTTP status
- 前端 fetch 失敗顯示 toast 通知
- CSV 解析錯誤逐行回報

---

## Out of Scope

- 使用者登入/權限
- Email/LINE 推播
- Google Calendar API 串接
- 行動版 APP
