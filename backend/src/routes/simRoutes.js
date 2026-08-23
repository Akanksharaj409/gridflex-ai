import { Router } from 'express';
import {
  getState, setScenario, setHour, advanceHour, reset, setBattery, logAction,
} from '../data/store.js';
import { invalidatePlan, getPlan } from '../services/planService.js';
import { SCENARIOS } from '../sim/simulator.js';
import { hourLabel } from '../utils/calculations.js';

const router = Router();

router.get('/state', (req, res) => {
  const s = getState();
  res.json({
    scenarioId: s.scenarioId,
    scenario: SCENARIOS[s.scenarioId],
    currentHour: s.currentHour,
    label: hourLabel(s.currentHour),
    planApplied: s.planApplied,
    appliedPlanAt: s.appliedPlanAt,
    battery: s.battery,
    schedule: s.schedule,
    curtailPct: s.curtailPct,
    scenarios: Object.values(SCENARIOS),
  });
});

router.post('/scenario', (req, res) => {
  const { scenarioId } = req.body ?? {};
  if (!SCENARIOS[scenarioId]) {
    return res.status(400).json({ error: `Unknown scenario. Try one of: ${Object.keys(SCENARIOS).join(', ')}` });
  }
  setScenario(scenarioId);
  invalidatePlan();
  logAction({ kind: 'scenario', summary: `Scenario switched to ${SCENARIOS[scenarioId].label}` });
  return res.json({ scenarioId, scenario: SCENARIOS[scenarioId], plan: getPlan() });
});

router.post('/hour', (req, res) => {
  const { hour } = req.body ?? {};
  if (hour == null || Number.isNaN(Number(hour))) {
    return res.status(400).json({ error: 'hour (0-23) is required' });
  }
  setHour(Number(hour));
  invalidatePlan();
  return res.json({ currentHour: getState().currentHour, label: hourLabel(getState().currentHour) });
});

router.post('/advance', (req, res) => {
  const by = Number(req.body?.by ?? 1);
  advanceHour(by);
  invalidatePlan();
  res.json({ currentHour: getState().currentHour, label: hourLabel(getState().currentHour) });
});

router.post('/battery', (req, res) => {
  const { socPct } = req.body ?? {};
  if (socPct == null) return res.status(400).json({ error: 'socPct is required' });
  setBattery({ socPct: Math.max(0, Math.min(100, Number(socPct))) });
  invalidatePlan();
  return res.json({ battery: getState().battery });
});

router.post('/reset', (req, res) => {
  reset();
  invalidatePlan();
  res.json({ ok: true, state: getState().scenarioId });
});

export default router;
