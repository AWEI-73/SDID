import { Router, Request } from 'express';
import * as service from './service';
import { getClassById } from '../classes';

interface ClassParams { classId: string }

const router = Router({ mergeParams: true });

router.get('/', (req: Request<ClassParams>, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  res.json(service.getNodesByClass(cls.id, cls.start_date));
});

router.post('/', (req: Request<ClassParams>, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  try {
    const node = service.createNode(cls.id, req.body);
    res.status(201).json(node);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/ics', (req: Request<ClassParams>, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const ics = service.getIcsForClass(cls.id, cls.name, cls.start_date);
  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="${cls.name}.ics"`);
  res.send(ics);
});

router.post('/apply-template', (req: Request<ClassParams>, res) => {
  const cls = getClassById(req.params.classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const nodes = service.applyTemplate(cls.id, req.body.templateId);
  res.json(nodes);
});

export default router;
