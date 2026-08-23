import express from 'express';
import cors from 'cors';
import energyRoutes from './routes/energyRoutes.js';
import planRoutes from './routes/planRoutes.js';
import simRoutes from './routes/simRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { seedHistory, getState } from './data/store.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const seeded = seedHistory();

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      startedAt: getState().startedAt,
      seededReadings: seeded,
      storage: process.env.MONGO_URI ? 'mongo' : 'in-memory',
      assistant: process.env.GEMINI_API_KEY ? 'gemini' : 'explainer',
    });
  });

  app.use('/api/energy', energyRoutes);
  app.use('/api', planRoutes);
  app.use('/api/sim', simRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
