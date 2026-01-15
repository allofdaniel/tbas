import { useState, useEffect } from 'react';
import { generateColor } from '../utils/colors';

/**
 * useDataLoading - 정적 데이터 로딩 훅
 * - aviation_data.json (절차, 웨이포인트, 공역 등)
 * - chart_bounds.json (차트 경계)
 * - atc_sectors.json (ATC 섹터)
 * - korea_airspace.json (한국 공역 데이터)
 */
export default function useDataLoading() {
  // Aviation data
  const [data, setData] = useState(null);
  const [sidVisible, setSidVisible] = useState({});
  const [starVisible, setStarVisible] = useState({});
  const [apchVisible, setApchVisible] = useState({});
  const [procColors, setProcColors] = useState({ SID: {}, STAR: {}, APPROACH: {} });

  // Chart data
  const [chartBounds, setChartBounds] = useState({});
  const [chartOpacities, setChartOpacities] = useState({});

  // ATC data
  const [atcData, setAtcData] = useState(null);

  // Korea airspace data
  const [koreaAirspaceData, setKoreaAirspaceData] = useState(null);

  // Load aviation data
  useEffect(() => {
    fetch('/aviation_data.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        const sidKeys = Object.keys(json.procedures?.SID || {});
        const starKeys = Object.keys(json.procedures?.STAR || {});
        const apchKeys = Object.keys(json.procedures?.APPROACH || {});
        setSidVisible(Object.fromEntries(sidKeys.map((k) => [k, false])));
        setStarVisible(Object.fromEntries(starKeys.map((k) => [k, false])));
        setApchVisible(Object.fromEntries(apchKeys.map((k) => [k, false])));
        setProcColors({
          SID: Object.fromEntries(sidKeys.map((k, i) => [k, generateColor(i, sidKeys.length, 120)])),
          STAR: Object.fromEntries(starKeys.map((k, i) => [k, generateColor(i, starKeys.length, 30)])),
          APPROACH: Object.fromEntries(apchKeys.map((k, i) => [k, generateColor(i, apchKeys.length, 200)])),
        });
      });
  }, []);

  // Load chart bounds
  useEffect(() => {
    fetch('/charts/chart_bounds.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((bounds) => {
        setChartBounds(bounds);
        setChartOpacities(Object.fromEntries(Object.keys(bounds).map(k => [k, 0.7])));
        console.log(`Loaded chart bounds for ${Object.keys(bounds).length} charts`);
      })
      .catch((err) => console.warn('Failed to load chart bounds:', err));
  }, []);

  // Load ATC sectors
  useEffect(() => {
    fetch('/atc_sectors.json')
      .then((res) => res.json())
      .then((data) => setAtcData(data))
      .catch((err) => console.warn('Failed to load ATC sectors:', err));
  }, []);

  // Load Korea airspace data
  useEffect(() => {
    fetch('/data/korea_airspace.json')
      .then((res) => res.json())
      .then((data) => {
        setKoreaAirspaceData(data);
        console.log(`Loaded Korea airspace: ${data.waypoints?.length} waypoints, ${data.routes?.length} routes, ${data.navaids?.length} navaids, ${data.airspaces?.length} airspaces (AIRAC ${data.metadata?.airac})`);
      })
      .catch((err) => console.warn('Failed to load Korea airspace data:', err));
  }, []);

  return {
    // Aviation data
    data,
    sidVisible,
    setSidVisible,
    starVisible,
    setStarVisible,
    apchVisible,
    setApchVisible,
    procColors,

    // Chart data
    chartBounds,
    chartOpacities,
    setChartOpacities,

    // ATC data
    atcData,

    // Korea airspace data
    koreaAirspaceData,
  };
}
