import { EMISSIONS } from '../config/system.js';
import { importCapAt, tariffAt, round } from '../utils/calculations.js';

/** Roll a set of dispatch rows up into the numbers a stakeholder cares about. */
export function scoreCase(rows, label) {
  let costInr = 0;
  let gridKwh = 0;
  let renewableKwh = 0;
  let curtailedKwh = 0;
  let servedByBatteryKwh = 0;
  let shortageKwh = 0;
  let peakGridImportKw = 0;
  let peakDemandKw = 0;

  for (const r of rows) {
    costInr += r.gridImportKw * tariffAt(r.hour);
    gridKwh += r.gridImportKw;
    renewableKwh += r.renewableKw;
    curtailedKwh += r.curtailedRenewableKw ?? 0;
    servedByBatteryKwh += r.batteryDischargeKw ?? 0;
    shortageKwh += Math.max(0, r.gridImportKw - importCapAt(r.hour));
    peakGridImportKw = Math.max(peakGridImportKw, r.gridImportKw);
    peakDemandKw = Math.max(peakDemandKw, r.demandKw);
  }

  const renewableUsedKwh = renewableKwh - curtailedKwh;
  const co2Kg = gridKwh * EMISSIONS.gridKgPerKwh + renewableUsedKwh * EMISSIONS.solarKgPerKwh;

  return {
    label,
    costInr: round(costInr, 0),
    gridImportKwh: round(gridKwh, 1),
    renewableGeneratedKwh: round(renewableKwh, 1),
    renewableUsedKwh: round(renewableUsedKwh, 1),
    curtailedKwh: round(curtailedKwh, 1),
    renewableUtilisationPct: round(renewableKwh > 0 ? (renewableUsedKwh / renewableKwh) * 100 : 100, 1),
    servedByBatteryKwh: round(servedByBatteryKwh, 1),
    shortageKwh: round(shortageKwh, 1),
    peakGridImportKw: round(peakGridImportKw, 1),
    peakDemandKw: round(peakDemandKw, 1),
    co2Kg: round(co2Kg, 1),
  };
}

/** Delta of `optimised` against `baseline`, in absolute and percentage terms. */
export function compareCases(baseline, optimised) {
  const delta = (a, b) => round(a - b, 1);
  const pct = (a, b) => round(a > 0 ? ((a - b) / a) * 100 : 0, 1);
  return {
    baseline,
    optimised,
    savings: {
      costInr: round(baseline.costInr - optimised.costInr, 0),
      costPct: pct(baseline.costInr, optimised.costInr),
      peakReductionKw: delta(baseline.peakGridImportKw, optimised.peakGridImportKw),
      peakReductionPct: pct(baseline.peakGridImportKw, optimised.peakGridImportKw),
      co2AvoidedKg: delta(baseline.co2Kg, optimised.co2Kg),
      co2AvoidedPct: pct(baseline.co2Kg, optimised.co2Kg),
      shortageClearedKwh: delta(baseline.shortageKwh, optimised.shortageKwh),
      renewableRecoveredKwh: delta(baseline.curtailedKwh, optimised.curtailedKwh),
      utilisationGainPct: round(optimised.renewableUtilisationPct - baseline.renewableUtilisationPct, 1),
      gridEnergyAvoidedKwh: delta(baseline.gridImportKwh, optimised.gridImportKwh),
    },
  };
}

/** Rupees and CO2 scaled to a year, for the "so what" slide. */
export function annualise(savings) {
  return {
    costInr: round(savings.costInr * 365, 0),
    co2Kg: round(savings.co2AvoidedKg * 365, 0),
    treesEquivalent: round((savings.co2AvoidedKg * 365) / 21, 0), // ~21 kg CO2/tree/year
  };
}
