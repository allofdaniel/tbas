/**
 * useKoreaAirspace Hook
 * Korea Airspace Routes, Waypoints, NAVAIDs, Airspaces 레이어 관리
 */
import { useEffect, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { ftToM } from '../utils/geometry';
import type { KoreaAirspaceData } from './useDataLoading';

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
  freq?: string;
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
  is3DView: boolean,
  show3DAltitude: boolean
): void => {
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
     'korea-airspaces-fill', 'korea-airspaces-3d', 'korea-airspaces-outline', 'korea-airspaces-labels'].forEach(safeRemoveLayer);
    ['korea-routes', 'korea-routes-3d', 'korea-waypoints', 'korea-waypoint-labels-src', 'korea-navaids', 'korea-airspaces'].forEach(safeRemoveSource);

    const routes = koreaAirspaceData.routes as Route[] | undefined;
    const waypoints = koreaAirspaceData.waypoints as Waypoint[] | undefined;
    const navaids = koreaAirspaceData.navaids as Navaid[] | undefined;
    const airspaces = koreaAirspaceData.airspaces as Airspace[] | undefined;

    // Routes layer
    if (showKoreaRoutes && routes && routes.length > 0) {
      interface LineFeature {
        type: 'Feature';
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        properties: { name: string; type: string; color: string };
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
            color: route.type === 'RNAV' ? '#00BFFF' : '#FFD700'
          }
        }));

      interface Route3dFeature {
        type: 'Feature';
        geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
        properties: { name: string; color: string; height: number; base: number };
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
              base: avgAltM
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

    // Waypoints layer
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
          properties: { name: string; height: number; base: number; color: string };
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
              color: '#00FF7F'
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
          properties: { name: string; type: string };
        }
        const wpFeatures: WpFeature[] = waypoints.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
          properties: { name: wp.name, type: wp.type || 'WPT' }
        }));

        map.current?.addSource('korea-waypoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: wpFeatures }
        });
        map.current?.addLayer({
          id: 'korea-waypoints',
          type: 'circle',
          source: 'korea-waypoints',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 6],
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

    // NAVAIDs layer
    if (showKoreaNavaids && navaids && navaids.length > 0) {
      interface NavaidFeature {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: { name: string; type: string; freq?: string; label: string };
      }
      const navaidFeatures: NavaidFeature[] = navaids.map(nav => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [nav.lon, nav.lat] },
        properties: {
          name: nav.ident || nav.name,
          type: nav.type,
          freq: nav.freq,
          label: `${nav.ident || ''} ${nav.type}\n${nav.freq || ''}MHz`
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
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 8, 14, 12],
          'circle-color': '#FF69B4',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.current?.addLayer({
        id: 'korea-navaid-labels',
        type: 'symbol',
        source: 'korea-navaids',
        minzoom: 7,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': '#FF69B4',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1
        }
      });
    }

    // Airspaces layer
    if (showKoreaAirspaces && airspaces && airspaces.length > 0) {
      interface AirspaceFeature {
        type: 'Feature';
        geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
        properties: {
          name: string;
          type: string;
          category?: string;
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
              category: asp.category,
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
  }, [map, mapLoaded, koreaAirspaceData, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, is3DView, show3DAltitude]);
};

export default useKoreaAirspace;
