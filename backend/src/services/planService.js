import { getState } from '../data/store.js';
import { buildPlan } from './optimizer.js';

/**
 * Building a plan runs the battery dispatch ~40 times (once per candidate slot
 * in the shift search). That is cheap in absolute terms but not free, and the
 * dashboard asks for it on every poll. Memoise on everything the plan depends
 * on, so repeated reads are free and any state change invalidates it.
 */
let cache = { key: null, plan: null };

function cacheKey() {
  const s = getState();
  return JSON.stringify([
    s.scenarioId,
    s.currentHour,
    s.planApplied,
    s.schedule,
    s.curtailPct,
    s.battery.socPct,
  ]);
}

export function getPlan() {
  const key = cacheKey();
  if (cache.key === key && cache.plan) return cache.plan;
  const plan = buildPlan();
  cache = { key, plan };
  return plan;
}

export function invalidatePlan() {
  cache = { key: null, plan: null };
}
