import express from 'express';
import cors from 'cors';
import { classesRouter } from './features/classes';
import { nodesRouter, updateNode, deleteNode } from './features/nodes';
import { importRouter } from './features/import';
import { Router } from 'express';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/classes', classesRouter);
app.use('/api/classes/:classId/nodes', nodesRouter);

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
app.use('/api/import', importRouter);

export default app;
