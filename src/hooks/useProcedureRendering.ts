/**
 * useProcedureRendering - SID/STAR/APCH 절차 렌더링 훅
 * - Three.js 3D 리본 렌더링 (terrain-independent MSL altitude)
 * - 2D 폴백 렌더링
 * - 웨이포인트 라벨
 */
import { useEffect, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap, type CustomLayerInterface } from 'mapbox-gl';
import * as THREE from 'three';

interface Waypoint {
  lat: number;
  lon: number;
  ident?: string;
}

interface Segment {
  coordinates: [number, number, number][];
}

interface Procedure {
  segments?: Segment[];
}

interface ProceduresData {
  SID?: Record<string, Procedure>;
  STAR?: Record<string, Procedure>;
  APPROACH?: Record<string, Procedure>;
}

interface ProcedureData {
  procedures?: ProceduresData;
  waypoints?: Waypoint[] | Record<string, Waypoint>;
}

interface ProcColors {
  SID: Record<string, string>;
  STAR: Record<string, string>;
  APPROACH: Record<string, string>;
}

interface VisibleState {
  [key: string]: boolean;
}

interface ProcedureLine {
  coords: [number, number, number][];
  color: string;
}

interface ActiveWaypoint {
  lon: number;
  lat: number;
  altitude_m: number;
  altitude_ft: number;
  color: string;
  ident: string;
}

interface WaypointLabelFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number, number];
  };
  properties: {
    ident: string;
    altitude_ft: number;
    label: string;
    color: string;
  };
}

interface UseProcedureRenderingReturn {
  hasActiveProcedure: boolean;
  getActiveWaypoints: () => ActiveWaypoint[];
}

// Extend THREE.WebGLRenderer to include resetState
interface ExtendedWebGLRenderer extends THREE.WebGLRenderer {
  resetState: () => void;
}

// Custom layer with Three.js properties
interface ThreeCustomLayer extends CustomLayerInterface {
  camera?: THREE.Camera;
  scene?: THREE.Scene;
  renderer?: ExtendedWebGLRenderer;
}

/**
 * useProcedureRendering Hook
 */
const useProcedureRendering = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  data: ProcedureData | null,
  sidVisible: VisibleState,
  starVisible: VisibleState,
  apchVisible: VisibleState,
  procColors: ProcColors,
  is3DView: boolean,
  show3DAltitude: boolean
): UseProcedureRenderingReturn => {
  // Create Three.js custom layer for procedures (terrain-independent MSL altitude)
  const createProcedureThreeLayer = useCallback((
    procedures: Record<string, Procedure>,
    colors: Record<string, string>,
    visibleState: VisibleState,
    typePrefix: string
  ): ThreeCustomLayer | null => {
    if (!map.current) return null;

    const layerId = `${typePrefix}-three-layer`;

    // Collect segments from visible procedures - each segment is a separate line
    const procedureLines: ProcedureLine[] = [];
    Object.entries(procedures).forEach(([key, proc]) => {
      if (!visibleState[key]) return;
      const color = colors[key] ?? '#ffffff';

      // Each segment is a separate line (don't merge)
      proc.segments?.forEach(seg => {
        if (seg.coordinates?.length >= 2) {
          procedureLines.push({ coords: seg.coordinates, color });
        }
      });
    });

    if (procedureLines.length === 0) return null;

    // Custom Three.js layer
    const customLayer: ThreeCustomLayer = {
      id: layerId,
      type: 'custom',
      renderingMode: '3d',
      onAdd: function(this: ThreeCustomLayer, mapInstance: MapboxMap, gl: WebGLRenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const ribbonWidth = 0.000004; // Width in mercator units (halved)

        // Create continuous ribbon for each procedure
        procedureLines.forEach(({ coords, color }) => {
          const threeColor = new THREE.Color(color);

          // Build continuous ribbon geometry
          const vertices: number[] = [];
          const indices: number[] = [];

          for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];
            if (!coord) continue;
            const [lon, lat, alt] = coord;
            const altM = alt || 0;
            const p = mapboxgl.MercatorCoordinate.fromLngLat([lon, lat], altM);

            // Calculate direction for ribbon width
            let dx: number, dy: number;
            if (i < coords.length - 1) {
              const nextCoord = coords[i + 1];
              if (!nextCoord) { dx = 1; dy = 0; }
              else {
                const [nextLon, nextLat, nextAlt] = nextCoord;
                const nextP = mapboxgl.MercatorCoordinate.fromLngLat([nextLon, nextLat], nextAlt || 0);
                dx = nextP.x - p.x;
                dy = nextP.y - p.y;
              }
            } else if (i > 0) {
              const prevCoord = coords[i - 1];
              if (!prevCoord) { dx = 1; dy = 0; }
              else {
                const [prevLon, prevLat, prevAlt] = prevCoord;
                const prevP = mapboxgl.MercatorCoordinate.fromLngLat([prevLon, prevLat], prevAlt || 0);
                dx = p.x - prevP.x;
                dy = p.y - prevP.y;
              }
            } else {
              dx = 1; dy = 0;
            }

            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return;

            // Perpendicular direction for ribbon width
            const nx = -dy / len * ribbonWidth;
            const ny = dx / len * ribbonWidth;

            // Add two vertices (left and right edge of ribbon)
            const baseIdx = vertices.length / 3;
            vertices.push(p.x + nx, p.y + ny, p.z); // left
            vertices.push(p.x - nx, p.y - ny, p.z); // right

            // Create triangles between this point and next
            if (i > 0) {
              const prevBase = baseIdx - 2;
              // Triangle 1: prev-left, prev-right, curr-right
              indices.push(prevBase, prevBase + 1, baseIdx + 1);
              // Triangle 2: prev-left, curr-right, curr-left
              indices.push(prevBase, baseIdx + 1, baseIdx);
            }
          }

          if (vertices.length >= 6 && indices.length >= 3) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

            const material = new THREE.MeshBasicMaterial({
              color: threeColor,
              transparent: true,
              opacity: 0.85,
              side: THREE.DoubleSide,
              depthWrite: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            this.scene?.add(mesh);
          }
        });

        this.renderer = new THREE.WebGLRenderer({
          canvas: mapInstance.getCanvas(),
          context: gl,
          antialias: true
        }) as ExtendedWebGLRenderer;
        this.renderer.autoClear = false;
      },
      render: function(this: ThreeCustomLayer, _gl: WebGLRenderingContext, matrix: number[]) {
        const m = new THREE.Matrix4().fromArray(matrix);
        if (this.camera) this.camera.projectionMatrix = m;
        this.renderer?.resetState();
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }
    };

    return customLayer;
  }, [map]);

  // Get active waypoints for labels
  const getActiveWaypoints = useCallback((): ActiveWaypoint[] => {
    if (!data) return [];
    const waypointMap = new Map<string, Omit<ActiveWaypoint, 'ident'>>();

    const extractWaypoints = (proc: Procedure, color: string): void => {
      if (!proc?.segments) return;
      proc.segments.forEach((seg) => {
        const coords = seg.coordinates;
        if (!coords || coords.length < 2) return;
        const firstCoord = coords[0];
        const lastCoord = coords[coords.length - 1];
        [firstCoord, lastCoord].forEach(coord => {
          if (coord && coord.length >= 3) {
            const lon = coord[0];
            const lat = coord[1];
            const alt = coord[2];
            if (lon === undefined || lat === undefined || alt === undefined) return;
            const key = `${lon.toFixed(4)}_${lat.toFixed(4)}`;
            if (!waypointMap.has(key)) {
              waypointMap.set(key, {
                lon,
                lat,
                altitude_m: alt,
                altitude_ft: Math.round(alt / 0.3048),
                color
              });
            }
          }
        });
      });
    };

    if (data.procedures?.SID) {
      Object.entries(data.procedures.SID).forEach(([k, p]) => {
        if (sidVisible[k]) extractWaypoints(p, procColors.SID[k] ?? '#ffffff');
      });
    }
    if (data.procedures?.STAR) {
      Object.entries(data.procedures.STAR).forEach(([k, p]) => {
        if (starVisible[k]) extractWaypoints(p, procColors.STAR[k] ?? '#ffffff');
      });
    }
    if (data.procedures?.APPROACH) {
      Object.entries(data.procedures.APPROACH).forEach(([k, p]) => {
        if (apchVisible[k]) extractWaypoints(p, procColors.APPROACH[k] ?? '#ffffff');
      });
    }

    const namedWaypoints: Waypoint[] = Array.isArray(data.waypoints)
      ? data.waypoints
      : Object.values(data.waypoints || {});

    return Array.from(waypointMap.entries()).map(([, wp]) => {
      const named = namedWaypoints.find(n => Math.abs(n.lon - wp.lon) < 0.001 && Math.abs(n.lat - wp.lat) < 0.001);
      return { ...wp, ident: named?.ident || '' };
    });
  }, [data, sidVisible, starVisible, apchVisible, procColors]);

  const hasActiveProcedure = Object.values(sidVisible).some(v => v) ||
    Object.values(starVisible).some(v => v) ||
    Object.values(apchVisible).some(v => v);

  // Main procedure rendering effect
  useEffect(() => {
    if (!map.current || !data || !mapLoaded) return;

    const safeRemoveLayer = (id: string): void => {
      try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch { /* ignore */ }
    };
    const safeRemoveSource = (id: string): void => {
      try { if (map.current?.getSource(id)) map.current.removeSource(id); } catch { /* ignore */ }
    };

    // Clean up waypoint labels
    safeRemoveLayer('proc-waypoints-labels');
    safeRemoveSource('proc-waypoints-labels');

    // Remove old procedure layers (both Mapbox and Three.js) - including segment-based layers
    const cleanupProcedureLayers = (type: string, key: string, proc: Procedure | undefined): void => {
      ['3d', '2d', 'line'].forEach(suffix => {
        safeRemoveLayer(`${type}-${key}-${suffix}`);
        safeRemoveSource(`${type}-${key}-${suffix}`);
      });
      // Also remove segment-based layers (seg0, seg1, etc.)
      const segCount = proc?.segments?.length || 10;
      for (let i = 0; i < segCount; i++) {
        safeRemoveLayer(`${type}-${key}-seg${i}-line`);
        safeRemoveSource(`${type}-${key}-seg${i}-line`);
      }
    };
    Object.entries(data.procedures?.SID || {}).forEach(([k, p]) => cleanupProcedureLayers('sid', k, p));
    Object.entries(data.procedures?.STAR || {}).forEach(([k, p]) => cleanupProcedureLayers('star', k, p));
    Object.entries(data.procedures?.APPROACH || {}).forEach(([k, p]) => cleanupProcedureLayers('apch', k, p));

    // Remove Three.js custom layers
    ['sid-three-layer', 'star-three-layer', 'apch-three-layer'].forEach(safeRemoveLayer);

    // Render procedures using Three.js custom layer (terrain-independent)
    if (is3DView && show3DAltitude) {
      // Add Three.js layers for each procedure type
      if (data.procedures?.SID) {
        const sidLayer = createProcedureThreeLayer(data.procedures.SID, procColors.SID, sidVisible, 'sid');
        if (sidLayer) map.current.addLayer(sidLayer);
      }
      if (data.procedures?.STAR) {
        const starLayer = createProcedureThreeLayer(data.procedures.STAR, procColors.STAR, starVisible, 'star');
        if (starLayer) map.current.addLayer(starLayer);
      }
      if (data.procedures?.APPROACH) {
        const apchLayer = createProcedureThreeLayer(data.procedures.APPROACH, procColors.APPROACH, apchVisible, 'apch');
        if (apchLayer) map.current.addLayer(apchLayer);
      }
    } else {
      // 2D fallback - use simple line layers (each segment as separate line)
      const render2DProcedure = (type: string, key: string, proc: Procedure, color: string): void => {
        proc.segments?.forEach((seg, segIdx) => {
          if (seg.coordinates && seg.coordinates.length >= 2) {
            const sourceId = `${type}-${key}-seg${segIdx}-line`;
            const coords: [number, number][] = seg.coordinates.map(c => [c[0], c[1]]);
            map.current?.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
            map.current?.addLayer({ id: sourceId, type: 'line', source: sourceId, paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.8 } });
          }
        });
      };

      if (data.procedures?.SID) {
        Object.entries(data.procedures.SID).forEach(([k, p]) => {
          if (sidVisible[k]) render2DProcedure('sid', k, p, procColors.SID[k] ?? '#ffffff');
        });
      }
      if (data.procedures?.STAR) {
        Object.entries(data.procedures.STAR).forEach(([k, p]) => {
          if (starVisible[k]) render2DProcedure('star', k, p, procColors.STAR[k] ?? '#ffffff');
        });
      }
      if (data.procedures?.APPROACH) {
        Object.entries(data.procedures.APPROACH).forEach(([k, p]) => {
          if (apchVisible[k]) render2DProcedure('apch', k, p, procColors.APPROACH[k] ?? '#ffffff');
        });
      }
    }

    // Waypoint labels - use symbol layer with proper elevation
    if (hasActiveProcedure) {
      const activeWaypoints = getActiveWaypoints();
      if (activeWaypoints.length > 0) {
        const features: WaypointLabelFeature[] = activeWaypoints.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat, wp.altitude_m] },
          properties: {
            ident: wp.ident,
            altitude_ft: wp.altitude_ft,
            label: `${wp.ident}\n${wp.altitude_ft}ft`,
            color: wp.color
          }
        }));
        map.current.addSource('proc-waypoints-labels', { type: 'geojson', data: { type: 'FeatureCollection', features } });
        map.current.addLayer({
          id: 'proc-waypoints-labels',
          type: 'symbol',
          source: 'proc-waypoints-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.5],
            'text-allow-overlap': true,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'symbol-z-elevate': true
          },
          paint: {
            'text-color': '#FFEB3B',
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 2
          }
        });
      }
    }

  }, [map, data, mapLoaded, sidVisible, starVisible, apchVisible, procColors, is3DView, show3DAltitude, hasActiveProcedure, getActiveWaypoints, createProcedureThreeLayer]);

  return { hasActiveProcedure, getActiveWaypoints };
};

export default useProcedureRendering;
