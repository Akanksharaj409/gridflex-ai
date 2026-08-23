import { FLEXIBLE_LOADS } from '../config/system.js';
import { hourLabel, importCapAt, round } from '../utils/calculations.js';
import { flexibleProfile, defaultSchedule } from '../sim/simulator.js';
import { buildForecast } from './forecasting.js';
import { dispatchBattery, dispatchIdle } from './batteryOptimization.js';
import { detectShortages } from './shortageDetection.js';
import { proposeShifts, proposeCurtailment, objectiveOf } from './loadShifting.js';
import { scoreCase, compareCases, annualise } from './impactCalculator.js';
import { getState } from '../data/store.js';

const MAX_ITERATIONS = 8;

/** Compose a demand+generation profile for a candidate schedule. */
function profileFor(forecast, schedule, curtailPct) {
  const flex = flexibleProfile(schedule, curtailPct);
  return forecast.map((f) => ({
    hour: f.hour,
    step: f.step,
    tempC: f.tempC,
    cloudCover: f.cloudCover,
    inflexibleKw: f.predictedInflexibleKw,
    flexibleKw: flex.total[f.hour],
    demandKw: round(f.predictedInflexibleKw + flex.total[f.hour], 1),
    solarKw: f.predictedSolarKw,
    windKw: f.predictedWindKw,
    renewableKw: f.predictedRenewableKw,
    capKw: importCapAt(f.hour),
  }));
}

/**
 * The optimisation loop.
 *
 *   dispatch battery -> look for loads worth moving -> move them -> dispatch
 *   again (the best battery move changes once the load moves) -> repeat.
 *
 * Curtailment is applied only at the end, on hours the first two levers could
 * not clear. Comfort is the last thing we spend.
 */
export function buildPlan({ horizonHours } = {}) {
  const state = getState();
  const forecast = buildForecast({ horizonHours });
  const battery = state.battery;

  // Reference case: nothing shifted, battery idle.
  const baseProfile = profileFor(forecast, defaultSchedule(), {});
  const doNothing = dispatchIdle(baseProfile, battery);

  // Battery-only case: isolates what storage alone buys you.
  const batteryOnly = dispatchBattery(baseProfile, battery);

  // Full case: storage + demand response, solved iteratively.
  const schedule = { ...defaultSchedule() };
  const curtailPct = {};
  let dispatch = dispatchBattery(profileFor(forecast, schedule, curtailPct), battery);
  const shifts = [];

  // Candidate evaluator: run the real dispatch for a trial schedule and read
  // the objective back. This is what makes the search honest.
  const evaluate = (trial) => objectiveOf(
    dispatchBattery(profileFor(forecast, trial, curtailPct), battery).rows,
  );

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const proposals = proposeShifts(schedule, evaluate, { currentHour: state.currentHour });
    if (!proposals.length) break;
    // Take the single best move, then re-dispatch. Applying every proposal at
    // once would send all three loads into the same surplus hour and rebuild
    // the peak somewhere else.
    const p = proposals.sort((a, b) => b.estimatedSaving - a.estimatedSaving)[0];
    schedule[p.loadId] = p.toHour;
    const existing = shifts.findIndex((s) => s.loadId === p.loadId);
    if (existing >= 0) {
      shifts[existing] = { ...p, fromHour: shifts[existing].fromHour, fromLabel: shifts[existing].fromLabel };
    } else {
      shifts.push(p);
    }
    dispatch = dispatchBattery(profileFor(forecast, schedule, curtailPct), battery);
  }

  // Drop no-op shifts that later iterations walked back to the original hour.
  const netShifts = shifts.filter((s) => s.toHour !== s.fromHour);

  const curtailments = proposeCurtailment(dispatch.rows);
  for (const c of curtailments) curtailPct[c.loadId] = c.curtailPct;
  if (curtailments.length) {
    dispatch = dispatchBattery(profileFor(forecast, schedule, curtailPct), battery);
  }

  const shortagesBefore = detectShortages(doNothing.rows);
  const shortagesAfter = detectShortages(dispatch.rows);

  const caseDoNothing = scoreCase(doNothing.rows, 'Do nothing');
  const caseBattery = scoreCase(batteryOnly.rows, 'Battery only');
  const caseFull = scoreCase(dispatch.rows, 'GridFlex: storage + demand response');
  const comparison = compareCases(caseDoNothing, caseFull);

  return {
    generatedAt: new Date().toISOString(),
    currentHour: state.currentHour,
    scenarioId: state.scenarioId,
    horizonHours: forecast.length,
    forecast,
    baselineRows: doNothing.rows,
    optimisedRows: dispatch.rows,
    battery: { ...dispatch.summary, live: battery },
    schedule,
    curtailPct,
    shifts: netShifts,
    curtailments,
    shortagesBefore,
    shortagesAfter,
    actions: buildActions({ dispatch, netShifts, curtailments, shortagesAfter }),
    cases: [caseDoNothing, caseBattery, caseFull],
    impact: comparison,
    annual: annualise(comparison.savings),
    applied: state.planApplied,
  };
}

/**
 * Group rows into contiguous runs in *step* order, not hour order.
 *
 * The horizon wraps past midnight, so taking the first and last matching hour
 * and printing them as a range produces nonsense like "14:00-13:00" when the
 * battery charges this afternoon and again tomorrow morning.
 */
function contiguousWindows(rows, predicate) {
  const windows = [];
  let open = null;
  for (const r of rows) {
    if (predicate(r)) {
      if (!open) open = { startHour: r.hour, endHour: r.hour, rows: [] };
      open.endHour = r.hour;
      open.rows.push(r);
    } else if (open) {
      windows.push(open);
      open = null;
    }
  }
  if (open) windows.push(open);
  return windows;
}

/** "14:00-17:00" for one window, "14:00-17:00 and 1 more window" for several. */
function windowLabel(windows) {
  if (!windows.length) return '';
  const [first] = windows;
  const base = `${hourLabel(first.startHour)}-${hourLabel(first.endHour + 1)}`;
  if (windows.length === 1) return base;
  return `${base} and ${windows.length - 1} more window${windows.length > 2 ? 's' : ''}`;
}

/** Turn the plan into the ordered, human-readable instruction list. */
function buildActions({ dispatch, netShifts, curtailments, shortagesAfter }) {
  const actions = [];

  const chargeWindows = contiguousWindows(dispatch.rows, (r) => r.batteryChargeKw > 1);
  if (chargeWindows.length) {
    const kwh = round(
      chargeWindows.reduce((a, w) => a + w.rows.reduce((b, r) => b + r.batteryChargeKw, 0), 0), 1,
    );
    actions.push({
      id: 'battery-charge',
      type: 'battery',
      priority: 1,
      title: `Charge battery ${kwh} kWh from surplus solar`,
      detail: `Absorb surplus across ${windowLabel(chargeWindows)}, which would otherwise be curtailed.`,
      window: [chargeWindows[0].startHour, chargeWindows[0].endHour],
      valueKwh: kwh,
    });
  }

  const dischargeWindows = contiguousWindows(dispatch.rows, (r) => r.batteryDischargeKw > 1);
  if (dischargeWindows.length) {
    const kwh = round(
      dischargeWindows.reduce((a, w) => a + w.rows.reduce((b, r) => b + r.batteryDischargeKw, 0), 0), 1,
    );
    actions.push({
      id: 'battery-discharge',
      type: 'battery',
      priority: 2,
      title: `Discharge ${kwh} kWh across ${windowLabel(dischargeWindows)}`,
      detail: `Hold charge until ${hourLabel(dischargeWindows[0].startHour)}, then support demand down to the ${dispatch.summary.reserveKwh} kWh reserve floor.`,
      window: [dischargeWindows[0].startHour, dischargeWindows[0].endHour],
      valueKwh: kwh,
    });
  }

  for (const s of netShifts) {
    actions.push({
      id: `shift-${s.loadId}`,
      type: 'shift',
      priority: 3,
      title: `Move ${s.label} to ${s.toLabel}`,
      detail: `${s.energyMovedKwh} kWh moved out of ${s.fromLabel}. Constraint respected: ${s.constraint}.`,
      window: [s.toHour, s.toHour + s.durationHours - 1],
      valueInr: s.estimatedSaving,
    });
  }

  for (const c of curtailments) {
    actions.push({
      id: `curtail-${c.loadId}`,
      type: 'curtail',
      priority: 4,
      title: `Trim ${c.label} by ${c.curtailPct}%`,
      detail: `${c.reliefKw} kW of relief in the hours still over the import cap, worst at ${c.worstHourLabel}. ${c.constraint}.`,
      window: [Math.min(...c.hours), Math.max(...c.hours)],
      valueKw: c.reliefKw,
    });
  }

  // Only escalate a residual big enough to be worth a call to the utility.
  if (shortagesAfter.peakShortageKw >= 5) {
    actions.push({
      id: 'grid-support',
      type: 'grid',
      priority: 5,
      title: `Request ${shortagesAfter.peakShortageKw} kW of grid support`,
      detail: 'Local levers are exhausted. Raise a demand-response request with the DISCOM for the residual gap.',
      window: shortagesAfter.worstHour ? [shortagesAfter.worstHour.hour, shortagesAfter.worstHour.hour] : null,
      valueKw: shortagesAfter.peakShortageKw,
    });
  }

  if (!actions.length) {
    actions.push({
      id: 'hold',
      type: 'hold',
      priority: 9,
      title: 'No action required',
      detail: 'Renewable generation and storage cover forecast demand across the whole horizon.',
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

/** The flexible-load table shown on the Demand Response page. */
export function flexibleLoadTable(plan) {
  const state = getState();
  return FLEXIBLE_LOADS.map((load) => {
    const shift = plan.shifts.find((s) => s.loadId === load.id);
    const curtail = plan.curtailments.find((c) => c.loadId === load.id);
    const currentStart = state.schedule[load.id] ?? load.defaultStartHour;
    let recommendation = { kind: 'none', label: 'No change needed' };
    if (shift) {
      recommendation = { kind: 'shift', toHour: shift.toHour, label: shift.toLabel, saving: shift.estimatedSaving };
    } else if (curtail) {
      recommendation = { kind: 'curtail', pct: curtail.curtailPct, label: `Reduce ${curtail.curtailPct}%`, reliefKw: curtail.reliefKw };
    }
    return {
      ...load,
      currentStartHour: load.kind === 'shiftable' ? currentStart : null,
      currentLabel: load.kind === 'shiftable'
        ? `${hourLabel(currentStart)}-${hourLabel(currentStart + load.durationHours)}`
        : `${hourLabel(load.activeHours[0])}-${hourLabel(load.activeHours[load.activeHours.length - 1] + 1)}`,
      recommendation,
      appliedCurtailPct: state.curtailPct[load.id] ?? 0,
    };
  });
}
