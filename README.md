# GridFlex

Neighbourhood-level energy management for a community that generates its own renewable power.

The problem is timing, not quantity. A 150-home community with 560 kWp of rooftop solar
generates more than it needs at 13:00 and far less than it needs at 20:00 — exactly when the
distribution utility restricts how much it may import. GridFlex forecasts both sides of that
imbalance, detects the hours where it becomes a shortage, and works out what to do about it.

**Predict → detect → optimise → act → measure.**

---

## Running it

```bash
npm run install:all
npm run dev
```

Frontend on http://localhost:5173, API on http://localhost:4000.

```bash
npm test          # engine invariants across all four scenarios
npm run build     # production frontend bundle
```

No database and no API key are required. Both are optional upgrades — see
[Configuration](#configuration).

---

## What it does

| Module | What it produces |
| --- | --- |
| Simulation | 24-hour weather, generation and demand for four scenarios, plus 14 days of seeded history |
| Renewable forecasting | Clear-sky PV model attenuated by forecast cloud, bias-corrected against history |
| Demand forecasting | Weather-normalised hour-of-day baseline learned from history, scaled by forecast temperature |
| Shortage detection | Hours where forecast grid import exceeds the sanctioned import cap, grouped into windows |
| Battery dispatch | Value-aware charge/discharge respecting power, capacity and reserve limits |
| Load shifting | Best start hour per flexible load, searched against the real dispatch objective |
| Curtailment | Last-resort trimming of HVAC, within a comfort band |
| Impact | Cost, peak, CO₂ and renewable utilisation against a do-nothing baseline |
| Assistant | Questions answered from the computed plan, optionally phrased by Gemini |

### The engine, in the order it runs

1. **Forecast.** Demand comes from a weather-normalised hour-of-day baseline learned from 14 days
   of seeded metered history, scaled by the forecast temperature and corrected for recent level.
   Solar comes from a clear-sky shape times rated output times cloud attenuation, with a bias
   factor fitted to history. The weather input is deliberately blurred with an error that grows
   with lead time, because a forecaster given perfect weather is not a forecaster.

2. **Dispatch the battery.** Charging is greedy — surplus renewable is free and would otherwise be
   curtailed, so there is never a reason to refuse it. Discharging is *not* chronological: a naive
   "discharge whenever short" rule empties the battery into the 17:00 shoulder and leaves nothing
   for the 20:00 peak. Instead, deficit hours are ranked by value (tariff × deficit) and each
   allocation is bounded by the energy that can be spared without pushing any later hour below the
   reserve floor.

3. **Shift flexible load.** Each shiftable load is searched across every legal start hour by
   **re-running the full battery dispatch for each candidate** and reading the real objective back.
   This matters: a proxy signal ("is there spare solar right now?") reports no spare solar anywhere
   once the battery is soaking up the midday surplus, and the search degenerates into "pick the
   earliest cheap hour" in every scenario. Only the single best move is applied per iteration —
   applying all proposals at once sends every load into the same hour and rebuilds the peak
   somewhere else. Candidates are restricted to hours still ahead today, because the horizon wraps
   past midnight and a recommendation you cannot execute today is fiction.

4. **Curtail, only if needed.** HVAC setpoints are trimmed within a comfort band, on the hours the
   first two levers could not clear. Comfort is the last thing spent.

5. **Measure.** Three cases are scored on the same weather and the same horizon: do nothing,
   battery only, and the full plan. Battery-only is reported separately so storage and demand
   response are never credited with the same kilowatt-hour twice.

### What counts as a shortage

Not "the lights go out". The community's connection has a sanctioned load of 420 kW, tightened to
340 kW across the 18:00–22:00 evening window. A shortage is the amount by which forecast grid
import exceeds that ceiling — the number a distribution utility actually acts on, and the one
demand response can close.

---

## Architecture

```
React (Vite)  ──REST──▶  Express  ──▶  optimiser ──▶ forecasting
                                   │              └─▶ battery dispatch
                                   │              └─▶ load shifting
                                   │              └─▶ impact
                                   └──▶  in-memory store  ◀── optional Mongo
```

```
backend/
  server.js
  scripts/smoke.mjs              engine invariants, run by `npm test`
  src/
    config/system.js             every physical and commercial constant
    config/db.js                 optional Mongo connection
    data/store.js                working set + mutation listeners
    data/mongoAdapter.js         optional write-through persistence
    sim/simulator.js             weather, generation, demand, scenarios
    services/forecasting.js      demand + solar prediction, backtest
    services/batteryOptimization.js  value-aware dispatch
    services/shortageDetection.js    import-cap breaches, grouped
    services/loadShifting.js     candidate search + curtailment sizing
    services/optimizer.js        orchestration, action list
    services/impactCalculator.js three-case scoring
    services/planService.js      memoised plan
    services/aiService.js        grounded explainer + optional Gemini
    routes/                      energy, plan, sim, ai
    utils/calculations.js        tariff, emissions, curve shapes
frontend/
  src/pages/                     Dashboard, Forecast, Battery, DemandResponse,
                                 Neighbourhood, Alerts, Impact, Discom, Assistant
  src/components/                charts + UI primitives
  src/state.jsx                  simulated clock, scenario, plan status
```

Every constant that shapes the model lives in `backend/src/config/system.js` — battery size,
tariff bands, import caps, flexible loads and their constraints. Retuning the whole simulation is
a single-file edit.

---

## API

| Method | Endpoint | Returns |
| --- | --- | --- |
| GET | `/api/health` | Storage mode, assistant backend, seeded reading count |
| GET | `/api/energy/config` | All physical and commercial constants |
| GET | `/api/energy/current` | Instantaneous snapshot at the simulated clock |
| GET | `/api/energy/today` | Full simulated day, with the do-nothing baseline |
| GET | `/api/energy/history?days=n` | Seeded metered history |
| GET | `/api/energy/neighbourhood` | Per-connection load breakdown |
| GET | `/api/dashboard` | Everything the main page needs, in one call |
| GET | `/api/forecast` | 24-hour forecast with uncertainty bands and backtest skill |
| GET | `/api/battery/status` | Config, live state, hourly dispatch schedule |
| GET | `/api/shortage/prediction` | Shortage windows before and after optimisation |
| GET | `/api/recommendations` | Ordered action list and the flexible-load table |
| GET | `/api/impact` | Three cases, savings, annualised figures |
| GET | `/api/discom` | Feeder-level view for the utility |
| GET | `/api/alerts` | Alert feed and operator log |
| POST | `/api/plan/apply` · `/api/plan/revert` | Commit or roll back the plan |
| POST | `/api/load/shift` | Operator override on a single load |
| POST | `/api/sim/scenario` · `/hour` · `/advance` · `/battery` · `/reset` | Drive the simulation |
| POST | `/api/ai/chat` | Ask a question about the live plan |
| GET | `/api/ai/facts` | The exact facts the assistant is allowed to cite |

---

## Configuration

Copy `backend/.env.example` to `backend/.env`. Everything is optional.

| Variable | Effect if unset |
| --- | --- |
| `API_PORT` | API binds 4000. **Not `PORT`** — dev tooling sets `PORT` for the web server, and inheriting it makes the API fight Vite for the same port. |
| `GEMINI_API_KEY` | Assistant runs on the deterministic explainer |
| `GEMINI_MODEL` | Defaults to `gemini-2.0-flash` |
| `MONGO_URI` | Runs on the in-memory store |
| `MONGO_DB` | Defaults to `gridflex` |

### The assistant

The default is a deterministic explainer that reads the live plan and answers from it. An energy
assistant that invents numbers is worse than no assistant, and a demo must not depend on a network
call. With `GEMINI_API_KEY` set, Gemini phrases the answer instead — but it receives only the
computed facts, is told not to invent any, and is shown the pre-computed answer it must not
contradict. Same numbers, better prose. `GET /api/ai/facts` shows the entire context it is given;
the Assistant page renders it on demand, so any answer can be audited against its inputs.

### Persistence

`MONGO_URI` layers write-through persistence on top of the in-memory store rather than replacing
it — every API read stays a synchronous in-memory read, so a slow database can never stall a
dashboard poll. Mongo does two things: seeds `energyReadings` once on a cold start, and persists
the session (scenario, clock, battery, live schedule, operator log) on change, debounced.

The `mongodb` driver is **not** a declared dependency, so nobody downloads a database driver they
will never use:

```bash
npm install mongodb --prefix backend
```

Setting `MONGO_URI` without it produces an actionable message, not a stack trace.

---

## Demo script

1. **Open the Dashboard on the typical clear day.** Solar covers demand outright, the battery is
   charging, grid import is zero. Point at the reliability card: a 160 kW shortage is already
   forecast for 20:00.
2. **Switch the scenario to "Heatwave evening peak".** Every page moves at once. PV collapses from
   15:00 as haze builds, cooling load stacks onto the evening ramp, and the forecast shortage grows
   past 200 kW against a 340 kW import cap.
3. **Show the Alerts page.** The shortage window is raised from the forecast, not from something
   that has already gone wrong.
4. **Go to Demand response.** Four enrolled loads, each with its own constraint — the EV must be
   full by 06:00, the tank must be filled once a day. The optimiser has found a slot for each,
   and the "why these moves" panel gives the rupee value and the shortage cleared for each one.
5. **Click Apply optimisation.** The live schedule moves.
6. **Land on Impact & savings.** Three cases side by side. On the heatwave day, unserved energy
   above the import cap goes 695 → 470 → 171 kWh across do-nothing, battery-only and the full
   plan, and peak grid import drops 22%. Storage alone closes a third of the gap; storage plus
   demand response closes three quarters. On the clear day the same three cases read
   452 → 193 → 5 kWh, a 31% peak reduction — the residual is small enough that no call to the
   utility is raised.
7. **Finish on the DISCOM feeder view** — the same event seen by the utility, with the
   demand-response capacity it can dispatch without building anything.

Ask the Assistant "why will there be a shortage this evening?" at any point.

---

## Honest limits

- **The data is simulated.** Generation, demand and weather come from a deterministic model, not
  from meters. The forecaster is genuinely fitted to that history and genuinely blurred by
  forecast error, but it is learning the habits of a simulation.
- **The optimiser is a greedy search, not a global optimum.** It evaluates the real objective for
  every candidate slot and applies the best move per iteration. On this problem size that lands on
  or very near the optimum, but it carries no proof.
- **The annualised figures are a straight ×365.** No seasonality, no tariff drift. Order of
  magnitude only, and the UI says so.
- **The Mongo write path has not been exercised against a live server.** The adapter is written and
  the store-hydration contract it depends on is covered by `npm test`, but no MongoDB instance was
  available in the environment where this was built.
- **No authentication.** Every role sees every page. The three audiences in the design — resident,
  community manager, utility — are separate views, not separate accounts.
