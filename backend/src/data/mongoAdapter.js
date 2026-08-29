import { connectMongo } from '../config/db.js';
import {
  getState, hydrateHistory, hydrateSession, onMutate, seedHistory,
} from './store.js';

const SESSION_ID = process.env.SESSION_ID || 'default';
const WRITE_DEBOUNCE_MS = 400;

/**
 * Mongo persistence with automatic in-memory fallback.
 */
export async function initPersistence() {
  if (!process.env.MONGO_URI) {
    const count = seedHistory();
    return { mode: 'in-memory', seededReadings: count };
  }

  try {
    const conn = await connectMongo();
    if (!conn) {
      const count = seedHistory();
      return { mode: 'in-memory', seededReadings: count };
    }

    const { db, client } = conn;
    const readings = db.collection('energyReadings');
    const sessions = db.collection('sessions');

    // --- History: load what is stored, generate and store it if this is a cold start. ---
    let stored = await readings.find({}).sort({ dayIndex: 1, hour: 1 }).toArray();
    if (!stored.length) {
      seedHistory();
      const generated = getState().history;
      await readings.insertMany(generated.map((r) => ({ ...r })), { ordered: false });
      stored = generated;
    } else {
      hydrateHistory(stored.map(({ _id, ...r }) => r));
    }

    // --- Session: resume where the last run left off, if there was one. ---
    const session = await sessions.findOne({ sessionId: SESSION_ID });
    const resumed = hydrateSession(session);

    // --- Write through on every mutation, debounced so a slider drag is one write. ---
    let pending = null;
    const flush = async () => {
      pending = null;
      const s = getState();
      try {
        await sessions.updateOne(
          { sessionId: SESSION_ID },
          {
            $set: {
              sessionId: SESSION_ID,
              scenarioId: s.scenarioId,
              currentHour: s.currentHour,
              battery: s.battery,
              schedule: s.schedule,
              curtailPct: s.curtailPct,
              planApplied: s.planApplied,
              appliedPlanAt: s.appliedPlanAt,
              actionLog: s.actionLog,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (err) {
        console.error('mongo write failed:', err.message);
      }
    };

    onMutate(() => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(flush, WRITE_DEBOUNCE_MS);
    });

    const close = async () => {
      if (pending) { clearTimeout(pending); await flush(); }
      await client.close();
    };
    process.once('SIGINT', () => { close().finally(() => process.exit(0)); });
    process.once('SIGTERM', () => { close().finally(() => process.exit(0)); });

    return {
      mode: 'mongo',
      seededReadings: stored.length,
      resumedSession: resumed,
      database: db.databaseName,
    };
  } catch (err) {
    console.error('Mongo initialization failed, falling back to in-memory mode:', err.message);
    const count = seedHistory();
    return { mode: 'in-memory (fallback)', seededReadings: count, error: err.message };
  }
}
