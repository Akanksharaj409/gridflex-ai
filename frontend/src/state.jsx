import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { api } from './api';

const GridContext = createContext(null);

/**
 * Single source of truth for the simulated clock, the scenario and whether the
 * plan has been applied. Pages read from here rather than each polling the API,
 * so a scenario switch moves every page at once.
 */
export function GridProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [sim, setSim] = useState(null);
  const [error, setError] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [revision, setRevision] = useState(0); // bumped whenever server state changes
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const state = await api.simState();
      setSim(state);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const mutate = useCallback(async (fn) => {
    try {
      await fn();
      await refresh();
      setRevision((r) => r + 1);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [refresh]);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(e.message));
    refresh();
  }, [refresh]);

  // Auto-play walks the simulated clock forward one hour at a time.
  useEffect(() => {
    if (!autoPlay) {
      clearInterval(timer.current);
      return undefined;
    }
    timer.current = setInterval(() => {
      mutate(() => api.advance(1));
    }, 2500);
    return () => clearInterval(timer.current);
  }, [autoPlay, mutate]);

  const value = useMemo(() => ({
    config,
    sim,
    error,
    revision,
    autoPlay,
    setAutoPlay,
    setScenario: (id) => mutate(() => api.setScenario(id)),
    setHour: (h) => mutate(() => api.setHour(h)),
    advance: (by) => mutate(() => api.advance(by)),
    setBatterySoc: (soc) => mutate(() => api.setBatterySoc(soc)),
    applyPlan: () => mutate(() => api.applyPlan()),
    revertPlan: () => mutate(() => api.revertPlan()),
    shiftLoad: (id, hour) => mutate(() => api.shiftLoad(id, hour)),
    curtailLoad: (id, pct) => mutate(() => api.curtailLoad(id, pct)),
    reset: () => mutate(() => api.resetSim()),
  }), [config, sim, error, revision, autoPlay, mutate]);

  return <GridContext.Provider value={value}>{children}</GridContext.Provider>;
}

export const useGrid = () => {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error('useGrid must be used inside GridProvider');
  return ctx;
};

/**
 * Fetch helper that re-runs whenever server state changes.
 * Keeps the previous value while refetching so charts do not flash empty.
 */
export function useEndpoint(fetcher, deps = []) {
  const { revision } = useGrid();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);

  return { data, loading, error };
}
