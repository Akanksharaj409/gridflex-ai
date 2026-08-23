const base = '/api';

async function request(path, options) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).error ?? detail; } catch { /* body was not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  health: () => get('/health'),
  config: () => get('/energy/config'),
  dashboard: () => get('/dashboard'),
  simState: () => get('/sim/state'),
  forecast: () => get('/forecast'),
  battery: () => get('/battery/status'),
  shortage: () => get('/shortage/prediction'),
  recommendations: () => get('/recommendations'),
  impact: () => get('/impact'),
  discom: () => get('/discom'),
  alerts: () => get('/alerts'),
  neighbourhood: () => get('/energy/neighbourhood'),
  today: () => get('/energy/today'),
  history: (days = 7) => get(`/energy/history?days=${days}`),
  aiSuggestions: () => get('/ai/suggestions'),
  aiFacts: () => get('/ai/facts'),

  setScenario: (scenarioId) => post('/sim/scenario', { scenarioId }),
  setHour: (hour) => post('/sim/hour', { hour }),
  advance: (by = 1) => post('/sim/advance', { by }),
  setBatterySoc: (socPct) => post('/sim/battery', { socPct }),
  resetSim: () => post('/sim/reset'),

  applyPlan: () => post('/plan/apply'),
  revertPlan: () => post('/plan/revert'),
  shiftLoad: (loadId, startHour) => post('/load/shift', { loadId, startHour }),
  curtailLoad: (loadId, curtailPct) => post('/load/shift', { loadId, curtailPct }),

  ask: (question) => post('/ai/chat', { question }),
};
