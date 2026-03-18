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
