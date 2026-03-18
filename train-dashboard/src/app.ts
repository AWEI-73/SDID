import express from 'express';
import cors from 'cors';
import { classesRouter } from './features/classes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/classes', classesRouter);

export default app;
