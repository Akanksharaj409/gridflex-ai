import { BATTERY } from '../config/system.js';
import { tariffAt, clamp, round } from '../utils/calculations.js';

/**
 * Value-aware battery dispatch over a horizon.
 *
 * A naive chronological rule ("discharge whenever short") empties the battery
 * into the 17:00 shoulder and leaves nothing for the 20:00 peak. So dispatch
 * runs in two passes:
 *
 *   1. Charge greedily from surplus - surplus renewable is free and would
 *      otherwise be curtailed, so there is never a reason to refuse it.
 *   2. Allocate discharge to deficit hours in order of *value*
 *      (tariff x deficit), each allocation limited by the energy that can be
 *      spared without pushing any later hour below the reserve floor.
 *
 * @param {Array<{hour:number, demandKw:number, renewableKw:number}>} profile
 * @param {{socPct:number}} battery live battery state
 */
export function dispatchBattery(profile, battery, opts = {}) {
  const cfg = { ...BATTERY, ...opts };
  const capacity = cfg.capacityKwh;
  const reserveKwh = (cfg.minReservePct / 100) * capacity;
  const maxKwh = (cfg.maxSocPct / 100) * capacity;
  const n = profile.length;

  const net = profile.map((p) => round(p.renewableKw - p.demandKw, 2)); // kW == kWh over 1h
  const charge = new Array(n).fill(0);
  const discharge = new Array(n).fill(0);
  const curtailedRenewable = new Array(n).fill(0);

  let soc = (battery.socPct / 100) * capacity;

  // --- Pass 1: soak up every surplus kWh we have room and power for. ---
  const socTrace = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    if (net[i] > 0) {
      const headroom = maxKwh - soc;
      const c = Math.min(net[i], cfg.maxChargeKw, headroom / cfg.roundTripEfficiency);
      charge[i] = Math.max(0, c);
      soc += charge[i] * cfg.roundTripEfficiency;
      curtailedRenewable[i] = Math.max(0, net[i] - charge[i]);
    }
    socTrace[i] = soc;
  }

  // --- Pass 2: spend stored energy where it is worth the most. ---
  const deficits = [];
  for (let i = 0; i < n; i += 1) {
    if (net[i] < 0) {
      deficits.push({ i, deficit: -net[i], value: -net[i] * tariffAt(profile[i].hour) });
    }
  }
  deficits.sort((a, b) => b.value - a.value);

  for (const d of deficits) {
    // Discharging at i lowers SOC for every hour from i onwards, so the
    // spendable energy is bounded by the tightest point in that tail.
    let tailMin = Infinity;
    for (let t = d.i; t < n; t += 1) tailMin = Math.min(tailMin, socTrace[t]);
    const spendable = Math.max(0, tailMin - reserveKwh);
    const amount = Math.min(d.deficit, cfg.maxDischargeKw, spendable);
    if (amount <= 0.01) continue;
    discharge[d.i] = round(amount, 2);
    for (let t = d.i; t < n; t += 1) socTrace[t] -= amount;
  }

  // --- Settle the books hour by hour. ---
  const startSoc = (battery.socPct / 100) * capacity;
  let running = startSoc;
  const rows = profile.map((p, i) => {
    running += charge[i] * cfg.roundTripEfficiency - discharge[i];
    running = clamp(running, 0, maxKwh);
    const gridImportKw = Math.max(0, p.demandKw - p.renewableKw - discharge[i]);
    return {
      ...p,
      step: i,
      netKw: net[i],
      batteryChargeKw: round(charge[i], 1),
      batteryDischargeKw: round(discharge[i], 1),
      curtailedRenewableKw: round(curtailedRenewable[i], 1),
      gridImportKw: round(gridImportKw, 1),
      socKwh: round(running, 1),
      socPct: round((running / capacity) * 100, 1),
      tariff: tariffAt(p.hour),
    };
  });

  const throughput = charge.reduce((a, b) => a + b, 0);
  return {
    rows,
    summary: {
      startSocPct: round(battery.socPct, 1),
      endSocPct: round((running / capacity) * 100, 1),
      chargedKwh: round(throughput, 1),
      dischargedKwh: round(discharge.reduce((a, b) => a + b, 0), 1),
      curtailedKwh: round(curtailedRenewable.reduce((a, b) => a + b, 0), 1),
      equivalentCycles: round(throughput / capacity, 2),
      reserveKwh: round(reserveKwh, 1),
    },
  };
}

/** Battery held idle - used as the "do nothing" reference case. */
export function dispatchIdle(profile, battery) {
  const capacity = BATTERY.capacityKwh;
  const socKwh = (battery.socPct / 100) * capacity;
  return {
    rows: profile.map((p, i) => ({
      ...p,
      step: i,
      netKw: round(p.renewableKw - p.demandKw, 2),
      batteryChargeKw: 0,
      batteryDischargeKw: 0,
      curtailedRenewableKw: round(Math.max(0, p.renewableKw - p.demandKw), 1),
      gridImportKw: round(Math.max(0, p.demandKw - p.renewableKw), 1),
      socKwh: round(socKwh, 1),
      socPct: round(battery.socPct, 1),
      tariff: tariffAt(p.hour),
    })),
    summary: {
      startSocPct: round(battery.socPct, 1),
      endSocPct: round(battery.socPct, 1),
      chargedKwh: 0,
      dischargedKwh: 0,
      curtailedKwh: round(profile.reduce((a, p) => a + Math.max(0, p.renewableKw - p.demandKw), 0), 1),
      equivalentCycles: 0,
      reserveKwh: round((BATTERY.minReservePct / 100) * capacity, 1),
    },
  };
}
