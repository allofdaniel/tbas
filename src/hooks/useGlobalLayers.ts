/**
 * useGlobalLayers Hook
 * Mapbox GL sources/layers for global aviation data
 * - Airports, Navaids, Heliports, Waypoints
 * - Airways, Holdings
 * - Controlled Airspace, Restrictive Airspace, FIR/UIR
 */
import { useEffect, useRef } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import type { MutableRefObject } from 'react';
import type { GlobalDataState } from './useGlobalData';

// All layer/source IDs managed by this hook
const ALL_LAYERS = [
  'global-airports', 'global-airport-labels',
  'global-navaids', 'global-navaid-labels',
  'global-heliports', 'global-heliport-labels',
  'global-waypoints', 'global-waypoint-labels',
  'global-airways', 'global-airway-labels',
  'global-holdings',
  'global-ctrl-fill', 'global-ctrl-outline', 'global-ctrl-labels',
  'global-restr-fill', 'global-restr-outline', 'global-restr-labels',
  'global-fir-fill', 'global-fir-outline', 'global-fir-labels',
];

const ALL_SOURCES = [
  'global-airports', 'global-navaids', 'global-heliports',
  'global-waypoints', 'global-airways', 'global-holdings',
  'global-ctrl', 'global-restr', 'global-fir',
];

/** Coordinate DMS format */
const formatCoord = (lat: number, lon: number): string => {
  const fmt = (deg: number, pos: string, neg: string) => {
    const s = deg >= 0 ? pos : neg;
    const a = Math.abs(deg);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const sec = ((a - d - m / 60) * 3600).toFixed(1);
    return `${d}°${String(m).padStart(2, '0')}'${String(sec).padStart(4, '0')}"${s}`;
  };
  return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`;
};

const PS = `font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;line-height:1.5;color:#E0E0E0;min-width:180px;`;
const PH = (c: string) => `font-weight:700;font-size:14px;color:${c};margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;`;
const PR = `display:flex;justify-content:space-between;padding:2px 0;`;
const PL = `color:#9E9E9E;font-size:11px;`;
const PV = `color:#FFF;font-weight:500;text-align:right;`;

const useGlobalLayers = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  globalData: GlobalDataState,
  showAirports: boolean,
  showNavaids: boolean,
  showHeliports: boolean,
  showWaypoints: boolean,
  showAirways: boolean,
  showHoldings: boolean,
  showCtrlAirspace: boolean,
  showRestrAirspace: boolean,
  showFirUir: boolean,
): void => {
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // ========== Layer creation effect ==========
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;
    if (!map.current.isStyleLoaded()) return;
    const m = map.current;

    const safeRemoveLayer = (id: string) => { try { if (m.getLayer(id)) m.removeLayer(id); } catch { /* */ } };
    const safeRemoveSource = (id: string) => { try { if (m.getSource(id)) m.removeSource(id); } catch { /* */ } };

    // Clean all
    ALL_LAYERS.forEach(safeRemoveLayer);
    ALL_SOURCES.forEach(safeRemoveSource);

    // ---- Airports ----
    if (showAirports && globalData.airports) {
      const features = (globalData.airports as Array<Record<string, unknown>>)
        .filter(a => a.lat != null && a.lon != null)
        .map(a => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [a.lon as number, a.lat as number] },
          properties: {
            icao: a.icao, iata: a.iata || '', name: a.name, city: a.city || '',
            elev: a.elev_ft, type: a.type, ifr: a.ifr,
            label: `${a.icao}${a.iata ? '/' + a.iata : ''}`,
            lat: a.lat, lon: a.lon, country: a.country || '',
          }
        }));
      m.addSource('global-airports', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-airports', type: 'circle', source: 'global-airports', minzoom: 3,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 3, 10, 6],
          'circle-color': '#4FC3F7', 'circle-stroke-width': 0.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.8,
        }
      });
      m.addLayer({
        id: 'global-airport-labels', type: 'symbol', source: 'global-airports', minzoom: 7,
        layout: {
          'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#4FC3F7', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 }
      });
    }

    // ---- Navaids ----
    if (showNavaids && globalData.navaids) {
      const features = (globalData.navaids as Array<Record<string, unknown>>)
        .filter(n => (n.lat != null && n.lon != null) || (n.dme_lat != null && n.dme_lon != null))
        .map(n => {
          const lat = (n.lat as number) ?? (n.dme_lat as number);
          const lon = (n.lon as number) ?? (n.dme_lon as number);
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lon, lat] },
            properties: {
              ident: n.ident, name: n.name, type: n.type, freq: n.freq || '',
              cat: n.cat || '', label: `${n.ident} ${n.type}`,
              lat, lon,
            }
          };
        });
      m.addSource('global-navaids', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-navaids', type: 'circle', source: 'global-navaids', minzoom: 5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 4, 12, 7],
          'circle-color': ['match', ['get', 'cat'], 'vhf', '#FF69B4', 'ndb', '#FFA500', 'terminal_ndb', '#FF8C00', '#FF69B4'],
          'circle-stroke-width': 1, 'circle-stroke-color': '#fff',
        }
      });
      m.addLayer({
        id: 'global-navaid-labels', type: 'symbol', source: 'global-navaids', minzoom: 8,
        layout: {
          'text-field': ['get', 'label'], 'text-size': 9, 'text-offset': [0, 1.3], 'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['match', ['get', 'cat'], 'vhf', '#FF69B4', 'ndb', '#FFA500', 'terminal_ndb', '#FF8C00', '#FF69B4'],
          'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1,
        }
      });
    }

    // ---- Heliports ----
    if (showHeliports && globalData.heliports) {
      const features = (globalData.heliports as Array<Record<string, unknown>>)
        .filter(h => h.lat != null && h.lon != null)
        .map(h => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [h.lon as number, h.lat as number] },
          properties: {
            icao: h.icao, name: h.name, city: h.city || '', elev: h.elev,
            label: String(h.icao), lat: h.lat, lon: h.lon,
          }
        }));
      m.addSource('global-heliports', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-heliports', type: 'circle', source: 'global-heliports', minzoom: 6,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 5],
          'circle-color': '#7B68EE', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff',
        }
      });
      m.addLayer({
        id: 'global-heliport-labels', type: 'symbol', source: 'global-heliports', minzoom: 9,
        layout: {
          'text-field': ['get', 'label'], 'text-size': 9, 'text-offset': [0, 1.2], 'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#7B68EE', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 }
      });
    }

    // ---- Waypoints ----
    if (showWaypoints && globalData.waypoints) {
      const features = (globalData.waypoints as Array<Record<string, unknown>>)
        .filter(w => w.lat != null && w.lon != null)
        .map(w => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [w.lon as number, w.lat as number] },
          properties: { id: w.id, name: w.name || w.id, type: w.type || '', lat: w.lat, lon: w.lon }
        }));
      m.addSource('global-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-waypoints', type: 'circle', source: 'global-waypoints', minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 3],
          'circle-color': '#00FF7F', 'circle-stroke-width': 0.5, 'circle-stroke-color': '#fff',
        }
      });
      m.addLayer({
        id: 'global-waypoint-labels', type: 'symbol', source: 'global-waypoints', minzoom: 10,
        layout: {
          'text-field': ['get', 'id'], 'text-size': 9, 'text-offset': [0, 1], 'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#00FF7F', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 }
      });
    }

    // ---- Airways ----
    if (showAirways && globalData.airways) {
      const features = (globalData.airways as Array<Record<string, unknown>>)
        .filter(a => {
          const pts = a.points as Array<Record<string, unknown>> | undefined;
          return pts && pts.length >= 2;
        })
        .map(a => {
          const pts = a.points as Array<Record<string, number>>;
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: pts.map(p => [p.lon, p.lat]),
            },
            properties: {
              name: a.name, type: a.type === 'R' ? 'RNAV' : 'Conventional',
              color: a.type === 'R' ? '#00BFFF' : '#FFD700',
              pointCount: pts.length,
            }
          };
        });
      m.addSource('global-airways', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-airways', type: 'line', source: 'global-airways', minzoom: 5,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 1, 12, 2],
          'line-opacity': 0.6, 'line-dasharray': [2, 1],
        }
      });
      m.addLayer({
        id: 'global-airway-labels', type: 'symbol', source: 'global-airways', minzoom: 7,
        layout: {
          'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 10,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-rotation-alignment': 'map', 'text-allow-overlap': false, 'symbol-spacing': 400,
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 }
      });
    }

    // ---- Holdings ----
    if (showHoldings && globalData.holdings) {
      const features = (globalData.holdings as Array<Record<string, unknown>>)
        .filter(h => h.lat != null && h.lon != null)
        .map(h => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [h.lon as number, h.lat as number] },
          properties: {
            wpt: h.wpt, name: h.name || h.wpt, course: h.course, turn: h.turn || 'R',
            min_alt: h.min_alt, max_alt: h.max_alt, lat: h.lat, lon: h.lon,
          }
        }));
      m.addSource('global-holdings', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-holdings', type: 'circle', source: 'global-holdings', minzoom: 7,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 10, 5, 14, 8],
          'circle-color': '#FF69B4', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-opacity': 0.8,
        }
      });
    }

    // ---- Controlled Airspace ----
    if (showCtrlAirspace && globalData.ctrlAirspace) {
      const features = (globalData.ctrlAirspace as Array<Record<string, unknown>>)
        .filter(a => {
          const b = a.boundary as number[][] | undefined;
          return b && b.length >= 3;
        })
        .map(a => {
          const boundary = [...(a.boundary as [number, number][])];
          if (boundary.length > 0) {
            const f = boundary[0]; const l = boundary[boundary.length - 1];
            if (f && l && (f[0] !== l[0] || f[1] !== l[1])) boundary.push([f[0], f[1]]);
          }
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [boundary] },
            properties: {
              name: a.name || a.center || '', type: a.type, class: a.class || '',
              lower: a.lower, upper: a.upper, area: a.area,
            }
          };
        });
      m.addSource('global-ctrl', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-ctrl-fill', type: 'fill', source: 'global-ctrl', minzoom: 3,
        paint: { 'fill-color': '#4169E1', 'fill-opacity': 0.08 }
      });
      m.addLayer({
        id: 'global-ctrl-outline', type: 'line', source: 'global-ctrl', minzoom: 3,
        paint: { 'line-color': '#4169E1', 'line-width': 1, 'line-opacity': 0.5 }
      });
      m.addLayer({
        id: 'global-ctrl-labels', type: 'symbol', source: 'global-ctrl', minzoom: 6,
        layout: {
          'text-field': ['get', 'name'], 'text-size': 9,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#4169E1', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 }
      });
    }

    // ---- Restrictive Airspace ----
    if (showRestrAirspace && globalData.restrAirspace) {
      const features = (globalData.restrAirspace as Array<Record<string, unknown>>)
        .filter(a => {
          const b = a.boundary as number[][] | undefined;
          return b && b.length >= 3;
        })
        .map(a => {
          const boundary = [...(a.boundary as [number, number][])];
          if (boundary.length > 0) {
            const f = boundary[0]; const l = boundary[boundary.length - 1];
            if (f && l && (f[0] !== l[0] || f[1] !== l[1])) boundary.push([f[0], f[1]]);
          }
          const typeColor: Record<string, string> = {
            'A': '#FF6347', 'R': '#FFA500', 'D': '#FFFF00', 'P': '#FF0000',
            'M': '#800080', 'W': '#FF4500', 'T': '#20B2AA',
          };
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [boundary] },
            properties: {
              name: a.name || a.designation || '', type: a.type,
              color: typeColor[a.type as string] || '#FFA500',
              lower: a.lower, upper: a.upper, area: a.area,
            }
          };
        });
      m.addSource('global-restr', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-restr-fill', type: 'fill', source: 'global-restr', minzoom: 4,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 }
      });
      m.addLayer({
        id: 'global-restr-outline', type: 'line', source: 'global-restr', minzoom: 4,
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6 }
      });
      m.addLayer({
        id: 'global-restr-labels', type: 'symbol', source: 'global-restr', minzoom: 7,
        layout: {
          'text-field': ['get', 'name'], 'text-size': 9,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 }
      });
    }

    // ---- FIR/UIR ----
    if (showFirUir && globalData.firUir) {
      const features = (globalData.firUir as Array<Record<string, unknown>>)
        .filter(f => {
          const b = f.boundary as number[][] | undefined;
          return b && b.length >= 3;
        })
        .map(f => {
          const boundary = [...(f.boundary as [number, number][])];
          if (boundary.length > 0) {
            const first = boundary[0]; const last = boundary[boundary.length - 1];
            if (first && last && (first[0] !== last[0] || first[1] !== last[1])) boundary.push([first[0], first[1]]);
          }
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [boundary] },
            properties: {
              id: f.id, name: f.name || f.id, address: f.address, type: f.type, area: f.area,
            }
          };
        });
      m.addSource('global-fir', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      m.addLayer({
        id: 'global-fir-fill', type: 'fill', source: 'global-fir',
        paint: { 'fill-color': '#00CED1', 'fill-opacity': 0.05 }
      });
      m.addLayer({
        id: 'global-fir-outline', type: 'line', source: 'global-fir',
        paint: { 'line-color': '#00CED1', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 2] }
      });
      m.addLayer({
        id: 'global-fir-labels', type: 'symbol', source: 'global-fir', minzoom: 3,
        layout: {
          'text-field': ['get', 'name'], 'text-size': 11,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#00CED1', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 }
      });
    }
  }, [
    map, mapLoaded, globalData,
    showAirports, showNavaids, showHeliports, showWaypoints,
    showAirways, showHoldings, showCtrlAirspace, showRestrAirspace, showFirUir,
  ]);

  // ========== Click & Hover interactions ==========
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;
    const m = map.current;
    const handlers: Array<{ event: string; layer: string; fn: (e: unknown) => void }> = [];

    const removePopup = () => { if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; } };
    const showPopup = (lngLat: mapboxgl.LngLat, html: string) => {
      removePopup();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '320px', className: 'global-data-popup' })
        .setLngLat(lngLat).setHTML(html).addTo(m);
    };
    const setCursor = () => { m.getCanvas().style.cursor = 'pointer'; };
    const resetCursor = () => { m.getCanvas().style.cursor = ''; };

    const on = (layer: string, event: string, fn: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => void) => {
      try { if (m.getLayer(layer)) { m.on(event as 'click', layer, fn); handlers.push({ event, layer, fn }); } } catch { /* */ }
    };

    // Airport click
    const onApt = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH('#4FC3F7')}">${p.icao}${p.iata ? ' / ' + p.iata : ''}</div>
        <div style="${PR}"><span style="${PL}">Name</span><span style="${PV}">${p.name}</span></div>
        ${p.city ? `<div style="${PR}"><span style="${PL}">City</span><span style="${PV}">${p.city}</span></div>` : ''}
        ${p.country ? `<div style="${PR}"><span style="${PL}">Country</span><span style="${PV}">${p.country}</span></div>` : ''}
        <div style="${PR}"><span style="${PL}">Elev</span><span style="${PV}">${p.elev} ft</span></div>
        <div style="${PR}"><span style="${PL}">IFR</span><span style="${PV}">${p.ifr === true || p.ifr === 'true' ? 'Yes' : 'No'}</span></div>
        <div style="${PR}"><span style="${PL}">Coord</span><span style="${PV}">${formatCoord(Number(p.lat), Number(p.lon))}</span></div>
      </div>`);
    };
    on('global-airports', 'click', onApt); on('global-airport-labels', 'click', onApt);
    on('global-airports', 'mouseenter', setCursor); on('global-airports', 'mouseleave', resetCursor);

    // Navaid click
    const onNav = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      const tc = p.cat === 'ndb' || p.cat === 'terminal_ndb' ? '#FFA500' : '#FF69B4';
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH(tc)}">${p.type} ${p.ident}</div>
        <div style="${PR}"><span style="${PL}">Name</span><span style="${PV}">${p.name}</span></div>
        ${p.freq ? `<div style="${PR}"><span style="${PL}">Freq</span><span style="${PV}">${p.freq} MHz</span></div>` : ''}
        <div style="${PR}"><span style="${PL}">Coord</span><span style="${PV}">${formatCoord(Number(p.lat), Number(p.lon))}</span></div>
      </div>`);
    };
    on('global-navaids', 'click', onNav); on('global-navaid-labels', 'click', onNav);
    on('global-navaids', 'mouseenter', setCursor); on('global-navaids', 'mouseleave', resetCursor);

    // Heliport click
    const onHeli = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH('#7B68EE')}">${p.icao}</div>
        <div style="${PR}"><span style="${PL}">Name</span><span style="${PV}">${p.name}</span></div>
        ${p.city ? `<div style="${PR}"><span style="${PL}">City</span><span style="${PV}">${p.city}</span></div>` : ''}
        <div style="${PR}"><span style="${PL}">Elev</span><span style="${PV}">${p.elev} ft</span></div>
        <div style="${PR}"><span style="${PL}">Coord</span><span style="${PV}">${formatCoord(Number(p.lat), Number(p.lon))}</span></div>
      </div>`);
    };
    on('global-heliports', 'click', onHeli); on('global-heliport-labels', 'click', onHeli);
    on('global-heliports', 'mouseenter', setCursor); on('global-heliports', 'mouseleave', resetCursor);

    // Airway click
    const onAwy = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH(p.color || '#FFD700')}">AWY ${p.name}</div>
        <div style="${PR}"><span style="${PL}">Type</span><span style="${PV}">${p.type}</span></div>
        <div style="${PR}"><span style="${PL}">Fixes</span><span style="${PV}">${p.pointCount}</span></div>
      </div>`);
    };
    on('global-airways', 'click', onAwy); on('global-airway-labels', 'click', onAwy);
    on('global-airways', 'mouseenter', setCursor); on('global-airways', 'mouseleave', resetCursor);

    // Controlled airspace click
    const onCtrl = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH('#4169E1')}">${p.name || 'Controlled'}</div>
        ${p.class ? `<div style="${PR}"><span style="${PL}">Class</span><span style="${PV}">${p.class}</span></div>` : ''}
        <div style="${PR}"><span style="${PL}">Alt</span><span style="${PV}">${p.lower || 'GND'} ~ ${p.upper || 'UNL'}</span></div>
      </div>`);
    };
    on('global-ctrl-fill', 'click', onCtrl); on('global-ctrl-outline', 'click', onCtrl);
    on('global-ctrl-fill', 'mouseenter', setCursor); on('global-ctrl-fill', 'mouseleave', resetCursor);

    // Restrictive airspace click
    const onRestr = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH(p.color || '#FFA500')}">${p.name || 'Restricted'}</div>
        <div style="${PR}"><span style="${PL}">Type</span><span style="${PV}">${p.type}</span></div>
        <div style="${PR}"><span style="${PL}">Alt</span><span style="${PV}">${p.lower || 'GND'} ~ ${p.upper || 'UNL'}</span></div>
      </div>`);
    };
    on('global-restr-fill', 'click', onRestr); on('global-restr-outline', 'click', onRestr);
    on('global-restr-fill', 'mouseenter', setCursor); on('global-restr-fill', 'mouseleave', resetCursor);

    // FIR click
    const onFir = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      showPopup(e.lngLat, `<div style="${PS}"><div style="${PH('#00CED1')}">FIR ${p.id}</div>
        <div style="${PR}"><span style="${PL}">Name</span><span style="${PV}">${p.name}</span></div>
        ${p.address ? `<div style="${PR}"><span style="${PL}">Address</span><span style="${PV}">${p.address}</span></div>` : ''}
        <div style="${PR}"><span style="${PL}">Area</span><span style="${PV}">${p.area}</span></div>
      </div>`);
    };
    on('global-fir-fill', 'click', onFir); on('global-fir-outline', 'click', onFir);
    on('global-fir-fill', 'mouseenter', setCursor); on('global-fir-fill', 'mouseleave', resetCursor);

    return () => {
      handlers.forEach(({ event, layer, fn }) => { try { m.off(event as 'click', layer, fn as never); } catch { /* */ } });
      removePopup();
    };
  }, [
    map, mapLoaded,
    showAirports, showNavaids, showHeliports, showWaypoints,
    showAirways, showHoldings, showCtrlAirspace, showRestrAirspace, showFirUir,
  ]);
};

export default useGlobalLayers;
