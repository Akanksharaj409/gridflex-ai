import { NEIGHBOURHOOD } from '../config/system.js';
import { importCapAt, hourLabel, round } from '../utils/calculations.js';

/**
 * A shortage here is not "the lights go out" - it is the community needing more
 * from the grid than its connection is allowed to deliver at that hour. That is
 * the number a DISCOM actually acts on, and the one demand response can close.
 */

export function severityOf(shortageKw, demandKw) {
  if (shortageKw <= 0.5) return 'normal';
  const pct = demandKw > 0 ? (shortageKw / demandKw) * 100 : 0;
  if (pct >= 10) return 'critical';
  if (pct >= 4) return 'warning';
  return 'watch';
}

const RANK = { normal: 0, watch: 1, warning: 2, critical: 3 };

/**
 * @param {Array} rows dispatch rows (must carry hour, demandKw, renewableKw, gridImportKw)
 */
export function detectShortages(rows) {
  const hours = rows.map((r) => {
    const capKw = importCapAt(r.hour);
    const shortageKw = round(Math.max(0, r.gridImportKw - capKw), 1);
    const overloadKw = round(Math.max(0, r.demandKw - NEIGHBOURHOOD.feederCapacityKw), 1);
    return {
      hour: r.hour,
      step: r.step,
      label: hourLabel(r.hour),
      demandKw: r.demandKw,
      renewableKw: r.renewableKw,
      batteryDischargeKw: r.batteryDischargeKw ?? 0,
      gridImportKw: r.gridImportKw,
      capKw,
      shortageKw,
      overloadKw,
      severity: severityOf(Math.max(shortageKw, overloadKw), r.demandKw),
      headroomKw: round(capKw - r.gridImportKw, 1),
    };
  });

  // Group consecutive non-normal hours into windows an operator can act on.
  const windows = [];
  let open = null;
  for (const h of hours) {
    if (h.severity !== 'normal') {
      if (!open) open = { startHour: h.hour, endHour: h.hour, hours: [], peakShortageKw: 0, energyShortKwh: 0, severity: h.severity };
      open.endHour = h.hour;
      open.hours.push(h);
      open.peakShortageKw = Math.max(open.peakShortageKw, h.shortageKw);
      open.energyShortKwh = round(open.energyShortKwh + h.shortageKw, 1);
      if (RANK[h.severity] > RANK[open.severity]) open.severity = h.severity;
    } else if (open) {
      windows.push(finaliseWindow(open));
      open = null;
    }
  }
  if (open) windows.push(finaliseWindow(open));

  const worst = hours.reduce((a, b) => (b.shortageKw > (a?.shortageKw ?? -1) ? b : a), null);
  return {
    hours,
    windows,
    worstHour: worst && worst.shortageKw > 0 ? worst : null,
    totalShortageKwh: round(hours.reduce((a, h) => a + h.shortageKw, 0), 1),
    peakShortageKw: round(Math.max(0, ...hours.map((h) => h.shortageKw)), 1),
    peakDemandKw: round(Math.max(...hours.map((h) => h.demandKw)), 1),
    peakGridImportKw: round(Math.max(...hours.map((h) => h.gridImportKw)), 1),
  };
}

function finaliseWindow(w) {
  return {
    ...w,
    label: `${hourLabel(w.startHour)}-${hourLabel(w.endHour + 1)}`,
    durationHours: w.hours.length,
    peakShortageKw: round(w.peakShortageKw, 1),
  };
}
