import {
  NEIGHBOURHOOD, SOLAR, WIND, FLEXIBLE_LOADS, METERED_UNITS,
} from '../config/system.js';
import {
  DEMAND_SHAPE, SOLAR_SHAPE, WIND_SHAPE, cloudAttenuation, temperatureFactor,
  makeRng, noise, clamp, round,
} from '../utils/calculations.js';

/**
 * Scenario knobs. The demo story lives here: `evening-peak` is a hot, hazy day
 * where PV collapses early and cooling load stacks on top of the evening ramp.
 */
export const SCENARIOS = {
  normal: {
    id: 'normal',
    label: 'Typical clear day',
    description: 'Clear skies, seasonal temperatures, textbook duck curve.',
    cloudBias: 0.12, tempBias: 0, demandBias: 1.0, windBias: 1.0,
  },
  'evening-peak': {
    id: 'evening-peak',
    label: 'Heatwave evening peak',
    description: '38C afternoon, haze from 15:00, cooling load stacks onto the evening ramp.',
    cloudBias: 0.42, tempBias: 5.5, demandBias: 1.08, windBias: 0.7,
  },
  'cloudy-day': {
    id: 'cloudy-day',
    label: 'Overcast monsoon day',
    description: 'Heavy cloud all day, PV yield down sharply, mild temperatures.',
    cloudBias: 0.72, tempBias: -4, demandBias: 0.94, windBias: 1.25,
  },
  'windy-night': {
    id: 'windy-night',
    label: 'High wind night',
    description: 'Strong overnight wind - surplus outside solar hours.',
    cloudBias: 0.3, tempBias: -1, demandBias: 0.98, windBias: 1.9,
  },
};

/** Default (un-optimised) start hour for every shiftable load. */
export function defaultSchedule() {
  const s = {};
  for (const load of FLEXIBLE_LOADS) {
    if (load.kind === 'shiftable') s[load.id] = load.defaultStartHour;
    else s[load.id] = null; // curtailable loads have no start hour
  }
  return s;
}

/** kW drawn by one flexible load at a given hour, under a given schedule. */
export function loadPowerAt(load, hour, schedule, curtailPct = {}) {
  if (load.kind === 'curtailable') {
    if (!load.activeHours.includes(hour)) return 0;
    const trim = clamp(curtailPct[load.id] ?? 0, 0, load.maxCurtailPct) / 100;
    return load.powerKw * (1 - trim);
  }
  const start = schedule?.[load.id] ?? load.defaultStartHour;
  for (let i = 0; i < load.durationHours; i += 1) {
    if ((start + i) % 24 === hour) return load.powerKw;
  }
  return 0;
}

/** 24-hour kW profile of all flexible load, plus a per-load breakdown. */
export function flexibleProfile(schedule = defaultSchedule(), curtailPct = {}) {
  const total = new Array(24).fill(0);
  const perLoad = {};
  for (const load of FLEXIBLE_LOADS) {
    const series = [];
    for (let h = 0; h < 24; h += 1) {
      const kw = loadPowerAt(load, h, schedule, curtailPct);
      series.push(round(kw, 1));
      total[h] += kw;
    }
    perLoad[load.id] = series;
  }
  return { total: total.map((v) => round(v, 1)), perLoad };
}

/** Inflexible (non-negotiable) demand shape, before weather scaling. */
const BASE_FLEX = flexibleProfile().total;
export function inflexibleBaseKw(hour) {
  return Math.max(40, DEMAND_SHAPE[hour] * NEIGHBOURHOOD.peakDemandKw - BASE_FLEX[hour]);
}

/** Per-hour weather for a given simulated day. */
export function buildWeather(dayIndex, scenarioId = 'normal') {
  const sc = SCENARIOS[scenarioId] ?? SCENARIOS.normal;
  const rng = makeRng(1000 + dayIndex * 37);
  const dailyCloud = clamp(sc.cloudBias + noise(rng, 0.18), 0, 0.95);
  const dailyTemp = 31 + sc.tempBias + noise(rng, 2.2);
  const hours = [];
  for (let h = 0; h < 24; h += 1) {
    // Haze builds through the afternoon on peak-scenario days.
    const drift = sc.id === 'evening-peak' && h >= 14 ? (h - 14) * 0.055 : 0;
    const cloudCover = clamp(dailyCloud + drift + noise(rng, 0.1), 0, 1);
    // Diurnal temperature swing, min ~03:30, max ~15:30.
    const swing = -Math.cos(((h - 3.5) / 24) * 2 * Math.PI) * 5.5;
    const tempC = round(dailyTemp + swing + noise(rng, 0.7), 1);
    hours.push({
      hour: h,
      cloudCover: round(cloudCover, 3),
      tempC,
      windIndex: round(clamp(sc.windBias * (0.8 + noise(rng, 0.25)), 0, 2), 3),
    });
  }
  return hours;
}

/** Generation for one hour given that hour's weather. */
export function generationAt(hour, w) {
  const solarKw = round(SOLAR.peakOutputKw * SOLAR_SHAPE[hour] * cloudAttenuation(w.cloudCover), 1);
  const windKw = round(WIND.capacityKw * WIND_SHAPE[hour] * w.windIndex, 1);
  return { solarKw, windKw };
}

/**
 * Full 24h simulation of one day.
 * `dayIndex` 0 = today; negative values are seeded history.
 */
export function simulateDay(dayIndex, { scenarioId = 'normal', schedule, curtailPct } = {}) {
  const sc = SCENARIOS[scenarioId] ?? SCENARIOS.normal;
  const weather = buildWeather(dayIndex, scenarioId);
  const flex = flexibleProfile(schedule ?? defaultSchedule(), curtailPct ?? {});
  const rng = makeRng(5000 + dayIndex * 91);
  // Weekends run ~6% lighter on the commercial side.
  const dayType = ((dayIndex % 7) + 7) % 7 === 6 || ((dayIndex % 7) + 7) % 7 === 0 ? 'weekend' : 'weekday';
  const dayTypeFactor = dayType === 'weekend' ? 0.94 : 1;

  return weather.map((w) => {
    const { solarKw, windKw } = generationAt(w.hour, w);
    const inflexibleKw = round(
      inflexibleBaseKw(w.hour)
        * temperatureFactor(w.tempC)
        * dayTypeFactor
        * sc.demandBias
        * (1 + noise(rng, 0.035)),
      1,
    );
    const flexibleKw = flex.total[w.hour];
    return {
      dayIndex,
      hour: w.hour,
      dayType,
      tempC: w.tempC,
      cloudCover: w.cloudCover,
      solarKw,
      windKw,
      renewableKw: round(solarKw + windKw, 1),
      inflexibleKw,
      flexibleKw,
      demandKw: round(inflexibleKw + flexibleKw, 1),
    };
  });
}

/** Split a total demand figure across the metered units on the map. */
export function splitAcrossUnits(demandKw, hour) {
  // Commercial units lean daytime, residential leans evening, EV leans night.
  const tilt = { residential: 0.9 + 0.35 * DEMAND_SHAPE[hour], commercial: hour >= 9 && hour <= 21 ? 1.25 : 0.5, ev: hour >= 18 || hour <= 6 ? 1.4 : 0.6, utility: 1 };
  const weights = METERED_UNITS.map((u) => u.share * (tilt[u.type] ?? 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  return METERED_UNITS.map((u, i) => ({
    ...u,
    loadKw: round((weights[i] / totalW) * demandKw, 1),
  }));
}
