/**
 * Sanity harness for the engine. Runs every scenario end-to-end and asserts the
 * invariants that must never break: reserve floor respected, no negative grid
 * import, load constraints honoured, optimisation never worse than doing nothing.
 */
import { seedHistory, setScenario, setHour, getState, reset } from '../src/data/store.js';
import { buildPlan } from '../src/services/optimizer.js';
import { forecastAccuracy } from '../src/services/forecasting.js';
import { SCENARIOS } from '../src/sim/simulator.js';
import { FLEXIBLE_LOADS, BATTERY } from '../src/config/system.js';

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);
};

seedHistory();
console.log(`seeded ${getState().history.length} hourly readings`);
console.log('forecast backtest:', forecastAccuracy());
console.log('');

for (const id of Object.keys(SCENARIOS)) {
  reset();
  setScenario(id);
  setHour(12);
  const plan = buildPlan();
  const base = plan.cases[0];
  const full = plan.cases[2];

  console.log(`--- ${SCENARIOS[id].label} (${id}) ---`);
  console.log(`  shortage  ${plan.shortagesBefore.peakShortageKw} kW peak -> ${plan.shortagesAfter.peakShortageKw} kW`);
  console.log(`  peak grid ${base.peakGridImportKw} kW -> ${full.peakGridImportKw} kW  (${plan.impact.savings.peakReductionPct}%)`);
  console.log(`  cost      Rs ${base.costInr} -> Rs ${full.costInr}  (saves Rs ${plan.impact.savings.costInr})`);
  console.log(`  CO2       ${base.co2Kg} -> ${full.co2Kg} kg  (avoids ${plan.impact.savings.co2AvoidedKg} kg)`);
  console.log(`  renewable ${base.renewableUtilisationPct}% -> ${full.renewableUtilisationPct}% utilised`);
  console.log(`  shifts    ${plan.shifts.map((s) => `${s.loadId} ${s.fromHour}h->${s.toHour}h`).join(', ') || 'none'}`);
  console.log(`  curtail   ${plan.curtailments.map((c) => `${c.loadId} ${c.curtailPct}%`).join(', ') || 'none'}`);

  const minSoc = (BATTERY.minReservePct / 100) * BATTERY.capacityKwh;
  check('  SOC never below reserve', plan.optimisedRows.every((r) => r.socKwh >= minSoc - 0.5),
    `min ${Math.min(...plan.optimisedRows.map((r) => r.socKwh))} kWh vs floor ${minSoc}`);
  check('  SOC never above capacity', plan.optimisedRows.every((r) => r.socKwh <= BATTERY.capacityKwh + 0.5));
  check('  no negative grid import', plan.optimisedRows.every((r) => r.gridImportKw >= 0));
  check('  charge within power limit', plan.optimisedRows.every((r) => r.batteryChargeKw <= BATTERY.maxChargeKw + 0.5));
  check('  discharge within power limit', plan.optimisedRows.every((r) => r.batteryDischargeKw <= BATTERY.maxDischargeKw + 0.5));
  check('  cost not worse than doing nothing', full.costInr <= base.costInr + 1);
  check('  peak not worse than doing nothing', full.peakGridImportKw <= base.peakGridImportKw + 1);
  check('  shortage not worse than doing nothing', full.shortageKwh <= base.shortageKwh + 1);

  for (const s of plan.shifts) {
    const load = FLEXIBLE_LOADS.find((l) => l.id === s.loadId);
    check(`  ${s.loadId} window respected`,
      s.toHour >= load.earliestHour && s.toHour + load.durationHours - 1 <= load.latestFinishHour,
      `start ${s.toHour}, allowed ${load.earliestHour}-${load.latestFinishHour - load.durationHours + 1}`);
  }
  for (const c of plan.curtailments) {
    const load = FLEXIBLE_LOADS.find((l) => l.id === c.loadId);
    check(`  ${c.loadId} curtailment within comfort band`, c.curtailPct <= load.maxCurtailPct);
  }
  console.log('');
}

console.log(failures ? `${failures} CHECK(S) FAILED` : 'all checks passed');
process.exit(failures ? 1 : 0);
