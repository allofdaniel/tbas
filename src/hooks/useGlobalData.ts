/**
 * useGlobalData Hook
 * Global aviation data lazy-loading
 * - Fetches JSON only when the corresponding layer is toggled ON
 * - Caches data in memory to avoid re-fetching
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface GlobalDataState {
  airports: unknown[] | null;
  navaids: unknown[] | null;
  heliports: unknown[] | null;
  waypoints: unknown[] | null;
  airways: unknown[] | null;
  holdings: unknown[] | null;
  ctrlAirspace: unknown[] | null;
  restrAirspace: unknown[] | null;
  firUir: unknown[] | null;
}

export interface GlobalDataCounts {
  airports: number;
  navaids: number;
  heliports: number;
  waypoints: number;
  airways: number;
  holdings: number;
  ctrlAirspace: number;
  restrAirspace: number;
  firUir: number;
}

const DATA_FILES: Record<keyof GlobalDataState, string> = {
  airports: '/data/global_airports.json',
  navaids: '/data/global_navaids.json',
  heliports: '/data/global_heliports.json',
  waypoints: '/data/global_waypoints.json',
  airways: '/data/global_airways.json',
  holdings: '/data/global_holdings.json',
  ctrlAirspace: '/data/global_ctrl_airspace.json',
  restrAirspace: '/data/global_restr_airspace.json',
  firUir: '/data/global_fir_uir.json',
};

const useGlobalData = (
  showAirports: boolean,
  showNavaids: boolean,
  showHeliports: boolean,
  showWaypoints: boolean,
  showAirways: boolean,
  showHoldings: boolean,
  showCtrlAirspace: boolean,
  showRestrAirspace: boolean,
  showFirUir: boolean,
): { data: GlobalDataState; counts: GlobalDataCounts; loading: Record<string, boolean> } => {
  const [data, setData] = useState<GlobalDataState>({
    airports: null,
    navaids: null,
    heliports: null,
    waypoints: null,
    airways: null,
    holdings: null,
    ctrlAirspace: null,
    restrAirspace: null,
    firUir: null,
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (key: keyof GlobalDataState) => {
    if (fetchedRef.current.has(key)) return;
    fetchedRef.current.add(key);
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const resp = await fetch(DATA_FILES[key]);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(prev => ({ ...prev, [key]: json }));
    } catch (err) {
      console.error(`[GlobalData] Failed to load ${key}:`, err);
      fetchedRef.current.delete(key);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  // Trigger fetch when toggle turns ON
  useEffect(() => { if (showAirports && !data.airports) fetchData('airports'); }, [showAirports]);
  useEffect(() => { if (showNavaids && !data.navaids) fetchData('navaids'); }, [showNavaids]);
  useEffect(() => { if (showHeliports && !data.heliports) fetchData('heliports'); }, [showHeliports]);
  useEffect(() => { if (showWaypoints && !data.waypoints) fetchData('waypoints'); }, [showWaypoints]);
  useEffect(() => { if (showAirways && !data.airways) fetchData('airways'); }, [showAirways]);
  useEffect(() => { if (showHoldings && !data.holdings) fetchData('holdings'); }, [showHoldings]);
  useEffect(() => { if (showCtrlAirspace && !data.ctrlAirspace) fetchData('ctrlAirspace'); }, [showCtrlAirspace]);
  useEffect(() => { if (showRestrAirspace && !data.restrAirspace) fetchData('restrAirspace'); }, [showRestrAirspace]);
  useEffect(() => { if (showFirUir && !data.firUir) fetchData('firUir'); }, [showFirUir]);

  const counts: GlobalDataCounts = {
    airports: data.airports?.length || 0,
    navaids: data.navaids?.length || 0,
    heliports: data.heliports?.length || 0,
    waypoints: data.waypoints?.length || 0,
    airways: data.airways?.length || 0,
    holdings: data.holdings?.length || 0,
    ctrlAirspace: data.ctrlAirspace?.length || 0,
    restrAirspace: data.restrAirspace?.length || 0,
    firUir: data.firUir?.length || 0,
  };

  return { data, counts, loading };
};

export default useGlobalData;
