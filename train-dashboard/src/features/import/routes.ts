import { Router } from 'express';
import { parseCsv } from './lib/parse-csv';
import { createClass } from '../classes';
import type { CsvRow } from './types';

const router = Router();

router.post('/preview', (req, res) => {
  const { csv } = req.body as { csv: string };
  if (!csv) return res.status(400).json({ error: 'csv field required' });
  const result = parseCsv(csv);
  res.json(result);
});

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
