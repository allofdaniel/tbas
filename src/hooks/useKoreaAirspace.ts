/**
 * useKoreaAirspace Hook
 * Korea Airspace Routes, Waypoints, NAVAIDs, Airspaces 레이어 관리
 * - 줌 레벨별 표시 제어
 * - 클릭 팝업 (Waypoint, Navaid, Route, Airspace)
 * - 호버 커서 변경
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { ftToM } from '../utils/geometry';
import type { KoreaAirspaceData, KoreaAirport } from './useDataLoading';

interface RoutePoint {
  lon: number;
  lat: number;
  mea_ft?: number;
  name?: string;
}

interface Route {
  name: string;
  type: string;
  points?: RoutePoint[];
}

interface Waypoint {
  name: string;
  lon: number;
  lat: number;
  type?: string;
}

interface Navaid {
  name: string;
  ident?: string;
  lon: number;
  lat: number;
  type: string;
  freq_mhz?: string | null;
}

interface Airspace {
  name: string;
  type: string;
  category?: string;
  boundary: [number, number][];
  upper_limit_ft?: number;
  lower_limit_ft?: number;
  active_time?: string;
}

/**
 * 공역 유형별 색상
 */
const AIRSPACE_COLORS: Record<string, string> = {
  'P': '#FF0000',    // Prohibited - Red
  'R': '#FFA500',    // Restricted - Orange
  'D': '#FFFF00',    // Danger - Yellow
  'MOA': '#800080',  // Military - Purple
  'HTA': '#9932CC',  // Helicopter Training - Dark Orchid
  'CATA': '#4169E1', // Civil Aircraft Training - Royal Blue
  'UA': '#32CD32',   // Ultralight - Lime Green
  'ALERT': '#FF6347' // Alert - Tomato
};

const AIRSPACE_TYPE_NAMES: Record<string, string> = {
  'P': 'Prohibited',
  'R': 'Restricted',
  'D': 'Danger',
  'MOA': 'Military Operations Area',
  'HTA': 'Helicopter Training Area',
  'CATA': 'Civil Aircraft Training Area',
  'UA': 'Ultralight Activity',
  'ALERT': 'Alert Area'
};

/**
 * 3D 루트 리본 폴리곤 생성
 */
const createRouteRibbon = (p1: RoutePoint, p2: RoutePoint, width = 0.003): [number, number][] | null => {
  const dx = p2.lon - p1.lon;
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.0001) return null;
  const px = -dy / len * width;
  const py = dx / len * width;
  return [
    [p1.lon - px, p1.lat - py],
    [p1.lon + px, p1.lat + py],
    [p2.lon + px, p2.lat + py],
    [p2.lon - px, p2.lat - py],
    [p1.lon - px, p1.lat - py]
  ];
};

/**
 * MEA 값 클램프 (max FL600 = 60000ft)
 */
const clampMEA = (mea?: number): number => {
  if (!mea || mea <= 0) return 5000;
  if (mea > 60000) return 5000;
  return mea;
};

/** 좌표 포맷 (DMS) */
const formatCoord = (lat: number, lon: number): string => {
  const fmtDMS = (deg: number, pos: string, neg: string): string => {
    const sign = deg >= 0 ? pos : neg;
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(1);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(4, '0')}"${sign}`;
  };
  return `${fmtDMS(lat, 'N', 'S')} ${fmtDMS(lon, 'E', 'W')}`;
};

/** 공통 팝업 스타일 */
const POPUP_STYLE = `
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  color: #E0E0E0;
  min-width: 200px;
`;

const POPUP_HEADER = (color: string) => `
  font-weight: 700;
  font-size: 14px;
  color: ${color};
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  padding-bottom: 4px;
`;

const POPUP_ROW = `
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
`;

const POPUP_LABEL = `
  color: #9E9E9E;
  font-size: 11px;
`;

const POPUP_VALUE = `
  color: #FFFFFF;
  font-weight: 500;
  text-align: right;
`;

/**
 * Korea Airspace Hook
 */
const useKoreaAirspace = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  koreaAirspaceData: KoreaAirspaceData | null,
  showKoreaRoutes: boolean,
  showKoreaWaypoints: boolean,
  showKoreaNavaids: boolean,
  showKoreaAirspaces: boolean,
  showKoreaAirports: boolean,
  is3DView: boolean,
  show3DAltitude: boolean,
  showKoreaHoldings: boolean,
  showKoreaTerminalWaypoints: boolean
): void => {
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Layer creation effect
  useEffect(() => {
    if (!map?.current || !mapLoaded || !koreaAirspaceData) return;
    if (!map.current.isStyleLoaded()) return;

    const safeRemoveLayer = (id: string): void => {
      try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch { /* ignore */ }
    };
    const safeRemoveSource = (id: string): void => {
      try { if (map.current?.getSource(id)) map.current.removeSource(id); } catch { /* ignore */ }
    };

    // Clean up existing layers
    ['korea-routes', 'korea-routes-3d', 'korea-routes-labels', 'korea-waypoints', 'korea-waypoint-labels', 'korea-navaids', 'korea-navaid-labels',
     'korea-airspaces-fill', 'korea-airspaces-3d', 'korea-airspaces-outline', 'korea-airspaces-labels',
     'korea-airports', 'korea-airport-labels', 'korea-runways', 'korea-ils',
     'korea-holdings', 'korea-holding-labels', 'korea-terminal-waypoints', 'korea-terminal-waypoint-labels'].forEach(safeRemoveLayer);
    ['korea-routes', 'korea-routes-3d', 'korea-waypoints', 'korea-waypoint-labels-src', 'korea-navaids', 'korea-airspaces',
     'korea-airports', 'korea-runways', 'korea-ils', 'korea-holdings', 'korea-terminal-waypoints'].forEach(safeRemoveSource);

    const routes = koreaAirspaceData.routes as Route[] | undefined;
    const waypoints = koreaAirspaceData.waypoints as Waypoint[] | undefined;
    const navaids = koreaAirspaceData.navaids as Navaid[] | undefined;
    const airspaces = koreaAirspaceData.airspaces as Airspace[] | undefined;

    // ========== Routes layer ==========
    if (showKoreaRoutes && routes && routes.length > 0) {
      interface LineFeature {
        type: 'Feature';
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        properties: { name: string; type: string; color: string; pointCount: number };
      }
      const routeLineFeatures: LineFeature[] = routes
        .filter(route => route.points && route.points.length >= 2)
        .map(route => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.points!.map(p => [p.lon, p.lat] as [number, number])
          },
          properties: {
            name: route.name,
            type: route.type,
            color: route.type === 'RNAV' ? '#00BFFF' : '#FFD700',
            pointCount: route.points!.length
          }
        }));

      interface Route3dFeature {
        type: 'Feature';
        geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
        properties: { name: string; color: string; height: number; base: number; type: string };
      }
      const route3dFeatures: Route3dFeature[] = [];
      routes.forEach(route => {
        if (!route.points || route.points.length < 2) return;
        const color = route.type === 'RNAV' ? '#00BFFF' : '#FFD700';
        for (let i = 0; i < route.points.length - 1; i++) {
          const p1 = route.points[i];
          const p2 = route.points[i + 1];
          if (!p1 || !p2) continue;
          const ribbon = createRouteRibbon(p1, p2, 0.004);
          if (!ribbon) continue;
          const alt1 = clampMEA(p1.mea_ft);
          const alt2 = clampMEA(p2.mea_ft);
          const avgAltM = ftToM((alt1 + alt2) / 2);
          route3dFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ribbon] },
            properties: {
              name: route.name,
              color: color,
              height: avgAltM + 50,
              base: avgAltM,
              type: route.type
            }
          });
        }
      });

      if (routeLineFeatures.length > 0) {
        map.current?.addSource('korea-routes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: routeLineFeatures }
        });

        if (is3DView && show3DAltitude && route3dFeatures.length > 0) {
          map.current?.addSource('korea-routes-3d', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: route3dFeatures }
          });
          map.current?.addLayer({
            id: 'korea-routes-3d',
            type: 'fill-extrusion',
            source: 'korea-routes-3d',
            paint: {
              'fill-extrusion-color': ['get', 'color'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'base'],
              'fill-extrusion-opacity': 0.7
            }
          });
        } else {
          map.current?.addLayer({
            id: 'korea-routes',
            type: 'line',
            source: 'korea-routes',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 2, 12, 3],
              'line-opacity': 0.7,
              'line-dasharray': [2, 1]
            }
          });
        }

        map.current?.addLayer({
          id: 'korea-routes-labels',
          type: 'symbol',
          source: 'korea-routes',
          minzoom: 6,
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-rotation-alignment': 'map',
            'text-allow-overlap': false,
            'symbol-spacing': 300
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(0,0,0,0.9)',
            'text-halo-width': 1.5
          }
        });
      }
    }

    // ========== Waypoints layer ==========
    if (showKoreaWaypoints && waypoints && waypoints.length > 0) {
      const waypointAltitudes: Record<string, number> = {};
      if (routes) {
        routes.forEach(route => {
          if (route.points) {
            route.points.forEach(p => {
              if (p.name && p.mea_ft && p.mea_ft > 0 && p.mea_ft <= 60000) {
                const currentAlt = waypointAltitudes[p.name];
                if (!currentAlt || currentAlt < p.mea_ft) {
                  waypointAltitudes[p.name] = p.mea_ft;
                }
              }
            });
          }
        });
      }

      if (is3DView && show3DAltitude) {
        interface Wp3dFeature {
          type: 'Feature';
          geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
          properties: { name: string; height: number; base: number; color: string; type: string; lat: number; lon: number; alt_ft: number };
        }
        const wp3dFeatures: Wp3dFeature[] = [];
        waypoints.forEach(wp => {
          const altFt = waypointAltitudes[wp.name] || 5000;
          const altM = ftToM(altFt);
          const size = 0.008;
          const coords: [number, number][] = [
            [wp.lon, wp.lat + size],
            [wp.lon + size, wp.lat],
            [wp.lon, wp.lat - size],
            [wp.lon - size, wp.lat],
            [wp.lon, wp.lat + size]
          ];
          wp3dFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: {
              name: wp.name,
              height: altM + 100,
              base: altM,
              color: '#00FF7F',
              type: wp.type || 'WPT',
              lat: wp.lat,
              lon: wp.lon,
              alt_ft: altFt
            }
          });
        });

        map.current?.addSource('korea-waypoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: wp3dFeatures }
        });
        map.current?.addLayer({
          id: 'korea-waypoints',
          type: 'fill-extrusion',
          source: 'korea-waypoints',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.8
          }
        });
      } else {
        interface WpFeature {
          type: 'Feature';
          geometry: { type: 'Point'; coordinates: [number, number] };
          properties: { name: string; type: string; lat: number; lon: number; alt_ft: number | null };
        }
        const wpFeatures: WpFeature[] = waypoints.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
          properties: {
            name: wp.name,
            type: wp.type || 'WPT',
            lat: wp.lat,
            lon: wp.lon,
            alt_ft: waypointAltitudes[wp.name] || null
          }
        }));

        map.current?.addSource('korea-waypoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: wpFeatures }
        });
        map.current?.addLayer({
          id: 'korea-waypoints',
          type: 'circle',
          source: 'korea-waypoints',
          minzoom: 7,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 4, 14, 6],
            'circle-color': '#00FF7F',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      // Waypoint labels
      interface LabelFeature {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] | [number, number, number] };
        properties: { name: string; altitude_ft: number | null; label: string };
      }
      if (is3DView && show3DAltitude) {
        const labelFeatures: LabelFeature[] = waypoints.map(wp => {
          const altFt = waypointAltitudes[wp.name] || null;
          const altM = altFt ? ftToM(altFt) : 0;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [wp.lon, wp.lat, altM] },
            properties: {
              name: wp.name,
              altitude_ft: altFt,
              label: altFt ? `${wp.name}\n${altFt}ft` : wp.name
            }
          };
        });
        map.current?.addSource('korea-waypoint-labels-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: labelFeatures }
        });
        map.current?.addLayer({
          id: 'korea-waypoint-labels',
          type: 'symbol',
          source: 'korea-waypoint-labels-src',
          minzoom: 7,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, -1],
            'text-anchor': 'bottom',
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'symbol-z-elevate': true
          },
          paint: {
            'text-color': '#00FF7F',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1
          }
        });
      } else {
        const labelFeatures: LabelFeature[] = waypoints.map(wp => {
          const altFt = waypointAltitudes[wp.name] || null;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
            properties: {
              name: wp.name,
              altitude_ft: altFt,
              label: altFt ? `${wp.name}\n${altFt}ft` : wp.name
            }
          };
        });
        map.current?.addSource('korea-waypoint-labels-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: labelFeatures }
        });
        map.current?.addLayer({
          id: 'korea-waypoint-labels',
          type: 'symbol',
          source: 'korea-waypoint-labels-src',
          minzoom: 8,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, 1],
            'text-anchor': 'top',
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
          },
          paint: {
            'text-color': '#00FF7F',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1
          }
        });
      }
    }

    // ========== NAVAIDs layer ==========
    if (showKoreaNavaids && navaids && navaids.length > 0) {
      interface NavaidFeature {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: { ident: string; fullName: string; type: string; freq: string; label: string; lat: number; lon: number };
      }
      const navaidFeatures: NavaidFeature[] = navaids.map(nav => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [nav.lon, nav.lat] },
        properties: {
          ident: nav.ident || nav.name,
          fullName: nav.name,
          type: nav.type,
          freq: nav.freq_mhz || '',
          label: `${nav.ident || nav.name} ${nav.type}${nav.freq_mhz ? '\n' + nav.freq_mhz + ' MHz' : ''}`,
          lat: nav.lat,
          lon: nav.lon
        }
      }));

      map.current?.addSource('korea-navaids', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: navaidFeatures }
      });
      map.current?.addLayer({
        id: 'korea-navaids',
        type: 'circle',
        source: 'korea-navaids',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 8, 6, 12, 10],
          'circle-color': [
            'match', ['get', 'type'],
            'VOR', '#FF69B4',
            'VORTAC', '#FF69B4',
            'VORDME', '#FF1493',
            'NDB', '#FFA500',
            'DME', '#00CED1',
            '#FF69B4'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.current?.addLayer({
        id: 'korea-navaid-labels',
        type: 'symbol',
        source: 'korea-navaids',
        minzoom: 6,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': [
            'match', ['get', 'type'],
            'VOR', '#FF69B4',
            'VORTAC', '#FF69B4',
            'VORDME', '#FF1493',
            'NDB', '#FFA500',
            'DME', '#00CED1',
            '#FF69B4'
          ],
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1
        }
      });
    }

    // ========== Airports layer ==========
    if (showKoreaAirports && koreaAirspaceData.airports && koreaAirspaceData.airports.length > 0) {
      const aptData = koreaAirspaceData.airports as KoreaAirport[];

      // Airport marker points
      interface AptFeature {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: Record<string, unknown>;
      }
      const aptFeatures: AptFeature[] = aptData.map(apt => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [apt.lon, apt.lat] },
        properties: {
          icao: apt.icao,
          iata: apt.iata || '',
          name: apt.name,
          city: apt.city || '',
          elevation_ft: apt.elevation_ft,
          type: apt.type,
          ifr: apt.ifr,
          label: `${apt.icao}${apt.iata ? '/' + apt.iata : ''}\n${apt.elevation_ft}ft`,
          runways: apt.runways.length,
          ils_count: apt.ils.length,
          comms_count: apt.comms.length,
          gates_count: apt.gates?.length || 0,
          freq_count: apt.frequencies?.length || 0,
          transition_alt: apt.transition_alt,
          transition_level: apt.transition_level,
          mag_var: apt.mag_var,
          lat: apt.lat,
          lon: apt.lon,
        }
      }));

      map.current?.addSource('korea-airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: aptFeatures }
      });
      map.current?.addLayer({
        id: 'korea-airports',
        type: 'circle',
        source: 'korea-airports',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 8, 12, 14],
          'circle-color': [
            'match', ['get', 'type'],
            'civil', '#4FC3F7',
            'military', '#EF5350',
            'joint', '#FFB74D',
            '#4FC3F7'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        }
      });
      map.current?.addLayer({
        id: 'korea-airport-labels',
        type: 'symbol',
        source: 'korea-airports',
        minzoom: 5,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13],
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': [
            'match', ['get', 'type'],
            'civil', '#4FC3F7',
            'military', '#EF5350',
            'joint', '#FFB74D',
            '#4FC3F7'
          ],
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5,
        }
      });

      // Runway lines
      interface RwyFeature {
        type: 'Feature';
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        properties: Record<string, unknown>;
      }
      const rwyFeatures: RwyFeature[] = [];
      aptData.forEach(apt => {
        apt.runways.forEach(rwy => {
          if (!rwy.lat || !rwy.lon || !rwy.heading_true) return;
          const hdg = (rwy.heading_true * Math.PI) / 180;
          const lenDeg = (rwy.length_m / 111320) * 0.5;
          rwyFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [rwy.lon - Math.sin(hdg) * lenDeg, rwy.lat - Math.cos(hdg) * lenDeg],
                [rwy.lon + Math.sin(hdg) * lenDeg, rwy.lat + Math.cos(hdg) * lenDeg],
              ]
            },
            properties: {
              icao: apt.icao,
              rwy_id: rwy.id,
              length_m: rwy.length_m,
              width_m: rwy.width_m,
              surface: rwy.surface,
              elevation_ft: rwy.elevation_ft,
              heading: rwy.heading_true,
              lights: rwy.lights,
              ils_ident: rwy.ils_ident || '',
            }
          });
        });
      });

      if (rwyFeatures.length > 0) {
        map.current?.addSource('korea-runways', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: rwyFeatures }
        });
        map.current?.addLayer({
          id: 'korea-runways',
          type: 'line',
          source: 'korea-runways',
          minzoom: 8,
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 4, 16, 10],
            'line-opacity': 0.9,
          }
        });
      }

      // ILS localizer lines
      interface IlsFeature {
        type: 'Feature';
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        properties: Record<string, unknown>;
      }
      const ilsFeatures: IlsFeature[] = [];
      aptData.forEach(apt => {
        apt.ils.forEach(ils => {
          if (!ils.llz_lat || !ils.llz_lon || !ils.course) return;
          const crs = (ils.course * Math.PI) / 180;
          const extLen = 0.08; // ~9km approach line
          ilsFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [ils.llz_lon, ils.llz_lat],
                [ils.llz_lon - Math.sin(crs) * extLen, ils.llz_lat - Math.cos(crs) * extLen],
              ]
            },
            properties: {
              icao: apt.icao,
              runway: ils.runway,
              ident: ils.ident,
              freq: ils.freq,
              category: ils.category,
              course: ils.course,
              gs_angle: ils.gs_angle,
            }
          });
        });
      });

      if (ilsFeatures.length > 0) {
        map.current?.addSource('korea-ils', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: ilsFeatures }
        });
        map.current?.addLayer({
          id: 'korea-ils',
          type: 'line',
          source: 'korea-ils',
          minzoom: 9,
          paint: {
            'line-color': '#00E676',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 3],
            'line-opacity': 0.7,
            'line-dasharray': [4, 2],
          }
        });
      }
    }

    // ========== Airspaces layer ==========
    if (showKoreaAirspaces && airspaces && airspaces.length > 0) {
      interface AirspaceFeature {
        type: 'Feature';
        geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
        properties: {
          name: string;
          type: string;
          typeName: string;
          category: string;
          color: string;
          upper_limit: number;
          lower_limit: number;
          upperAltM: number;
          lowerAltM: number;
          active_time: string;
        };
      }
      const airspaceFeatures: AirspaceFeature[] = airspaces
        .filter(asp => asp.boundary && asp.boundary.length >= 3)
        .map(asp => {
          const boundary = [...asp.boundary];
          if (boundary.length > 0) {
            const first = boundary[0];
            const last = boundary[boundary.length - 1];
            if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
              const f0 = first[0];
              const f1 = first[1];
              if (f0 !== undefined && f1 !== undefined) {
                boundary.push([f0, f1]);
              }
            }
          }
          return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [boundary] },
            properties: {
              name: asp.name,
              type: asp.type,
              typeName: AIRSPACE_TYPE_NAMES[asp.type] || asp.type,
              category: asp.category || '',
              color: AIRSPACE_COLORS[asp.type] || '#808080',
              upper_limit: asp.upper_limit_ft || 5000,
              lower_limit: asp.lower_limit_ft || 0,
              upperAltM: ftToM(asp.upper_limit_ft || 5000),
              lowerAltM: ftToM(asp.lower_limit_ft || 0),
              active_time: asp.active_time || ''
            }
          };
        });

      map.current?.addSource('korea-airspaces', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: airspaceFeatures }
      });

      if (is3DView && show3DAltitude) {
        map.current?.addLayer({
          id: 'korea-airspaces-3d',
          type: 'fill-extrusion',
          source: 'korea-airspaces',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'upperAltM'],
            'fill-extrusion-base': ['get', 'lowerAltM'],
            'fill-extrusion-opacity': 0.25
          }
        });
      } else {
        map.current?.addLayer({
          id: 'korea-airspaces-fill',
          type: 'fill',
          source: 'korea-airspaces',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.15
          }
        });
      }

      map.current?.addLayer({
        id: 'korea-airspaces-outline',
        type: 'line',
        source: 'korea-airspaces',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.8
        }
      });

      map.current?.addLayer({
        id: 'korea-airspaces-labels',
        type: 'symbol',
        source: 'korea-airspaces',
        minzoom: 6,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
          'symbol-placement': 'point'
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1
        }
      });
    }

    // ========== Holdings layer ==========
    const holdings = koreaAirspaceData.holdings;
    if (showKoreaHoldings && holdings && holdings.length > 0) {
      const holdingFeatures = holdings
        .filter(h => h.lat && h.lon)
        .map(h => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
          properties: {
            waypoint: h.waypoint,
            name: h.name || h.waypoint,
            inbound_course: h.inbound_course,
            turn: h.turn || 'R',
            leg_time: h.leg_time,
            leg_length: h.leg_length,
            speed: h.speed,
            min_alt: h.min_alt,
            max_alt: h.max_alt,
            lat: h.lat,
            lon: h.lon
          }
        }));

      map.current?.addSource('korea-holdings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: holdingFeatures }
      });

      map.current?.addLayer({
        id: 'korea-holdings',
        type: 'circle',
        source: 'korea-holdings',
        minzoom: 6,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 7, 14, 10],
          'circle-color': '#FF69B4',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.85
        }
      });

      map.current?.addLayer({
        id: 'korea-holding-labels',
        type: 'symbol',
        source: 'korea-holdings',
        minzoom: 8,
        layout: {
          'text-field': ['get', 'waypoint'],
          'text-size': 10,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.5],
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#FF69B4',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1
        }
      });
    }

    // ========== Terminal Waypoints layer ==========
    const termWpts = koreaAirspaceData.terminalWaypoints;
    if (showKoreaTerminalWaypoints && termWpts && termWpts.length > 0) {
      const termWptFeatures = termWpts
        .filter(w => w.lat && w.lon)
        .map(w => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
          properties: {
            id: w.id,
            name: w.name || w.id,
            type: w.type || '',
            region: w.region || '',
            lat: w.lat,
            lon: w.lon
          }
        }));

      map.current?.addSource('korea-terminal-waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: termWptFeatures }
      });

      map.current?.addLayer({
        id: 'korea-terminal-waypoints',
        type: 'circle',
        source: 'korea-terminal-waypoints',
        minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 5, 15, 7],
          'circle-color': '#20B2AA',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1,
          'circle-opacity': 0.8
        }
      });

      map.current?.addLayer({
        id: 'korea-terminal-waypoint-labels',
        type: 'symbol',
        source: 'korea-terminal-waypoints',
        minzoom: 10,
        layout: {
          'text-field': ['get', 'id'],
          'text-size': 9,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.3],
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#20B2AA',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1
        }
      });
    }
  }, [map, mapLoaded, koreaAirspaceData, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports, is3DView, show3DAltitude, showKoreaHoldings, showKoreaTerminalWaypoints]);

  // ========== Click & Hover interaction effect ==========
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const m = map.current;
    const handlers: Array<{ event: string; layer: string; fn: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => void }> = [];

    const removePopup = () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };

    const showPopup = (lngLat: mapboxgl.LngLat, html: string) => {
      removePopup();
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        maxWidth: '320px',
        className: 'korea-airspace-popup'
      })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(m);
    };

    const setCursor = () => { m.getCanvas().style.cursor = 'pointer'; };
    const resetCursor = () => { m.getCanvas().style.cursor = ''; };

    const addHandler = (layer: string, event: string, fn: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => void) => {
      try {
        if (m.getLayer(layer)) {
          m.on(event as 'click', layer, fn);
          handlers.push({ event, layer, fn });
        }
      } catch { /* layer not ready */ }
    };

    // --- Waypoint click ---
    const onWaypointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const altStr = p.alt_ft ? `${p.alt_ft} ft` : 'N/A';
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#00FF7F')}">WPT ${p.name}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${p.type || 'Waypoint'}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${coord}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">MEA</span><span style="${POPUP_VALUE}">${altStr}</span></div>
        </div>
      `);
    };
    addHandler('korea-waypoints', 'click', onWaypointClick);
    addHandler('korea-waypoint-labels', 'click', onWaypointClick);
    addHandler('korea-waypoints', 'mouseenter', setCursor);
    addHandler('korea-waypoints', 'mouseleave', resetCursor);

    // --- Navaid click ---
    const onNavaidClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const freqStr = p.freq ? `${p.freq} MHz` : 'N/A';
      const typeColor = p.type === 'NDB' ? '#FFA500' : p.type === 'DME' ? '#00CED1' : '#FF69B4';
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(typeColor)}">${p.type} ${p.ident}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${p.fullName || p.ident}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${p.type}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Freq</span><span style="${POPUP_VALUE}">${freqStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${coord}</span></div>
        </div>
      `);
    };
    addHandler('korea-navaids', 'click', onNavaidClick);
    addHandler('korea-navaid-labels', 'click', onNavaidClick);
    addHandler('korea-navaids', 'mouseenter', setCursor);
    addHandler('korea-navaids', 'mouseleave', resetCursor);

    // --- Route click ---
    const onRouteClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const color = (p.color as string) || '#FFD700';
      const typeStr = p.type === 'RNAV' ? 'RNAV (Area Navigation)' : 'ATS (Conventional)';
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(color)}">AWY ${p.name}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${typeStr}</span></div>
          ${p.pointCount ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Fixes</span><span style="${POPUP_VALUE}">${p.pointCount}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-routes', 'click', onRouteClick);
    addHandler('korea-routes-labels', 'click', onRouteClick);
    addHandler('korea-routes-3d', 'click', onRouteClick);
    addHandler('korea-routes', 'mouseenter', setCursor);
    addHandler('korea-routes', 'mouseleave', resetCursor);

    // --- Airport click ---
    const onAirportClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const typeColor = p.type === 'military' ? '#EF5350' : p.type === 'joint' ? '#FFB74D' : '#4FC3F7';
      const typeStr = p.type === 'military' ? 'Military' : p.type === 'joint' ? 'Joint Civil/Military' : 'Civil';
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(typeColor)}">${p.icao}${p.iata ? ' / ' + p.iata : ''}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${p.name}</span></div>
          ${p.city ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">City</span><span style="${POPUP_VALUE}">${p.city}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${typeStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Elevation</span><span style="${POPUP_VALUE}">${p.elevation_ft} ft</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${coord}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">IFR</span><span style="${POPUP_VALUE}">${p.ifr ? 'Yes' : 'No'}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Runways</span><span style="${POPUP_VALUE}">${p.runways}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">ILS</span><span style="${POPUP_VALUE}">${p.ils_count}</span></div>
          ${p.gates_count ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Gates</span><span style="${POPUP_VALUE}">${p.gates_count}</span></div>` : ''}
          ${p.freq_count ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Frequencies</span><span style="${POPUP_VALUE}">${p.freq_count}</span></div>` : ''}
          ${p.transition_alt ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">TA/TL</span><span style="${POPUP_VALUE}">${p.transition_alt}ft / FL${p.transition_level ? Math.round(Number(p.transition_level) / 100) : '?'}</span></div>` : ''}
          ${p.mag_var ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Mag Var</span><span style="${POPUP_VALUE}">${Number(p.mag_var) > 0 ? 'E' : 'W'}${Math.abs(Number(p.mag_var)).toFixed(1)}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-airports', 'click', onAirportClick);
    addHandler('korea-airport-labels', 'click', onAirportClick);
    addHandler('korea-airports', 'mouseenter', setCursor);
    addHandler('korea-airports', 'mouseleave', resetCursor);

    // --- Airspace click ---
    const onAirspaceClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const color = (p.color as string) || '#808080';
      const upperStr = (p.upper_limit as number) >= 60000 ? 'UNL' : `FL${Math.round((p.upper_limit as number) / 100)}`;
      const lowerStr = (p.lower_limit as number) === 0 ? 'GND' : `${p.lower_limit} ft`;
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(color)}">${p.name}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${p.typeName || p.type}</span></div>
          ${p.category ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Category</span><span style="${POPUP_VALUE}">${p.category}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Altitude</span><span style="${POPUP_VALUE}">${lowerStr} ~ ${upperStr}</span></div>
          ${p.active_time ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Active</span><span style="${POPUP_VALUE}">${p.active_time}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-airspaces-fill', 'click', onAirspaceClick);
    addHandler('korea-airspaces-3d', 'click', onAirspaceClick);
    addHandler('korea-airspaces-outline', 'click', onAirspaceClick);
    addHandler('korea-airspaces-fill', 'mouseenter', setCursor);
    addHandler('korea-airspaces-fill', 'mouseleave', resetCursor);
    addHandler('korea-airspaces-outline', 'mouseenter', setCursor);
    addHandler('korea-airspaces-outline', 'mouseleave', resetCursor);

    // --- Holding click ---
    const onHoldingClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const altStr = p.min_alt || p.max_alt
        ? `${p.min_alt || 'N/A'} ~ ${p.max_alt || 'N/A'} ft`
        : 'N/A';
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#FF69B4')}">HOLD ${p.waypoint}</div>
          ${p.name && p.name !== p.waypoint ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${p.name}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Inbound</span><span style="${POPUP_VALUE}">${p.inbound_course}\u00B0</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Turn</span><span style="${POPUP_VALUE}">${p.turn === 'L' ? 'Left' : 'Right'}</span></div>
          ${p.leg_time ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Leg Time</span><span style="${POPUP_VALUE}">${p.leg_time} min</span></div>` : ''}
          ${p.leg_length ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Leg Dist</span><span style="${POPUP_VALUE}">${p.leg_length} NM</span></div>` : ''}
          ${p.speed ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Speed</span><span style="${POPUP_VALUE}">${p.speed} kt</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Altitude</span><span style="${POPUP_VALUE}">${altStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${coord}</span></div>
        </div>
      `);
    };
    addHandler('korea-holdings', 'click', onHoldingClick);
    addHandler('korea-holding-labels', 'click', onHoldingClick);
    addHandler('korea-holdings', 'mouseenter', setCursor);
    addHandler('korea-holdings', 'mouseleave', resetCursor);

    // --- Terminal Waypoint click ---
    const onTermWptClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      showPopup(e.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#20B2AA')}">${p.id}</div>
          ${p.name && p.name !== p.id ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${p.name}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">Terminal WPT</span></div>
          ${p.region ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Region</span><span style="${POPUP_VALUE}">${p.region}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${coord}</span></div>
        </div>
      `);
    };
    addHandler('korea-terminal-waypoints', 'click', onTermWptClick);
    addHandler('korea-terminal-waypoint-labels', 'click', onTermWptClick);
    addHandler('korea-terminal-waypoints', 'mouseenter', setCursor);
    addHandler('korea-terminal-waypoints', 'mouseleave', resetCursor);

    return () => {
      handlers.forEach(({ event, layer, fn }) => {
        try { m.off(event as 'click', layer, fn); } catch { /* ignore */ }
      });
      removePopup();
    };
  }, [map, mapLoaded, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports, showKoreaHoldings, showKoreaTerminalWaypoints]);
};

export default useKoreaAirspace;
