import express from 'express';
import path from 'path';
import { initDatabase } from './shared/storage/init-database';
import { getClasses, getClassById } from './modules/Dashboard/services/get-classes';
import { createClass } from './modules/ClassManagement/services/create-class';
import { updateClass } from './modules/ClassManagement/services/update-class';
import { deleteClass } from './modules/ClassManagement/services/delete-class';
import { importCSV } from './modules/Import/services/import-csv';

// 初始化 DB
initDatabase();

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
