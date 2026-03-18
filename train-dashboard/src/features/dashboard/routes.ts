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
