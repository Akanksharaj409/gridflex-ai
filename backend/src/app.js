import express from 'express';
import cors from 'cors';
import energyRoutes from './routes/energyRoutes.js';
import planRoutes from './routes/planRoutes.js';
import simRoutes from './routes/simRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { getState } from './data/store.js';
import { initPersistence } from './data/mongoAdapter.js';

export async function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const storage = await initPersistence();

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      startedAt: getState().startedAt,
      storage,
      assistant: process.env.GEMINI_API_KEY ? 'gemini' : 'explainer',
    });
  });

  app.use('/api/energy', energyRoutes);
  app.use('/api', planRoutes);
  app.use('/api/sim', simRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return { app, storage };
}
