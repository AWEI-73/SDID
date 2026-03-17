import express from 'express';
import path from 'path';
import { initDatabaseV2 } from './shared/storage/init-database-v2';
import { getClasses, getClassById } from './modules/Dashboard/services/get-classes';
import { createClass } from './modules/ClassManagement/services/create-class';
import { updateClass } from './modules/ClassManagement/services/update-class';
import { deleteClass } from './modules/ClassManagement/services/delete-class';
import { importCSV } from './modules/Import/services/import-csv';
import { getNodesByClass } from './modules/NodeManagement/services/get-nodes-by-class';
import { createNode } from './modules/NodeManagement/services/create-node';
import { updateNode } from './modules/NodeManagement/services/update-node';
import { deleteNode } from './modules/NodeManagement/services/delete-node';
import { getUpcomingNodes } from './modules/Dashboard/services/get-upcoming-nodes';
import { generateIcs } from './modules/NodeManagement/lib/generate-ics';
import { calcNodeDate } from './modules/NodeManagement/lib/calc-node-date';
import { getDatabase } from './shared/storage/init-database';

// 初始化 DB（v2 含 class_nodes 遷移）
initDatabaseV2();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

// GET /api/classes
app.get('/api/classes', (_req, res) => {
  try {
    const classes = getClasses();
    res.json(classes);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/classes/:id
app.get('/api/classes/:id', (req, res) => {
  try {
    const cls = getClassById(Number(req.params.id));
    if (!cls) return res.status(404).json({ error: '找不到班別' });
    res.json(cls);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/classes
app.post('/api/classes', (req, res) => {
  try {
    const cls = createClass(req.body);
    res.status(201).json(cls);
  } catch (e) {
    res.status(400).send((e as Error).message);
  }
});

// PUT /api/classes/:id
app.put('/api/classes/:id', (req, res) => {
  try {
    const cls = updateClass(Number(req.params.id), req.body);
    res.json(cls);
  } catch (e) {
    res.status(400).send((e as Error).message);
  }
});

// DELETE /api/classes/:id
app.delete('/api/classes/:id', (req, res) => {
  try {
    deleteClass(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    res.status(400).send((e as Error).message);
  }
});

// POST /api/import/csv
app.post('/api/import/csv', express.text({ type: 'text/plain', limit: '10mb' }), (req, res) => {
  try {
    const result = importCSV(req.body as string);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// GET /api/classes/:id/nodes
app.get('/api/classes/:id/nodes', (req, res) => {
  try {
    const nodes = getNodesByClass(Number(req.params.id));
    res.json(nodes);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/classes/:id/nodes
app.post('/api/classes/:id/nodes', (req, res) => {
  try {
    const node = createNode({ ...req.body, classId: Number(req.params.id) });
    res.status(201).json(node);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// PUT /api/nodes/:id
app.put('/api/nodes/:id', (req, res) => {
  try {
    const node = updateNode(Number(req.params.id), req.body);
    res.json(node);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/nodes/:id
app.delete('/api/nodes/:id', (req, res) => {
  try {
    deleteNode(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// GET /api/nodes/upcoming
app.get('/api/nodes/upcoming', (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const nodes = getUpcomingNodes(days);
    res.json(nodes);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/classes/:id/nodes/ics
app.get('/api/classes/:id/nodes/ics', (req, res) => {
  try {
    const db = getDatabase();
    const cls = db.prepare('SELECT class_name, start_date FROM training_classes WHERE id = ?').get(Number(req.params.id)) as { class_name: string; start_date: string } | undefined;
    if (!cls) return res.status(404).json({ error: '找不到班別' });
    const nodes = getNodesByClass(Number(req.params.id));
    const items = nodes.map(n => ({ name: n.name, dueDate: calcNodeDate(cls.start_date, n.offsetDays) }));
    const ics = generateIcs(cls.class_name, items);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nodes-${req.params.id}.ics"`);
    res.send(ics);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 靜態檔案（生產環境）
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
