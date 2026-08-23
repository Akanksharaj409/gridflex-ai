import { SIM, SOLAR, WIND } from '../config/system.js';
import {
  SOLAR_SHAPE, WIND_SHAPE, cloudAttenuation, temperatureFactor,
  clamp, round, mean, makeRng, noise,
} from '../utils/calculations.js';
import { buildWeather, flexibleProfile, defaultSchedule } from '../sim/simulator.js';
import { getState } from '../data/store.js';

/**
 * Forecasting is deliberately a transparent statistical model, not a black box:
 *
 *   demand(h) = weather-normalised historical mean for (hour, day-type)
 *               x temperature factor of the forecast temperature
 *               x recent-level bias correction
 *               + scheduled flexible load
 *
 *   solar(h)  = clear-sky shape x rated output x cloud attenuation
 *               x historical bias correction
 *
 * Every term is inspectable, which matters more in a control room than a
 * marginally lower RMSE from something nobody can explain.
 */

/** Weather-normalised mean inflexible demand per hour, learned from history. */
function learnDemandBaseline(history, dayType) {
  const buckets = Array.from({ length: 24 }, () => []);
  for (const r of history) {
    if (r.dayType !== dayType) continue;
    // Divide the weather out so the baseline is a pure habit curve.
    buckets[r.hour].push(r.inflexibleKw / temperatureFactor(r.tempC));
  }
  return buckets.map((b, h) => (b.length ? mean(b) : history.find((r) => r.hour === h)?.inflexibleKw ?? 0));
}

/** How far the clear-sky model has been off historically (systematic bias). */
function learnSolarBias(history) {
  const modelled = [];
  const actual = [];
  for (const r of history) {
    const m = SOLAR.peakOutputKw * SOLAR_SHAPE[r.hour] * cloudAttenuation(r.cloudCover);
    if (m < 5) continue;
    modelled.push(m);
    actual.push(r.solarKw);
  }
  if (!modelled.length) return 1;
  return clamp(mean(actual) / mean(modelled), 0.8, 1.2);
}

/**
 * The weather forecast the operator actually sees: true weather blurred by an
 * error that grows with lead time. Nobody forecasts cloud cover perfectly.
 */
function weatherForecast(scenarioId, fromHour) {
  const truth = buildWeather(0, scenarioId);
  const rng = makeRng(777 + fromHour);
  return truth.map((w) => {
    const lead = (w.hour - fromHour + 24) % 24;
    const blur = Math.min(0.28, 0.02 + lead * 0.011);
    return {
      ...w,
      leadHours: lead,
      cloudCover: round(clamp(w.cloudCover + noise(rng, blur), 0, 1), 3),
      tempC: round(w.tempC + noise(rng, blur * 9), 1),
      windIndex: round(clamp(w.windIndex * (1 + noise(rng, blur * 1.4)), 0, 2.4), 3),
    };
  });
}

/**
 * 24-hour rolling forecast starting at the current simulated hour.
 * Returns one entry per horizon step, oldest first.
 */
export function buildForecast({ horizonHours = SIM.horizonHours } = {}) {
  const state = getState();
  const { history, currentHour, scenarioId } = state;
  const todayType = 'weekday';

  const baseline = learnDemandBaseline(history, todayType);
  const solarBias = learnSolarBias(history);
  const wx = weatherForecast(scenarioId, currentHour);

  const flex = flexibleProfile(
    state.planApplied ? state.schedule : defaultSchedule(),
    state.planApplied ? state.curtailPct : {},
  );

  // Bias correction: how wrong has the baseline been over the last 3 hours?
  const recent = [];
  for (let i = 1; i <= 3; i += 1) {
    const h = (currentHour - i + 24) % 24;
    const predicted = baseline[h] * temperatureFactor(wx[h].tempC);
    const actual = baseline[h] * temperatureFactor(buildWeather(0, scenarioId)[h].tempC);
    if (predicted > 0) recent.push(actual / predicted);
  }
  const levelCorrection = clamp(recent.length ? mean(recent) : 1, 0.88, 1.12);

  const rows = [];
  for (let step = 0; step < horizonHours; step += 1) {
    const hour = (currentHour + step) % 24;
    const w = wx[hour];

    const predictedInflexibleKw = baseline[hour] * temperatureFactor(w.tempC) * levelCorrection;
    const predictedFlexibleKw = flex.total[hour];
    const predictedDemandKw = predictedInflexibleKw + predictedFlexibleKw;

    const predictedSolarKw = SOLAR.peakOutputKw * SOLAR_SHAPE[hour] * cloudAttenuation(w.cloudCover) * solarBias;
    const predictedWindKw = WIND.capacityKw * WIND_SHAPE[hour] * w.windIndex;

    // Uncertainty widens with lead time; solar is far less certain than demand.
    const demandBand = 0.035 + step * 0.006;
    const solarBand = 0.07 + step * 0.019;

    rows.push({
      step,
      hour,
      leadHours: step,
      tempC: w.tempC,
      cloudCover: w.cloudCover,
      predictedInflexibleKw: round(predictedInflexibleKw, 1),
      predictedFlexibleKw: round(predictedFlexibleKw, 1),
      predictedDemandKw: round(predictedDemandKw, 1),
      demandLowKw: round(predictedDemandKw * (1 - demandBand), 1),
      demandHighKw: round(predictedDemandKw * (1 + demandBand), 1),
      predictedSolarKw: round(predictedSolarKw, 1),
      predictedWindKw: round(predictedWindKw, 1),
      predictedRenewableKw: round(predictedSolarKw + predictedWindKw, 1),
      renewableLowKw: round((predictedSolarKw + predictedWindKw) * (1 - solarBand), 1),
      renewableHighKw: round((predictedSolarKw + predictedWindKw) * (1 + solarBand), 1),
      netKw: round(predictedSolarKw + predictedWindKw - predictedDemandKw, 1),
    });
  }
  return rows;
}

/** Backtest the forecaster against the last full day of history. */
export function forecastAccuracy() {
  const { history } = getState();
  const lastDay = Math.max(...history.map((r) => r.dayIndex));
  const actualDay = history.filter((r) => r.dayIndex === lastDay);
  const baseline = learnDemandBaseline(history.filter((r) => r.dayIndex !== lastDay), actualDay[0]?.dayType ?? 'weekday');
  const solarBias = learnSolarBias(history.filter((r) => r.dayIndex !== lastDay));

  // Blur the weather the way a real day-ahead forecast is blurred. Scoring
  // against observed cloud cover would measure model fit, not forecast skill,
  // and would report a solar MAPE close to zero - which nobody should believe.
  const rng = makeRng(31337);
  let demandErr = 0; let demandDen = 0; let solarErr = 0; let solarDen = 0;
  for (const r of actualDay) {
    const fcTemp = r.tempC + noise(rng, 1.6);
    const fcCloud = clamp(r.cloudCover + noise(rng, 0.16), 0, 1);
    const pd = baseline[r.hour] * temperatureFactor(fcTemp);
    demandErr += Math.abs(pd - r.inflexibleKw); demandDen += r.inflexibleKw;
    const ps = SOLAR.peakOutputKw * SOLAR_SHAPE[r.hour] * cloudAttenuation(fcCloud) * solarBias;
    if (SOLAR_SHAPE[r.hour] > 0.05) { solarErr += Math.abs(ps - r.solarKw); solarDen += r.solarKw; }
  }
  return {
    backtestDay: lastDay,
    demandMapePct: round(demandDen ? (demandErr / demandDen) * 100 : 0, 2),
    solarMapePct: round(solarDen ? (solarErr / solarDen) * 100 : 0, 2),
    method: 'weather-normalised hour-of-day baseline + clear-sky PV model with bias correction',
    note: 'Scored day-ahead: the weather input is blurred to match real forecast uncertainty.',
  };
}
