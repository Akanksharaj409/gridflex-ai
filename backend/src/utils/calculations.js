import { TARIFF, EMISSIONS, GRID } from '../config/system.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

/** Deterministic PRNG so every reload of the demo tells the same story. */
export function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Normal-ish noise in [-1, 1], mean 0. */
export function noise(rng, spread = 1) {
  return (rng() + rng() + rng() - 1.5) / 1.5 * spread;
}

export function tariffAt(hour) {
  if (TARIFF.peakHours.includes(hour)) return TARIFF.peak;
  if (TARIFF.offPeakHours.includes(hour)) return TARIFF.offPeak;
  return TARIFF.normal;
}

export function tariffBandAt(hour) {
  if (TARIFF.peakHours.includes(hour)) return 'peak';
  if (TARIFF.offPeakHours.includes(hour)) return 'off-peak';
  return 'normal';
}

export function gridCost(kwh, hour) {
  return kwh * tariffAt(hour);
}

export function gridEmissions(kwh) {
  return kwh * EMISSIONS.gridKgPerKwh;
}

export function renewableEmissions(solarKwh, windKwh) {
  return solarKwh * EMISSIONS.solarKgPerKwh + windKwh * EMISSIONS.windKgPerKwh;
}

/** Hourly shape of neighbourhood demand as a fraction of design peak. */
export const DEMAND_SHAPE = [
  0.42, 0.38, 0.36, 0.35, 0.37, 0.44, 0.55, 0.66, 0.70, 0.66, 0.62, 0.62,
  0.64, 0.66, 0.68, 0.70, 0.72, 0.78, 0.88, 0.98, 1.00, 0.92, 0.76, 0.56,
];

/** Clear-sky PV output as a fraction of peak AC output. */
export const SOLAR_SHAPE = [
  0, 0, 0, 0, 0, 0, 0.04, 0.16, 0.34, 0.54, 0.72, 0.88,
  0.97, 1.00, 0.95, 0.82, 0.63, 0.41, 0.18, 0.03, 0, 0, 0, 0,
];

/** Wind is night-biased here, which is what makes it complementary to PV. */
export const WIND_SHAPE = [
  0.72, 0.78, 0.80, 0.76, 0.70, 0.58, 0.44, 0.32, 0.24, 0.20, 0.18, 0.20,
  0.26, 0.32, 0.38, 0.42, 0.46, 0.52, 0.60, 0.68, 0.74, 0.78, 0.76, 0.74,
];

/** Cloud cover 0..1 knocks down PV non-linearly - diffuse light still gets through. */
export const cloudAttenuation = (cloudCover) => 1 - 0.78 * clamp(cloudCover, 0, 1) ** 1.15;

/** Cooling load: every degree over 30C adds ~2.2% to neighbourhood demand. */
export const temperatureFactor = (tempC) => 1 + 0.022 * Math.max(0, tempC - 30) - 0.008 * Math.max(0, 22 - tempC);

export const hourLabel = (h) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Import ceiling the community must respect at a given hour, in kW. */
export function importCapAt(hour) {
  return GRID.peakWindowHours.includes(hour) ? GRID.peakWindowCapKw : GRID.sanctionedLoadKw;
}
