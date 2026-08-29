import { BATTERY, TARIFF, GRID, NEIGHBOURHOOD } from '../config/system.js';
import { hourLabel, round, tariffBandAt } from '../utils/calculations.js';
import { SCENARIOS } from '../sim/simulator.js';

/**
 * The assistant has two brains.
 *
 * The deterministic explainer reads the live plan and answers from it. It is
 * the default because an energy assistant that invents numbers is worse than no
 * assistant at all, and because a demo must not depend on a network call.
 *
 * If GEMINI_API_KEY is set, Gemini phrases the answer instead - but it is given
 * the same computed facts and told not to invent any. Same numbers, better prose.
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/** Compact, factual snapshot of the plan - the only thing the LLM may cite. */
export function planFacts(plan) {
  const now = plan.optimisedRows.find((r) => r.hour === plan.currentHour) ?? plan.optimisedRows[0];
  const worst = plan.shortagesBefore.worstHour;
  const [doNothing, batteryOnly, full] = plan.cases;
  return {
    community: NEIGHBOURHOOD.name,
    scenario: SCENARIOS[plan.scenarioId]?.label ?? plan.scenarioId,
    timeNow: hourLabel(plan.currentHour),
    tariffBandNow: tariffBandAt(plan.currentHour),
    now: {
      solarKw: now.solarKw,
      windKw: now.windKw,
      demandKw: now.demandKw,
      gridImportKw: now.gridImportKw,
      batteryChargeKw: now.batteryChargeKw,
      batteryDischargeKw: now.batteryDischargeKw,
      batterySocPct: now.socPct,
      importCapKw: now.capKw,
    },
    battery: {
      capacityKwh: BATTERY.capacityKwh,
      reservePct: BATTERY.minReservePct,
      reserveKwh: (BATTERY.minReservePct / 100) * BATTERY.capacityKwh,
      maxChargeKw: BATTERY.maxChargeKw,
      maxDischargeKw: BATTERY.maxDischargeKw,
      chargedTodayKwh: plan.battery.chargedKwh,
      dischargedTodayKwh: plan.battery.dischargedKwh,
      equivalentCycles: plan.battery.equivalentCycles,
    },
    grid: {
      sanctionedLoadKw: GRID.sanctionedLoadKw,
      peakWindowCapKw: GRID.peakWindowCapKw,
      peakWindow: `${hourLabel(GRID.peakWindowHours[0])}-${hourLabel(GRID.peakWindowHours[GRID.peakWindowHours.length - 1] + 1)}`,
      tariffInrPerKwh: { offPeak: TARIFF.offPeak, normal: TARIFF.normal, peak: TARIFF.peak },
    },
    shortage: {
      worstHour: worst ? hourLabel(worst.hour) : null,
      worstShortageKw: worst ? worst.shortageKw : 0,
      peakShortageKwBefore: plan.shortagesBefore.peakShortageKw,
      peakShortageKwAfter: plan.shortagesAfter.peakShortageKw,
      windows: plan.shortagesBefore.windows.map((w) => ({ when: w.label, peakKw: w.peakShortageKw, severity: w.severity })),
    },
    recommendedActions: plan.actions.map((a) => ({ title: a.title, detail: a.detail })),
    shifts: plan.shifts.map((s) => ({ load: s.label, from: s.fromLabel, to: s.toLabel, energyKwh: s.energyMovedKwh })),
    curtailments: plan.curtailments.map((c) => ({ load: c.label, pct: c.curtailPct, reliefKw: c.reliefKw })),
    impact: {
      peakReductionKw: plan.impact.savings.peakReductionKw,
      peakReductionPct: plan.impact.savings.peakReductionPct,
      costSavingInr: plan.impact.savings.costInr,
      co2AvoidedKg: plan.impact.savings.co2AvoidedKg,
      renewableUtilisationPct: full.renewableUtilisationPct,
      doNothingCostInr: doNothing.costInr,
      batteryOnlyCostInr: batteryOnly.costInr,
      optimisedCostInr: full.costInr,
    },
  };
}

const has = (q, ...words) => words.some((w) => q.includes(w));

/** Rule-based answers, each one built from the plan rather than a template. */
function explain(question, plan) {
  const f = planFacts(plan);
  const q = question.toLowerCase();

  if (has(q, 'shortage', 'short fall', 'shortfall', 'why will there be', 'deficit', 'gap')) {
    if (!f.shortage.worstShortageKw) {
      return {
        answer: `No shortage is forecast in the next ${plan.horizonHours} hours. Peak grid import stays at ${f.impact.peakReductionKw > 0 ? round(f.now.importCapKw - f.now.gridImportKw, 1) : '-'} kW of headroom below the ${f.grid.sanctionedLoadKw} kW sanctioned limit.`,
        citations: ['shortagesBefore'],
      };
    }
    return {
      answer: `A ${f.shortage.worstShortageKw} kW shortage is forecast at ${f.shortage.worstHour}. Two things happen at once: solar output collapses after sunset while the evening ramp pushes demand towards its daily maximum, and the DISCOM tightens the import cap from ${f.grid.sanctionedLoadKw} kW to ${f.grid.peakWindowCapKw} kW across ${f.grid.peakWindow}. The community needs more from the grid than it is allowed to draw. GridFlex closes ${round(f.shortage.peakShortageKwBefore - f.shortage.peakShortageKwAfter, 1)} kW of that by discharging the battery and moving flexible load into the afternoon, leaving ${f.shortage.peakShortageKwAfter} kW to cover.`,
      citations: ['shortagesBefore', 'actions'],
    };
  }

  if (has(q, 'save electricity', 'save money', 'save power', 'reduce my bill', 'how can i save', 'lower my bill')) {
    const moves = f.shifts.map((s) => `${s.load} from ${s.from} to ${s.to}`).join('; ');
    return {
      answer: `Three levers today. First, run heavy appliances between ${hourLabel(11)} and ${hourLabel(16)} when rooftop solar is in surplus and the tariff is Rs ${f.grid.tariffInrPerKwh.normal}/kWh rather than Rs ${f.grid.tariffInrPerKwh.peak}/kWh. Second, avoid ${f.grid.peakWindow} for anything that can wait${moves ? ` - the plan already moves ${moves}` : ''}. Third, let the battery cover the evening instead of the grid. Together these are worth Rs ${f.impact.costSavingInr} today and ${f.impact.peakReductionPct}% off the peak.`,
      citations: ['shifts', 'impact'],
    };
  }

  if (has(q, 'battery discharg', 'why is my battery', 'battery draining', 'battery going down')) {
    return {
      answer: `The battery is at ${f.now.batterySocPct}% and ${f.now.batteryDischargeKw > 0 ? `discharging at ${f.now.batteryDischargeKw} kW` : 'holding charge'}. It discharges when the tariff and the import cap make stored energy more valuable than grid energy - that is the ${f.grid.peakWindow} window at Rs ${f.grid.tariffInrPerKwh.peak}/kWh. Outside those hours it holds, because spending charge on a Rs ${f.grid.tariffInrPerKwh.normal}/kWh hour would leave nothing for the peak. It has moved ${f.battery.dischargedTodayKwh} kWh out and ${f.battery.chargedTodayKwh} kWh in over the horizon, about ${f.battery.equivalentCycles} of a full cycle.`,
      citations: ['battery'],
    };
  }

  if (has(q, 'charge my ev', 'when should i charge', 'ev charging', 'car charging', 'charge the car')) {
    const ev = f.shifts.find((s) => s.load.toLowerCase().includes('ev'));
    return {
      answer: ev
        ? `Charge at ${ev.to}, not ${ev.from}. That window sits inside the solar surplus, so most of the ${ev.energyKwh} kWh comes off the array instead of the grid, and it keeps ${round(60, 0)} kW out of the evening peak where the import cap binds.`
        : `The current plan leaves EV charging where it is - the solar surplus is already fully used and moving it would not clear any shortage. If you have the choice, ${hourLabel(12)}-${hourLabel(15)} is still the cheapest window at Rs ${f.grid.tariffInrPerKwh.normal}/kWh.`,
      citations: ['shifts'],
    };
  }

  if (has(q, 'reserve', '20%', 'minimum', 'reaches 20', 'hits 20', 'runs out', 'empty')) {
    return {
      answer: `${f.battery.reservePct}% of ${f.battery.capacityKwh} kWh - ${f.battery.reserveKwh} kWh - is a hard floor the dispatcher will not cross. At that point the battery stops discharging and the remaining deficit goes to the grid, or to load shifting if any flexible load is left. The reserve exists so there is always something for an unplanned outage; a battery optimised to empty is a battery that is useless in the one hour you need it.`,
      citations: ['battery'],
    };
  }

  if (has(q, 'peak', 'reduction', 'impact', 'savings', 'co2', 'carbon', 'how much did')) {
    return {
      answer: `Against doing nothing: peak grid import falls ${f.impact.peakReductionKw} kW (${f.impact.peakReductionPct}%), cost falls Rs ${f.impact.costSavingInr}, and ${f.impact.co2AvoidedKg} kg of CO2 is avoided. Renewable utilisation reaches ${f.impact.renewableUtilisationPct}%. Storage alone would get the bill to Rs ${f.impact.batteryOnlyCostInr}; adding demand response takes it to Rs ${f.impact.optimisedCostInr}, from Rs ${f.impact.doNothingCostInr}.`,
      citations: ['impact', 'cases'],
    };
  }

  if (has(q, 'what is happening', 'right now', 'status', 'current', 'summary', 'overview')) {
    return {
      answer: `${f.timeNow}, ${f.scenario}. Solar ${f.now.solarKw} kW and wind ${f.now.windKw} kW against ${f.now.demandKw} kW of demand, so ${f.now.gridImportKw} kW is coming from the grid against a ${f.now.importCapKw} kW cap. Battery at ${f.now.batterySocPct}%. ${plan.actions[0]?.title ?? 'No action required'}.`,
      citations: ['now'],
    };
  }

  if (has(q, 'shift', 'load', 'recommend', 'what should', 'action', 'do now')) {
    return {
      answer: `Recommended, in priority order: ${plan.actions.map((a, i) => `${i + 1}. ${a.title}`).join(' ')}`,
      citations: ['actions'],
    };
  }

  return {
    answer: `At ${f.timeNow} the community is drawing ${f.now.gridImportKw} kW from the grid against a ${f.now.importCapKw} kW cap, with the battery at ${f.now.batterySocPct}%. ${f.shortage.worstShortageKw ? `A ${f.shortage.worstShortageKw} kW shortage is forecast at ${f.shortage.worstHour}.` : 'No shortage is forecast.'} Ask about the shortage, the battery, EV charging, load shifting, or today's savings and I can go deeper.`,
    citations: ['now'],
  };
}

/** Ask Gemini to phrase the answer, constrained to computed facts. */
async function askGemini(question, plan, groundTruth) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const system = [
    'You are the assistant inside GridFlex, a neighbourhood energy management platform.',
    'Answer the question using ONLY the JSON facts provided. Never invent a number.',
    'If the facts do not contain the answer, say so and suggest what the user can ask instead.',
    'Be concrete and brief: 2-4 sentences, plain prose, no bullet points, no markdown headings.',
    'Units: kW for power, kWh for energy, Rs for money, kg for CO2.',
    'A pre-computed answer is included - improve its phrasing if you can, but do not contradict its numbers.',
  ].join(' ');

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{
      role: 'user',
      parts: [{ text: `FACTS:\n${JSON.stringify(groundTruth, null, 1)}\n\nPRE-COMPUTED ANSWER:\n${plan.precomputed}\n\nQUESTION:\n${question}` }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 350 },
  };

  const modelsToTry = Array.from(new Set([DEFAULT_MODEL, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']));

  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000), // Strict 5s timeout to stay within Vercel's serverless window
        },
      );
      if (!res.ok) continue;
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      if (text) return { text, modelUsed: modelName };
    } catch {
      // Try next model if timeout or error
    }
  }

  return null;
}

export async function answerQuestion(question, plan) {
  const grounded = explain(question, plan);
  const facts = planFacts(plan);

  if (!process.env.GEMINI_API_KEY) {
    return { ...grounded, source: 'explainer', model: null };
  }

  try {
    const res = await askGemini(question, { precomputed: grounded.answer }, facts);
    if (!res || !res.text) {
      return { ...grounded, source: 'explainer', model: null, note: 'Gemini fallback to ground truth' };
    }
    return { answer: res.text, citations: grounded.citations, source: 'gemini', model: res.modelUsed };
  } catch (err) {
    return { ...grounded, source: 'explainer', model: null, note: `Gemini unavailable: ${err.message}` };
  }
}

export const SUGGESTED_QUESTIONS = [
  'Why will there be a shortage this evening?',
  'How can I save electricity today?',
  'Why is my battery discharging?',
  'When should I charge my EV?',
  'What happens if the battery reaches 20%?',
  'How much peak reduction did we achieve?',
];
