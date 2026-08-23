import { BATTERY, SIM } from '../config/system.js';
import { simulateDay, defaultSchedule, SCENARIOS } from '../sim/simulator.js';

/**
 * In-memory state store. Everything the API serves is derived from here.
 * The shape mirrors the Mongo collections in `mongoAdapter.js`, so swapping
 * persistence in later is a drop-in change rather than a rewrite.
 */
const state = {
  startedAt: new Date().toISOString(),
  scenarioId: 'normal',
  currentHour: 14,
  autoPlay: false,
  battery: {
    ...BATTERY,
    socPct: BATTERY.startSocPct,
    chargingKw: 0,
    dischargingKw: 0,
  },
  /** Live (accepted) schedule for shiftable loads: { loadId: startHour }. */
  schedule: defaultSchedule(),
  /** Live curtailment: { loadId: percent }. */
  curtailPct: {},
  /** Whether the operator has accepted the current optimisation plan. */
  planApplied: false,
  appliedPlanAt: null,
  /** Seeded history: array of hourly readings, oldest first. */
  history: [],
  /** Rolling log of dispatch actions the engine has taken. */
  actionLog: [],
  /** Battery SOC trace for today, indexed by hour. */
  socTrace: new Array(24).fill(null),
};

export function seedHistory() {
  const readings = [];
  for (let d = -SIM.historyDays; d < 0; d += 1) {
    // History is always "normal-ish" weather - the forecaster learns the
    // neighbourhood's habits from it, not the scenario we are about to run.
    const scenario = d % 5 === 0 ? 'cloudy-day' : 'normal';
    readings.push(...simulateDay(d, { scenarioId: scenario }));
  }
  state.history = readings;
  return readings.length;
}

export function getState() {
  return state;
}

export function setScenario(scenarioId) {
  if (!SCENARIOS[scenarioId]) throw new Error(`Unknown scenario: ${scenarioId}`);
  state.scenarioId = scenarioId;
  state.planApplied = false;
  state.appliedPlanAt = null;
  state.actionLog = [];
  return state.scenarioId;
}

export function setHour(hour) {
  state.currentHour = ((Math.round(hour) % 24) + 24) % 24;
  return state.currentHour;
}

export function advanceHour(by = 1) {
  return setHour(state.currentHour + by);
}

/** Today's 24h simulation under the live schedule + curtailment. */
export function today() {
  return simulateDay(0, {
    scenarioId: state.scenarioId,
    schedule: state.planApplied ? state.schedule : defaultSchedule(),
    curtailPct: state.planApplied ? state.curtailPct : {},
  });
}

/** Today's 24h simulation with nothing shifted - the do-nothing baseline. */
export function todayBaseline() {
  return simulateDay(0, { scenarioId: state.scenarioId });
}

export function currentReading() {
  return today().find((r) => r.hour === state.currentHour);
}

export function applyPlan({ schedule, curtailPct }) {
  if (schedule) state.schedule = { ...state.schedule, ...schedule };
  if (curtailPct) state.curtailPct = { ...state.curtailPct, ...curtailPct };
  state.planApplied = true;
  state.appliedPlanAt = new Date().toISOString();
  return { schedule: state.schedule, curtailPct: state.curtailPct };
}

export function revertPlan() {
  state.schedule = defaultSchedule();
  state.curtailPct = {};
  state.planApplied = false;
  state.appliedPlanAt = null;
  state.actionLog = [];
}

export function setBattery(patch) {
  Object.assign(state.battery, patch);
  return state.battery;
}

export function setSocTrace(trace) {
  state.socTrace = trace;
}

export function logAction(entry) {
  state.actionLog.unshift({ at: new Date().toISOString(), ...entry });
  state.actionLog = state.actionLog.slice(0, 60);
  return entry;
}

export function reset() {
  state.scenarioId = 'normal';
  state.currentHour = 14;
  state.battery = { ...BATTERY, socPct: BATTERY.startSocPct, chargingKw: 0, dischargingKw: 0 };
  revertPlan();
  state.socTrace = new Array(24).fill(null);
}
