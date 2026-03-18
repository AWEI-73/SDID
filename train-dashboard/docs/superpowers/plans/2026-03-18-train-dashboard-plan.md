# train-dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本地端訓練計畫管理系統，feature-first 架構，含班別 CRUD、CSV 匯入、節點管控、Dashboard 總覽。

**Architecture:** Feature-first monorepo。每個 feature 自成一體，只透過 `index.ts` barrel 對外暴露。`dashboard` 可 import 其他 feature 的 index，其他 feature 間禁止互相 import。

**Tech Stack:** Node.js + Express + SQLite (better-sqlite3) + React 18 + TypeScript + Vite + Tailwind CSS

**Spec:** `train-dashboard/docs/superpowers/specs/2026-03-18-train-dashboard-design.md`

---

## Chunk 1: Project Setup + Core DB + Classes Feature

### Task 0: Project Scaffold

**Files:**
- Create: `train-dashboard/package.json`
- Create: `train-dashboard/tsconfig.json`
- Create: `train-dashboard/tsconfig.client.json`
- Create: `train-dashboard/vite.config.ts`
- Create: `train-dashboard/.gitignore`

- [ ] **Step 1: Init package.json**

```json
{
  "name": "train-dashboard",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch src/server.ts",
    "dev:client": "vite",
    "build": "tsc && vite build",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@types/uuid": "^9.0.7",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "concurrently": "^8.2.2",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}
```

- [ ] **Step 2: Create tsconfig.json (server)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/client", "node_modules"]
}
```

- [ ] **Step 3: Create tsconfig.client.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src/client"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: { outDir: '../../dist/client' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-shm
*.db-wal
.env
```

- [ ] **Step 6: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 7: Create postcss.config.js**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd train-dashboard && npm install
```

- [ ] **Step 9: Commit**

```bash
git add train-dashboard/
git commit -m "chore(train-dashboard): project scaffold"
```

---

### Task 1: Core DB

**Files:**
- Create: `train-dashboard/src/core/db/init.ts`
- Create: `train-dashboard/src/core/db/index.ts`
- Create: `train-dashboard/src/core/types/index.ts`

- [ ] **Step 1: Create core types**

`src/core/types/index.ts`:
```typescript
export interface TrainingClass {
  id: string;
  year_term: string;
  code: string;
  name: string;
  category: string;
  training_type: string;
  start_date: string;
  end_date: string;
  days: number;
  location: string;
  room: string;
  capacity: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface ClassNode {
  id: string;
  class_id: string;
  name: string;
  offset_days: number;
  notes: string;
  created_at: string;
}

export interface NodeTemplate {
  id: string;
  name: string;
  is_default: number;
}

export interface NodeTemplateItem {
  id: string;
  template_id: string;
  name: string;
  offset_days: number;
  sort_order: number;
}
```

- [ ] **Step 2: Create DB init**

`src/core/db/init.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), 'train-dashboard.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    seedTemplates(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_classes (
      id TEXT PRIMARY KEY,
      year_term TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      training_type TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER DEFAULT 0,
      location TEXT DEFAULT '',
      room TEXT DEFAULT '',
      capacity INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_nodes (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES training_classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS node_template_items (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES node_templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);
}

function seedTemplates(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM node_templates WHERE is_default = 1').get();
  if (existing) return;

  const templateId = 'default-template-001';
  db.prepare('INSERT INTO node_templates (id, name, is_default) VALUES (?, ?, 1)')
    .run(templateId, '基層主管班');

  const items = [
    { name: '調訓函發文', offset_days: -30 },
    { name: '報名截止', offset_days: -14 },
    { name: '名單確認', offset_days: -7 },
    { name: '教材準備', offset_days: -3 },
    { name: '開訓典禮', offset_days: 0 },
    { name: '結訓典禮', offset_days: 4 },
    { name: '成績繳交', offset_days: 14 },
  ];

  const stmt = db.prepare(
    'INSERT INTO node_template_items (id, template_id, name, offset_days, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  items.forEach((item, i) => {
    stmt.run(`tpl-item-${i + 1}`, templateId, item.name, item.offset_days, i);
  });
}
```

- [ ] **Step 3: Create DB index barrel**

`src/core/db/index.ts`:
```typescript
export { getDb } from './init';
```

- [ ] **Step 4: Verify DB init runs without error**

```bash
cd train-dashboard && npx tsx -e "import('./src/core/db/init.ts').then(m => { m.getDb(); console.log('DB init ok'); })"
# Expected: DB init ok
```

- [ ] **Step 5: Commit**

```bash
git add train-dashboard/src/core/
git commit -m "feat(train-dashboard): core DB init + schema + seed templates"
```

---

### Task 2: Classes Feature (Backend)

**Files:**
- Create: `train-dashboard/src/features/classes/types.ts`
- Create: `train-dashboard/src/features/classes/service.ts`
- Create: `train-dashboard/src/features/classes/routes.ts`
- Create: `train-dashboard/src/features/classes/index.ts`

- [ ] **Step 1: Create classes types**

`src/features/classes/types.ts`:
```typescript
import type { TrainingClass } from '../../core/types';

export type { TrainingClass };

export interface CreateClassInput {
  year_term: string;
  code: string;
  name: string;
  category?: string;
  training_type?: string;
  start_date: string;
  end_date: string;
  days?: number;
  location?: string;
  room?: string;
  capacity?: number;
  status?: string;
  notes?: string;
}

export interface UpdateClassInput extends Partial<CreateClassInput> {}
```

- [ ] **Step 2: Create classes service**

`src/features/classes/service.ts`:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../core/db';
import type { TrainingClass, CreateClassInput, UpdateClassInput } from './types';

export function getAllClasses(): TrainingClass[] {
  return getDb().prepare('SELECT * FROM training_classes ORDER BY start_date ASC').all() as TrainingClass[];
}

export function getClassById(id: string): TrainingClass | undefined {
  return getDb().prepare('SELECT * FROM training_classes WHERE id = ?').get(id) as TrainingClass | undefined;
}

export function createClass(input: CreateClassInput): TrainingClass {
  const id = uuidv4();
  const now = new Date().toISOString();
  const row = { id, ...input, created_at: now };
  getDb().prepare(`
    INSERT INTO training_classes (id, year_term, code, name, category, training_type,
      start_date, end_date, days, location, room, capacity, status, notes, created_at)
    VALUES (@id, @year_term, @code, @name, @category, @training_type,
      @start_date, @end_date, @days, @location, @room, @capacity, @status, @notes, @created_at)
  `).run({ category: '', training_type: '', days: 0, location: '', room: '', capacity: 0, status: 'planned', notes: '', ...row });
  return getClassById(id)!;
}

export function updateClass(id: string, input: UpdateClassInput): TrainingClass | undefined {
  const existing = getClassById(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...input };
  getDb().prepare(`
    UPDATE training_classes SET year_term=@year_term, code=@code, name=@name,
      category=@category, training_type=@training_type, start_date=@start_date,
      end_date=@end_date, days=@days, location=@location, room=@room,
      capacity=@capacity, status=@status, notes=@notes
    WHERE id=@id
  `).run(updated);
  return getClassById(id);
}

export function deleteClass(id: string): boolean {
  const result = getDb().prepare('DELETE FROM training_classes WHERE id = ?').run(id);
  return result.changes > 0;
}
```

- [ ] **Step 3: Create classes routes**

`src/features/classes/routes.ts`:
```typescript
import { Router } from 'express';
import * as service from './service';

const router = Router();

router.get('/', (req, res) => {
  res.json(service.getAllClasses());
});

router.get('/:id', (req, res) => {
  const cls = service.getClassById(req.params.id);
  if (!cls) return res.status(404).json({ error: 'Not found' });
  res.json(cls);
});

router.post('/', (req, res) => {
  try {
    const cls = service.createClass(req.body);
    res.status(201).json(cls);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const cls = service.updateClass(req.params.id, req.body);
  if (!cls) return res.status(404).json({ error: 'Not found' });
  res.json(cls);
});

router.delete('/:id', (req, res) => {
  const ok = service.deleteClass(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 4: Create classes barrel**

`src/features/classes/index.ts`:
```typescript
export * from './types';
export * from './service';
export { default as classesRouter } from './routes';
```

- [ ] **Step 5: Commit**

```bash
git add train-dashboard/src/features/classes/
git commit -m "feat(train-dashboard): classes feature backend (CRUD service + routes)"
```

---

### Task 3: Express App + Server Entry

**Files:**
- Create: `train-dashboard/src/app.ts`
- Create: `train-dashboard/src/server.ts`

- [ ] **Step 1: Create app.ts**

`src/app.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { classesRouter } from './features/classes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/classes', classesRouter);

export default app;
```

- [ ] **Step 2: Create server.ts**

`src/server.ts`:
```typescript
import app from './app';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Smoke test server starts**

```bash
cd train-dashboard && npx tsx src/server.ts &
sleep 2
curl http://localhost:3001/api/classes
# Expected: []
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add train-dashboard/src/app.ts train-dashboard/src/server.ts
git commit -m "feat(train-dashboard): express app entry + classes route mounted"
```

---

## Chunk 2: Nodes Feature + Import Feature

### Task 4: Nodes Feature (Backend)

**Files:**
- Create: `train-dashboard/src/features/nodes/types.ts`
- Create: `train-dashboard/src/features/nodes/service.ts`
- Create: `train-dashboard/src/features/nodes/lib/calc-node-date.ts`
- Create: `train-dashboard/src/features/nodes/lib/generate-ics.ts`
- Create: `train-dashboard/src/features/nodes/routes.ts`
- Create: `train-dashboard/src/features/nodes/index.ts`

- [ ] **Step 1: Create nodes types**

`src/features/nodes/types.ts`:
```typescript
import type { ClassNode, NodeTemplate, NodeTemplateItem } from '../../core/types';

export type { ClassNode, NodeTemplate, NodeTemplateItem };

export interface CreateNodeInput {
  name: string;
  offset_days: number;
  notes?: string;
}

export interface UpdateNodeInput extends Partial<CreateNodeInput> {}

export interface NodeWithDate extends ClassNode {
  actual_date: string | null;  // computed from class start_date + offset_days
}
```

- [ ] **Step 2: Create calc-node-date lib**

`src/features/nodes/lib/calc-node-date.ts`:
```typescript
/**
 * Calculate actual date from class start_date and offset_days.
 * offset_days < 0 means before start_date.
 */
export function calcNodeDate(startDate: string, offsetDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}
```

- [ ] **Step 3: Create generate-ics lib**

`src/features/nodes/lib/generate-ics.ts`:
```typescript
import type { NodeWithDate } from '../types';

export function generateIcs(className: string, nodes: NodeWithDate[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//train-dashboard//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const node of nodes) {
    if (!node.actual_date) continue;
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtStart = node.actual_date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${node.id}@train-dashboard`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:${className} - ${node.name}`,
      `DESCRIPTION:${node.notes || ''}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
```

- [ ] **Step 4: Create nodes service**

`src/features/nodes/service.ts`:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../core/db';
import { calcNodeDate } from './lib/calc-node-date';
import { generateIcs } from './lib/generate-ics';
import type { ClassNode, CreateNodeInput, UpdateNodeInput, NodeWithDate } from './types';

export function getNodesByClass(classId: string, startDate?: string): NodeWithDate[] {
  const nodes = getDb()
    .prepare('SELECT * FROM class_nodes WHERE class_id = ? ORDER BY offset_days ASC')
    .all(classId) as ClassNode[];

  return nodes.map(n => ({
    ...n,
    actual_date: startDate ? calcNodeDate(startDate, n.offset_days) : null,
  }));
}

export function createNode(classId: string, input: CreateNodeInput): ClassNode {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO class_nodes (id, class_id, name, offset_days, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, classId, input.name, input.offset_days, input.notes ?? '', now);
  return getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode;
}

export function updateNode(id: string, input: UpdateNodeInput): ClassNode | undefined {
  const existing = getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...input };
  getDb().prepare(
    'UPDATE class_nodes SET name=?, offset_days=?, notes=? WHERE id=?'
  ).run(updated.name, updated.offset_days, updated.notes, id);
  return getDb().prepare('SELECT * FROM class_nodes WHERE id = ?').get(id) as ClassNode;
}

export function deleteNode(id: string): boolean {
  const result = getDb().prepare('DELETE FROM class_nodes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getIcsForClass(classId: string, className: string, startDate: string): string {
  const nodes = getNodesByClass(classId, startDate);
  return generateIcs(className, nodes);
}

export function getTemplates() {
  return getDb().prepare('SELECT * FROM node_templates').all();
}

export function applyTemplate(classId: string, templateId: string): ClassNode[] {
  const items = getDb()
    .prepare('SELECT * FROM node_template_items WHERE template_id = ? ORDER BY sort_order ASC')
    .all(templateId) as any[];
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    'INSERT INTO class_nodes (id, class_id, name, offset_days, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const item of items) {
    stmt.run(uuidv4(), classId, item.name, item.offset_days, '', now);
  }
  return getDb().prepare('SELECT * FROM class_nodes WHERE class_id = ?').all(classId) as ClassNode[];
}
```

- [ ] **Step 5: Create nodes routes**

`src/features/nodes/routes.ts`:
```typescript
import { Router } from 'express';
import * as service from './service';
import { getClassById } from '../classes';

const router = Router({ mergeParams: true });

// GET /api/classes/:classId/nodes
router.get('/', (req, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  res.json(service.getNodesByClass(cls.id, cls.start_date));
});

// POST /api/classes/:classId/nodes
router.post('/', (req, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  try {
    const node = service.createNode(cls.id, req.body);
    res.status(201).json(node);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/classes/:classId/nodes/ics
router.get('/ics', (req, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const ics = service.getIcsForClass(cls.id, cls.name, cls.start_date);
  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="${cls.name}.ics"`);
  res.send(ics);
});

// POST /api/classes/:classId/nodes/apply-template
router.post('/apply-template', (req, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const nodes = service.applyTemplate(cls.id, req.body.templateId);
  res.json(nodes);
});

export default router;
```

- [ ] **Step 6: Create nodes barrel**

`src/features/nodes/index.ts`:
```typescript
export * from './types';
export * from './service';
export { default as nodesRouter } from './routes';
```

- [ ] **Step 7: Mount nodes router in app.ts**

`src/app.ts` — add nodes route:
```typescript
import { nodesRouter } from './features/nodes';
// ...
app.use('/api/classes/:classId/nodes', nodesRouter);
```

Also add standalone node update/delete:
```typescript
import { Router } from 'express';
import { updateNode, deleteNode } from './features/nodes';
const nodeRouter = Router();
nodeRouter.put('/:id', (req, res) => {
  const n = updateNode(req.params.id, req.body);
  if (!n) return res.status(404).json({ error: 'Not found' });
  res.json(n);
});
nodeRouter.delete('/:id', (req, res) => {
  const ok = deleteNode(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
app.use('/api/nodes', nodeRouter);
```

- [ ] **Step 8: Commit**

```bash
git add train-dashboard/src/features/nodes/ train-dashboard/src/app.ts
git commit -m "feat(train-dashboard): nodes feature (CRUD + ICS + template apply)"
```

---

### Task 5: Import Feature (Backend + CSV lib)

**Files:**
- Create: `train-dashboard/src/features/import/types.ts`
- Create: `train-dashboard/src/features/import/lib/parse-csv.ts`
- Create: `train-dashboard/src/features/import/lib/generate-template.ts`
- Create: `train-dashboard/src/features/import/routes.ts`
- Create: `train-dashboard/src/features/import/index.ts`

- [ ] **Step 1: Create import types**

`src/features/import/types.ts`:
```typescript
export interface CsvRow {
  year_term: string;
  code: string;
  name: string;
  category?: string;
  training_type?: string;
  start_date: string;
  end_date: string;
  days?: string;
  location?: string;
  room?: string;
  capacity?: string;
  status?: string;
  notes?: string;
}

export interface ParseResult {
  valid: CsvRow[];
  errors: Array<{ row: number; message: string }>;
}
```

- [ ] **Step 2: Create parse-csv lib**

`src/features/import/lib/parse-csv.ts`:
```typescript
import type { CsvRow, ParseResult } from '../types';

const REQUIRED_FIELDS = ['year_term', 'code', 'name', 'start_date', 'end_date'] as const;

export function parseCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { valid: [], errors: [{ row: 0, message: 'Empty file' }] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const valid: CsvRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    const missing = REQUIRED_FIELDS.filter(f => !row[f]);
    if (missing.length > 0) {
      errors.push({ row: i + 1, message: `Missing required fields: ${missing.join(', ')}` });
      continue;
    }
    valid.push(row as unknown as CsvRow);
  }

  return { valid, errors };
}
```

- [ ] **Step 3: Create generate-template lib**

`src/features/import/lib/generate-template.ts`:
```typescript
export const CSV_HEADERS = [
  'year_term', 'code', 'name', 'category', 'training_type',
  'start_date', 'end_date', 'days', 'location', 'room',
  'capacity', 'status', 'notes'
];

export const CSV_EXAMPLE_ROW = [
  '115-1', 'A001', '基層主管班', '核心技能', '實體',
  '2026-04-01', '2026-04-05', '5', '台北訓練中心', 'A101',
  '30', 'planned', '備註範例'
];

export function generateCsvTemplate(): string {
  return [CSV_HEADERS.join(','), CSV_EXAMPLE_ROW.join(',')].join('\n');
}
```

- [ ] **Step 4: Create import routes**

`src/features/import/routes.ts`:
```typescript
import { Router } from 'express';
import { parseCsv } from './lib/parse-csv';
import { createClass } from '../classes';
import type { CsvRow } from './types';

const router = Router();

// POST /api/import/preview — parse CSV, return preview
router.post('/preview', (req, res) => {
  const { csv } = req.body as { csv: string };
  if (!csv) return res.status(400).json({ error: 'csv field required' });
  const result = parseCsv(csv);
  res.json(result);
});

// POST /api/import/confirm — batch create classes
router.post('/confirm', (req, res) => {
  const { rows } = req.body as { rows: CsvRow[] };
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });
  const created = rows.map(row => createClass({
    ...row,
    days: row.days ? parseInt(row.days) : 0,
    capacity: row.capacity ? parseInt(row.capacity) : 0,
  }));
  res.status(201).json({ count: created.length, classes: created });
});

export default router;
```

- [ ] **Step 5: Create import barrel**

`src/features/import/index.ts`:
```typescript
export * from './types';
export * from './lib/generate-template';
export { default as importRouter } from './routes';
```

- [ ] **Step 6: Mount import router in app.ts**

```typescript
import { importRouter } from './features/import';
// ...
app.use('/api/import', importRouter);
```

- [ ] **Step 7: Commit**

```bash
git add train-dashboard/src/features/import/ train-dashboard/src/app.ts
git commit -m "feat(train-dashboard): import feature (CSV parse + batch create)"
```

---

## Chunk 3: Dashboard Feature + React Client

### Task 6: Dashboard Feature (Backend)

**Files:**
- Create: `train-dashboard/src/features/dashboard/types.ts`
- Create: `train-dashboard/src/features/dashboard/service.ts`
- Create: `train-dashboard/src/features/dashboard/routes.ts`
- Create: `train-dashboard/src/features/dashboard/index.ts`

- [ ] **Step 1: Create dashboard types**

`src/features/dashboard/types.ts`:
```typescript
import type { TrainingClass } from '../classes';
import type { NodeWithDate } from '../nodes';

export interface ClassWithConflict extends TrainingClass {
  hasRoomConflict: boolean;
  hasDateConflict: boolean;
}

export interface UpcomingNode extends NodeWithDate {
  class_name: string;
  days_until: number;
}

export interface DashboardFilters {
  search?: string;
  status?: string;
  year_term?: string;
}
```

- [ ] **Step 2: Create dashboard service**

`src/features/dashboard/service.ts`:
```typescript
import { getAllClasses } from '../classes';
import { getNodesByClass } from '../nodes';
import type { ClassWithConflict, UpcomingNode, DashboardFilters } from './types';

export function getClassesWithConflicts(filters: DashboardFilters = {}): ClassWithConflict[] {
  const allClasses = getAllClasses();
  let classes = allClasses;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    classes = classes.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }
  if (filters.status) classes = classes.filter(c => c.status === filters.status);
  if (filters.year_term) classes = classes.filter(c => c.year_term === filters.year_term);

  return classes.map(cls => {
    const hasRoomConflict = cls.room
      ? allClasses.some(other =>
          other.id !== cls.id &&
          other.room === cls.room &&
          other.start_date <= cls.end_date &&
          other.end_date >= cls.start_date
        )
      : false;

    const hasDateConflict = allClasses.some(other =>
      other.id !== cls.id &&
      other.start_date <= cls.end_date &&
      other.end_date >= cls.start_date
    );

    return { ...cls, hasRoomConflict, hasDateConflict };
  });
}

export function getUpcomingNodes(days = 7): UpcomingNode[] {
  const classes = getAllClasses();
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  const todayStr = today.toISOString().split('T')[0];
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const result: UpcomingNode[] = [];

  for (const cls of classes) {
    const nodes = getNodesByClass(cls.id, cls.start_date);
    for (const node of nodes) {
      if (!node.actual_date) continue;
      if (node.actual_date >= todayStr && node.actual_date <= cutoffStr) {
        const daysUntil = Math.ceil(
          (new Date(node.actual_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        result.push({ ...node, class_name: cls.name, days_until: daysUntil });
      }
    }
  }

  return result.sort((a, b) => a.actual_date!.localeCompare(b.actual_date!));
}
```

> Note: Conflict detection runs against `allClasses` (full dataset) before filtering, so excluded classes are still considered as conflict partners.

- [ ] **Step 3: Create dashboard routes**

`src/features/dashboard/routes.ts`:
```typescript
import { Router } from 'express';
import * as service from './service';

const router = Router();

router.get('/classes', (req, res) => {
  const filters = {
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    year_term: req.query.year_term as string | undefined,
  };
  res.json(service.getClassesWithConflicts(filters));
});

router.get('/upcoming-nodes', (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 7;
  res.json(service.getUpcomingNodes(days));
});

export default router;
```

- [ ] **Step 4: Create dashboard barrel**

`src/features/dashboard/index.ts`:
```typescript
export * from './types';
export * from './service';
export { default as dashboardRouter } from './routes';
```

- [ ] **Step 5: Mount dashboard router in existing app.ts**

In `src/app.ts` (existing file from Task 3), add:
```typescript
import { dashboardRouter } from './features/dashboard';
// ...
app.use('/api/dashboard', dashboardRouter);
```

- [ ] **Step 6: Commit**

```bash
git add train-dashboard/src/features/dashboard/ train-dashboard/src/app.ts
git commit -m "feat(train-dashboard): dashboard feature (conflict detection + upcoming nodes)"
```

---

### Task 7: React Client Entry + Layout

**Files:**
- Create: `train-dashboard/src/client/index.html`
- Create: `train-dashboard/src/client/src/main.tsx`
- Create: `train-dashboard/src/client/src/index.css`
- Create: `train-dashboard/src/client/src/App.tsx`
- Create: `train-dashboard/src/client/src/components/Layout.tsx`

> Note: `src/client/` is the Vite root (per `vite.config.ts`: `root: 'src/client'`). All client paths are relative to `train-dashboard/`.

- [ ] **Step 1: Create index.html**

`src/client/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>訓練計畫管理系統</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create index.css**

`src/client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Create main.tsx**

`src/client/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 4: Create Layout component**

`src/client/src/components/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/classes', label: '班別管理' },
  { to: '/import', label: 'CSV 匯入' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex gap-6">
        <span className="font-semibold text-gray-800 mr-4">訓練計畫管理</span>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create App.tsx with routes**

`src/client/src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ClassesPage from './pages/ClassesPage'
import ImportPage from './pages/ImportPage'
import NodeManagementPage from './pages/NodeManagementPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:classId/nodes" element={<NodeManagementPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add train-dashboard/src/client/
git commit -m "feat(train-dashboard): React client entry + layout + routing"
```

---

### Task 8: Dashboard Page + Classes Page + Import Page + Node Management Page

**Files:**
- Create: `train-dashboard/src/client/src/pages/DashboardPage.tsx`
- Create: `train-dashboard/src/client/src/pages/ClassesPage.tsx`
- Create: `train-dashboard/src/client/src/pages/ImportPage.tsx`
- Create: `train-dashboard/src/client/src/pages/NodeManagementPage.tsx`

- [ ] **Step 1: Create DashboardPage**

`src/client/src/pages/DashboardPage.tsx`:
```tsx
import { useEffect, useState } from 'react'

interface UpcomingNode {
  id: string; name: string; class_name: string; actual_date: string; days_until: number;
}
interface ClassItem {
  id: string; name: string; code: string; year_term: string;
  start_date: string; end_date: string; status: string;
  hasRoomConflict: boolean; hasDateConflict: boolean;
}

export default function DashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingNode[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/classes?search=${search}`)
      .then(r => r.json()).then(setClasses)
      .catch(() => setError('載入班別失敗'))
    fetch('/api/dashboard/upcoming-nodes')
      .then(r => r.json()).then(setUpcoming)
      .catch(() => setError('載入待辦節點失敗'))
  }, [search])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h2 className="font-medium mb-2">近期待辦節點（7天內）</h2>
          <ul className="space-y-1 text-sm">
            {upcoming.map(n => (
              <li key={n.id} className="flex gap-3">
                <span className="text-gray-500">{n.actual_date}</span>
                <span>{n.class_name}</span>
                <span className="font-medium">{n.name}</span>
                <span className="text-blue-600">{n.days_until === 0 ? '今天' : `${n.days_until}天後`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <input
          className="border rounded px-3 py-1.5 text-sm mb-3 w-64"
          placeholder="搜尋班別名稱或代號..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">年度期別</th>
              <th className="p-2 border">班別代號</th>
              <th className="p-2 border">班別名稱</th>
              <th className="p-2 border">開始日期</th>
              <th className="p-2 border">結束日期</th>
              <th className="p-2 border">狀態</th>
              <th className="p-2 border">衝突</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(cls => (
              <tr key={cls.id} className="hover:bg-gray-50">
                <td className="p-2 border">{cls.year_term}</td>
                <td className="p-2 border">{cls.code}</td>
                <td className="p-2 border">{cls.name}</td>
                <td className="p-2 border">{cls.start_date}</td>
                <td className="p-2 border">{cls.end_date}</td>
                <td className="p-2 border">{cls.status}</td>
                <td className="p-2 border">
                  {cls.hasRoomConflict && <span className="text-red-500 mr-1">教室衝突</span>}
                  {cls.hasDateConflict && <span className="text-orange-500">時程重疊</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ClassesPage (CRUD + node management link)**

`src/client/src/pages/ClassesPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface TrainingClass {
  id: string; year_term: string; code: string; name: string;
  start_date: string; end_date: string; status: string; room: string; location: string;
}

const EMPTY: Partial<TrainingClass> = {
  year_term: '', code: '', name: '', start_date: '', end_date: '',
  status: 'planned', room: '', location: ''
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [form, setForm] = useState<Partial<TrainingClass>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    fetch('/api/classes')
      .then(r => r.json()).then(setClasses)
      .catch(() => setError('載入班別失敗'))

  useEffect(() => { load() }, [])

  const save = async () => {
    const method = editing ? 'PUT' : 'POST'
    const url = editing ? `/api/classes/${editing}` : '/api/classes'
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    }).catch(() => setError('儲存失敗'))
    setForm(EMPTY); setEditing(null); setShowForm(false); load()
  }

  const del = async (id: string) => {
    if (!confirm('確定刪除？')) return
    await fetch(`/api/classes/${id}`, { method: 'DELETE' })
      .catch(() => setError('刪除失敗'))
    load()
  }

  const edit = (cls: TrainingClass) => { setForm(cls); setEditing(cls.id); setShowForm(true) }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">班別管理</h1>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">新增班別</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {showForm && (
        <div className="bg-white border rounded p-4 grid grid-cols-2 gap-3 text-sm">
          {(['year_term','code','name','start_date','end_date','location','room','status'] as const).map(f => (
            <label key={f} className="flex flex-col gap-1">
              <span className="text-gray-600">{f}</span>
              <input className="border rounded px-2 py-1" value={(form as any)[f] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
            </label>
          ))}
          <div className="col-span-2 flex gap-2">
            <button onClick={save} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">儲存</button>
            <button onClick={() => setShowForm(false)} className="border px-3 py-1.5 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">年度期別</th><th className="p-2 border">代號</th>
            <th className="p-2 border">名稱</th><th className="p-2 border">開始</th>
            <th className="p-2 border">結束</th><th className="p-2 border">狀態</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id} className="hover:bg-gray-50">
              <td className="p-2 border">{cls.year_term}</td>
              <td className="p-2 border">{cls.code}</td>
              <td className="p-2 border">{cls.name}</td>
              <td className="p-2 border">{cls.start_date}</td>
              <td className="p-2 border">{cls.end_date}</td>
              <td className="p-2 border">{cls.status}</td>
              <td className="p-2 border flex gap-2">
                <button onClick={() => edit(cls)} className="text-blue-600 hover:underline">編輯</button>
                <button onClick={() => del(cls.id)} className="text-red-500 hover:underline">刪除</button>
                <Link to={`/classes/${cls.id}/nodes`} className="text-green-600 hover:underline">節點</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create ImportPage**

`src/client/src/pages/ImportPage.tsx`:
```tsx
import { useState } from 'react'

const TEMPLATE_HEADERS = 'year_term,code,name,category,training_type,start_date,end_date,days,location,room,capacity,status,notes'
const TEMPLATE_EXAMPLE = '115-1,A001,基層主管班,核心技能,實體,2026-04-01,2026-04-05,5,台北訓練中心,A101,30,planned,備註範例'

export default function ImportPage() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<{ valid: any[]; errors: any[] } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const downloadTemplate = () => {
    const blob = new Blob([[TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'import-template.csv'; a.click()
  }

  const previewCsv = async () => {
    setError(null)
    await fetch('/api/import/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText })
    })
      .then(r => r.json()).then(setPreview)
      .catch(() => setError('預覽失敗，請確認 CSV 格式'))
  }

  const confirmImport = async () => {
    if (!preview) return
    setError(null)
    await fetch('/api/import/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.valid })
    })
      .then(r => r.json())
      .then(result => {
        setDone(`成功匯入 ${result.count} 筆班別`)
        setPreview(null); setCsvText('')
      })
      .catch(() => setError('匯入失敗'))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">CSV 匯入</h1>
      <button onClick={downloadTemplate} className="border px-3 py-1.5 rounded text-sm">下載 CSV 範本</button>

      <textarea className="w-full border rounded p-2 text-sm font-mono h-40"
        placeholder="貼上 CSV 內容..." value={csvText}
        onChange={e => { setCsvText(e.target.value); setPreview(null) }} />

      <button onClick={previewCsv} disabled={!csvText}
        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">預覽</button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {preview && (
        <div className="space-y-2 text-sm">
          <p className="text-green-700">有效資料：{preview.valid.length} 筆</p>
          {preview.errors.length > 0 && (
            <ul className="text-red-600">
              {preview.errors.map((e: any, i: number) => <li key={i}>第 {e.row} 行：{e.message}</li>)}
            </ul>
          )}
          {preview.valid.length > 0 && (
            <button onClick={confirmImport} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">確認匯入</button>
          )}
        </div>
      )}

      {done && <p className="text-green-700 font-medium">{done}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create NodeManagementPage**

`src/client/src/pages/NodeManagementPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

interface NodeItem {
  id: string; name: string; offset_days: number; notes: string; actual_date: string | null;
}

export default function NodeManagementPage() {
  const { classId } = useParams<{ classId: string }>()
  const [nodes, setNodes] = useState<NodeItem[]>([])
  const [form, setForm] = useState({ name: '', offset_days: 0, notes: '' })
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetch(`/api/classes/${classId}/nodes`)
      .then(r => r.json()).then(setNodes)
      .catch(() => setError('載入節點失敗'))
  }

  useEffect(() => { if (classId) load() }, [classId])

  const addNode = async () => {
    setError(null)
    await fetch(`/api/classes/${classId}/nodes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .catch(() => setError('新增節點失敗'))
    setForm({ name: '', offset_days: 0, notes: '' }); load()
  }

  const delNode = async (id: string) => {
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
      .catch(() => setError('刪除節點失敗'))
    load()
  }

  const downloadIcs = () => {
    window.open(`/api/classes/${classId}/nodes/ics`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/classes" className="text-gray-500 hover:text-gray-700 text-sm">← 返回班別管理</Link>
          <h1 className="text-xl font-semibold">節點管控</h1>
        </div>
        <button onClick={downloadIcs} className="border px-3 py-1.5 rounded text-sm">匯出 .ics</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2 text-sm">
        <input className="border rounded px-2 py-1" placeholder="節點名稱"
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input type="number" className="border rounded px-2 py-1 w-24" placeholder="偏移天數"
          value={form.offset_days} onChange={e => setForm(p => ({ ...p, offset_days: parseInt(e.target.value) }))} />
        <button onClick={addNode} disabled={!form.name}
          className="bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-50">新增節點</button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">節點名稱</th>
            <th className="p-2 border">偏移天數</th>
            <th className="p-2 border">實際日期</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(n => (
            <tr key={n.id} className="hover:bg-gray-50">
              <td className="p-2 border">{n.name}</td>
              <td className="p-2 border">{n.offset_days}</td>
              <td className="p-2 border">{n.actual_date ?? '-'}</td>
              <td className="p-2 border">
                <button onClick={() => delNode(n.id)} className="text-red-500 hover:underline">刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add train-dashboard/src/client/src/pages/
git commit -m "feat(train-dashboard): React pages (Dashboard, Classes, Import, NodeManagement)"
```

---

### Task 9: Final Integration Smoke Test

- [ ] **Step 1: Start server + client**

```bash
cd train-dashboard && npm run dev
# Server: http://localhost:3001
# Client: http://localhost:5173
```

- [ ] **Step 2: Verify API endpoints**

```bash
curl http://localhost:3001/api/classes          # []
curl http://localhost:3001/api/dashboard/classes # []
curl http://localhost:3001/api/dashboard/upcoming-nodes # []
```

- [ ] **Step 3: Manual smoke test in browser**

- Open http://localhost:5173
- Dashboard 頁面載入無錯誤
- 班別管理：新增一筆班別，確認出現在列表
- 班別管理：點「節點」進入節點管控頁，新增節點，確認實際日期計算正確
- 節點管控：點「匯出 .ics」，確認下載 .ics 檔案
- CSV 匯入：下載範本，貼回預覽，確認匯入
- Dashboard：確認新增的班別出現，近期待辦節點區塊顯示正確

- [ ] **Step 4: Final commit**

```bash
git add train-dashboard/
git commit -m "feat(train-dashboard): complete MVP - feature-first architecture"
```
