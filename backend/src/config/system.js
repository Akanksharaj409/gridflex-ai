/**
 * Physical + commercial configuration for the modelled neighbourhood.
 * One place to retune the whole simulation.
 */

export const NEIGHBOURHOOD = {
  name: 'Sunrise Vihar Community Grid',
  feederId: 'FDR-01',
  households: 150,
  peakDemandKw: 500, // design peak of the feeder
  feederCapacityKw: 560, // firm capacity of the 11kV feeder - above this is an overload
};

export const SOLAR = {
  capacityKwp: 560, // ~3.7 kWp per household of rooftop + community PV
  peakOutputKw: 500, // AC output at midday, after inverter and thermal derating
  sunriseHour: 6,
  sunsetHour: 19,
};

export const WIND = {
  capacityKw: 45, // small community turbines, night-biased
};

export const BATTERY = {
  capacityKwh: 500,
  maxChargeKw: 150,
  maxDischargeKw: 150,
  minReservePct: 20,
  maxSocPct: 100,
  roundTripEfficiency: 0.92,
  startSocPct: 65,
};

/** Time-of-use tariff, INR per kWh, indexed by hour 0..23. */
export const TARIFF = {
  offPeak: 4.5,
  normal: 6.5,
  peak: 9.5,
  peakHours: [18, 19, 20, 21],
  offPeakHours: [0, 1, 2, 3, 4, 5, 23],
};

/**
 * The community's connection to the DISCOM. `sanctionedLoadKw` is the contract
 * demand; during the evening peak window the utility restricts imports further,
 * and anything above that restriction is what we call a shortage.
 */
export const GRID = {
  sanctionedLoadKw: 420,
  peakWindowCapKw: 340,
  peakWindowHours: [18, 19, 20, 21],
};

export const EMISSIONS = {
  gridKgPerKwh: 0.71, // India grid average
  solarKgPerKwh: 0.041, // lifecycle
  windKgPerKwh: 0.011,
};

/**
 * Loads the optimizer is allowed to move or trim.
 * `shiftable` loads move in time; `curtailable` loads shrink in place.
 */
export const FLEXIBLE_LOADS = [
  {
    id: 'ev-fleet',
    label: 'EV charging (community bay)',
    icon: 'ev',
    kind: 'shiftable',
    powerKw: 60,
    durationHours: 3,
    defaultStartHour: 19,
    earliestHour: 10,
    latestFinishHour: 23,
    note: 'Must be full before 06:00 next day',
  },
  {
    id: 'water-pump',
    label: 'Water pumping station',
    icon: 'pump',
    kind: 'shiftable',
    powerKw: 35,
    durationHours: 2,
    defaultStartHour: 20,
    earliestHour: 9,
    latestFinishHour: 22,
    note: 'Overhead tank must be filled once daily',
  },
  {
    id: 'clubhouse-hvac',
    label: 'Clubhouse + common HVAC',
    icon: 'hvac',
    kind: 'curtailable',
    powerKw: 45,
    maxCurtailPct: 20,
    activeHours: [15, 16, 17, 18, 19, 20, 21, 22],
    note: 'Setpoint raise, comfort band 24-26C',
  },
  {
    id: 'water-heaters',
    label: 'Smart water heaters',
    icon: 'heater',
    kind: 'shiftable',
    powerKw: 28,
    durationHours: 2,
    defaultStartHour: 18,
    earliestHour: 11,
    latestFinishHour: 21,
    note: 'Tank stays hot ~6h',
  },
];

export const SIM = {
  historyDays: 14, // seeded history the forecaster learns from
  horizonHours: 24, // forecast + optimisation horizon
  tickMs: 4000, // real ms per simulated hour when auto-play is on
};

/** Representative metered units shown on the Neighbourhood page. */
export const METERED_UNITS = [
  { id: 'blk-a', label: 'Block A (32 flats)', type: 'residential', share: 0.19 },
  { id: 'blk-b', label: 'Block B (28 flats)', type: 'residential', share: 0.17 },
  { id: 'blk-c', label: 'Block C (30 flats)', type: 'residential', share: 0.18 },
  { id: 'villas', label: 'Villa row (18 homes)', type: 'residential', share: 0.14 },
  { id: 'shops', label: 'Retail arcade', type: 'commercial', share: 0.11 },
  { id: 'clubhouse', label: 'Clubhouse + gym', type: 'commercial', share: 0.08 },
  { id: 'ev-bay', label: 'EV charging bay', type: 'ev', share: 0.07 },
  { id: 'utility', label: 'Pumps + street lighting', type: 'utility', share: 0.06 },
];
