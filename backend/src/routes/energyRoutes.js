import { Router } from 'express';
import {
  getState, today, todayBaseline, currentReading,
} from '../data/store.js';
import { splitAcrossUnits, SCENARIOS } from '../sim/simulator.js';
import { getPlan } from '../services/planService.js';
import {
  NEIGHBOURHOOD, SOLAR, WIND, BATTERY, GRID, TARIFF, EMISSIONS, FLEXIBLE_LOADS,
} from '../config/system.js';
import { hourLabel, tariffAt, tariffBandAt, importCapAt, round } from '../utils/calculations.js';

const router = Router();

/** Everything the frontend needs to render labels, limits and legends. */
router.get('/config', (req, res) => {
  res.json({
    neighbourhood: NEIGHBOURHOOD,
    solar: SOLAR,
    wind: WIND,
    battery: BATTERY,
    grid: GRID,
    tariff: TARIFF,
    emissions: EMISSIONS,
    flexibleLoads: FLEXIBLE_LOADS,
    scenarios: Object.values(SCENARIOS),
  });
});

/** Instantaneous snapshot at the simulated clock. */
router.get('/current', (req, res) => {
  const state = getState();
  const reading = currentReading();
  const plan = getPlan();
  const row = plan.optimisedRows.find((r) => r.hour === state.currentHour) ?? plan.optimisedRows[0];
  res.json({
    hour: state.currentHour,
    label: hourLabel(state.currentHour),
    scenario: SCENARIOS[state.scenarioId],
    tariffInrPerKwh: tariffAt(state.currentHour),
    tariffBand: tariffBandAt(state.currentHour),
    importCapKw: importCapAt(state.currentHour),
    ...reading,
    gridImportKw: row.gridImportKw,
    batteryChargeKw: row.batteryChargeKw,
    batteryDischargeKw: row.batteryDischargeKw,
    batterySocPct: row.socPct,
    batterySocKwh: row.socKwh,
    headroomKw: round(importCapAt(state.currentHour) - row.gridImportKw, 1),
  });
});

/** The full simulated day, with the do-nothing baseline alongside. */
router.get('/today', (req, res) => {
  res.json({
    hours: today().map((r) => ({ ...r, label: hourLabel(r.hour) })),
    baseline: todayBaseline().map((r) => ({ ...r, label: hourLabel(r.hour) })),
  });
});

/** Seeded history the forecaster learns from. */
router.get('/history', (req, res) => {
  const days = Math.max(1, Math.min(14, Number(req.query.days) || 7));
  const { history } = getState();
  const cutoff = -days;
  res.json({
    days,
    readings: history.filter((r) => r.dayIndex >= cutoff),
  });
});

/** Per-unit breakdown for the neighbourhood map. */
router.get('/neighbourhood', (req, res) => {
  const state = getState();
  const reading = currentReading();
  const units = splitAcrossUnits(reading.demandKw, state.currentHour);
  res.json({
    hour: state.currentHour,
    label: hourLabel(state.currentHour),
    totalDemandKw: reading.demandKw,
    inflexibleKw: reading.inflexibleKw,
    flexibleKw: reading.flexibleKw,
    solarKw: reading.solarKw,
    windKw: reading.windKw,
    households: NEIGHBOURHOOD.households,
    units,
  });
});

export default router;
