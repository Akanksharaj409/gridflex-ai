import { Router } from 'express';
import { getPlan, invalidatePlan } from '../services/planService.js';
import { flexibleLoadTable } from '../services/optimizer.js';
import { forecastAccuracy } from '../services/forecasting.js';
import { getState, applyPlan, revertPlan, logAction } from '../data/store.js';
import { NEIGHBOURHOOD, GRID, BATTERY } from '../config/system.js';
import { hourLabel, round } from '../utils/calculations.js';

const router = Router();

/** 24-hour forecast with uncertainty bands. */
router.get('/forecast', (req, res) => {
  const plan = getPlan();
  res.json({
    generatedAt: plan.generatedAt,
    currentHour: plan.currentHour,
    horizonHours: plan.horizonHours,
    rows: plan.forecast.map((f) => ({ ...f, label: hourLabel(f.hour) })),
    accuracy: forecastAccuracy(),
  });
});

/** Battery state plus the dispatch schedule the optimiser produced. */
router.get('/battery/status', (req, res) => {
  const plan = getPlan();
  const state = getState();
  res.json({
    config: BATTERY,
    live: {
      socPct: state.battery.socPct,
      socKwh: round((state.battery.socPct / 100) * BATTERY.capacityKwh, 1),
      reserveKwh: round((BATTERY.minReservePct / 100) * BATTERY.capacityKwh, 1),
      usableKwh: round(((state.battery.socPct - BATTERY.minReservePct) / 100) * BATTERY.capacityKwh, 1),
    },
    summary: plan.battery,
    schedule: plan.optimisedRows.map((r) => ({
      hour: r.hour,
      label: hourLabel(r.hour),
      chargeKw: r.batteryChargeKw,
      dischargeKw: r.batteryDischargeKw,
      socKwh: r.socKwh,
      socPct: r.socPct,
      mode: r.batteryChargeKw > 1 ? 'charging' : r.batteryDischargeKw > 1 ? 'discharging' : 'idle',
    })),
  });
});

/** Shortage windows, before and after optimisation. */
router.get('/shortage/prediction', (req, res) => {
  const plan = getPlan();
  res.json({
    currentHour: plan.currentHour,
    before: plan.shortagesBefore,
    after: plan.shortagesAfter,
    cleared: {
      peakKw: round(plan.shortagesBefore.peakShortageKw - plan.shortagesAfter.peakShortageKw, 1),
      energyKwh: round(plan.shortagesBefore.totalShortageKwh - plan.shortagesAfter.totalShortageKwh, 1),
    },
  });
});

/** Ordered action list plus the flexible-load table. */
router.get('/recommendations', (req, res) => {
  const plan = getPlan();
  res.json({
    generatedAt: plan.generatedAt,
    applied: plan.applied,
    actions: plan.actions,
    loads: flexibleLoadTable(plan),
    shifts: plan.shifts,
    curtailments: plan.curtailments,
  });
});

/** Accept the plan: the live schedule moves to the optimiser's schedule. */
router.post('/plan/apply', (req, res) => {
  const plan = getPlan();
  const applied = applyPlan({ schedule: plan.schedule, curtailPct: plan.curtailPct });
  invalidatePlan();
  logAction({
    kind: 'apply',
    summary: `Applied plan: ${plan.shifts.length} load shift(s), ${plan.curtailments.length} curtailment(s)`,
    peakReductionKw: plan.impact.savings.peakReductionKw,
    costSavingInr: plan.impact.savings.costInr,
  });
  res.json({ applied: true, ...applied, plan: getPlan() });
});

/** Roll back to the un-optimised schedule. */
router.post('/plan/revert', (req, res) => {
  revertPlan();
  invalidatePlan();
  logAction({ kind: 'revert', summary: 'Reverted to un-optimised schedule' });
  res.json({ applied: false, plan: getPlan() });
});

/** Move a single load by hand - the operator override. */
router.post('/load/shift', (req, res) => {
  const { loadId, startHour, curtailPct } = req.body ?? {};
  if (!loadId) return res.status(400).json({ error: 'loadId is required' });
  const patch = {};
  if (startHour != null) patch.schedule = { [loadId]: Number(startHour) };
  if (curtailPct != null) patch.curtailPct = { [loadId]: Number(curtailPct) };
  if (!patch.schedule && !patch.curtailPct) {
    return res.status(400).json({ error: 'startHour or curtailPct is required' });
  }
  applyPlan(patch);
  invalidatePlan();
  logAction({ kind: 'manual', summary: `Manual override on ${loadId}`, ...patch });
  return res.json({ ok: true, plan: getPlan() });
});

/** Impact metrics: the three cases side by side. */
router.get('/impact', (req, res) => {
  const plan = getPlan();
  res.json({
    cases: plan.cases,
    impact: plan.impact,
    annual: plan.annual,
    battery: plan.battery,
    method: {
      baseline: 'Do nothing: no load shifted, battery idle, every deficit met from the grid.',
      optimised: 'GridFlex: value-aware battery dispatch, load shifting searched against the real dispatch objective, curtailment only where the first two levers fall short.',
      note: 'Battery-only is reported separately so storage and demand response are not credited with the same kWh twice.',
    },
  });
});

/** Feeder-level view for the utility. */
router.get('/discom', (req, res) => {
  const plan = getPlan();
  const state = getState();
  const nowRow = plan.optimisedRows.find((r) => r.hour === state.currentHour) ?? plan.optimisedRows[0];
  const flexibleKwAvailable = round(
    plan.forecast.reduce((max, f) => Math.max(max, f.predictedFlexibleKw), 0),
    1,
  );
  return res.json({
    feederId: NEIGHBOURHOOD.feederId,
    community: NEIGHBOURHOOD.name,
    households: NEIGHBOURHOOD.households,
    currentLoadKw: nowRow.gridImportKw,
    forecastPeakKw: plan.shortagesBefore.peakGridImportKw,
    optimisedPeakKw: plan.shortagesAfter.peakGridImportKw,
    firmCapacityKw: NEIGHBOURHOOD.feederCapacityKw,
    sanctionedLoadKw: GRID.sanctionedLoadKw,
    peakWindowCapKw: GRID.peakWindowCapKw,
    peakRisk: plan.shortagesBefore.peakShortageKw > 0
      ? plan.shortagesBefore.windows.reduce((worst, w) => (w.severity === 'critical' ? 'critical' : worst), 'warning')
      : 'normal',
    demandResponsePotentialKw: flexibleKwAvailable,
    batteryAvailableKwh: round(((state.battery.socPct - BATTERY.minReservePct) / 100) * BATTERY.capacityKwh, 1),
    windows: plan.shortagesBefore.windows,
    hours: plan.shortagesAfter.hours,
    recommendedAction: plan.actions[0]?.title ?? 'No action required',
    residualRequestKw: plan.shortagesAfter.peakShortageKw,
  });
});

/** Alert feed derived from the shortage windows and the action list. */
router.get('/alerts', (req, res) => {
  const plan = getPlan();
  const state = getState();
  const alerts = [];

  for (const w of plan.shortagesBefore.windows) {
    const after = plan.shortagesAfter.hours
      .filter((h) => h.hour >= w.startHour && h.hour <= w.endHour)
      .reduce((m, h) => Math.max(m, h.shortageKw), 0);
    alerts.push({
      id: `shortage-${w.startHour}`,
      severity: w.severity,
      title: `${w.peakShortageKw} kW shortage forecast at ${w.label}`,
      body: `Grid import exceeds the ${GRID.peakWindowCapKw} kW cap for ${w.durationHours} hour(s). After optimisation the gap falls to ${round(after, 1)} kW.`,
      hour: w.startHour,
      resolved: after < 0.5,
    });
  }

  const nowRow = plan.optimisedRows.find((r) => r.hour === state.currentHour);
  if (nowRow && nowRow.curtailedRenewableKw > 5) {
    alerts.push({
      id: 'curtailment-now',
      severity: 'watch',
      title: `${nowRow.curtailedRenewableKw} kW of solar is being curtailed`,
      body: 'The battery is full or power-limited and local demand cannot absorb the surplus. Bringing flexible load forward would capture it.',
      hour: state.currentHour,
      resolved: false,
    });
  }

  if (state.battery.socPct <= BATTERY.minReservePct + 5) {
    alerts.push({
      id: 'battery-low',
      severity: 'warning',
      title: `Battery near reserve floor at ${state.battery.socPct}%`,
      body: `Discharge stops at ${BATTERY.minReservePct}%. Remaining deficits will be met from the grid.`,
      hour: state.currentHour,
      resolved: false,
    });
  }

  if (!alerts.length) {
    alerts.push({
      id: 'all-clear',
      severity: 'normal',
      title: 'Renewable generation and storage cover forecast demand',
      body: `No import-cap breach in the next ${plan.horizonHours} hours.`,
      hour: state.currentHour,
      resolved: true,
    });
  }

  const rank = { critical: 0, warning: 1, watch: 2, normal: 3 };
  res.json({
    alerts: alerts.sort((a, b) => rank[a.severity] - rank[b.severity]),
    log: state.actionLog,
  });
});

/** One call that fills the whole dashboard, so the main page is not chatty. */
router.get('/dashboard', (req, res) => {
  const plan = getPlan();
  const state = getState();
  const now = plan.optimisedRows.find((r) => r.hour === state.currentHour) ?? plan.optimisedRows[0];
  res.json({
    currentHour: state.currentHour,
    label: hourLabel(state.currentHour),
    scenarioId: state.scenarioId,
    applied: state.planApplied,
    now: {
      solarKw: now.solarKw,
      windKw: now.windKw,
      renewableKw: now.renewableKw,
      demandKw: now.demandKw,
      gridImportKw: now.gridImportKw,
      importCapKw: now.capKw,
      headroomKw: round(now.capKw - now.gridImportKw, 1),
      batterySocPct: now.socPct,
      batteryChargeKw: now.batteryChargeKw,
      batteryDischargeKw: now.batteryDischargeKw,
      tariffInrPerKwh: now.tariff,
    },
    shortage: {
      peakBeforeKw: plan.shortagesBefore.peakShortageKw,
      peakAfterKw: plan.shortagesAfter.peakShortageKw,
      worst: plan.shortagesBefore.worstHour,
      windows: plan.shortagesBefore.windows,
    },
    forecast: plan.forecast.map((f) => ({ ...f, label: hourLabel(f.hour) })),
    optimised: plan.optimisedRows.map((r) => ({ ...r, label: hourLabel(r.hour) })),
    baseline: plan.baselineRows.map((r) => ({ ...r, label: hourLabel(r.hour) })),
    actions: plan.actions,
    impact: plan.impact,
    cases: plan.cases,
    annual: plan.annual,
  });
});

export default router;
