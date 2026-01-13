import { useEffect } from 'react';
import { createObstacleShape } from '../utils/geometry';
import { OBSTACLE_COLORS } from '../utils/colors';

/**
 * useAirspaceLayers - 공역/웨이포인트/장애물 렌더링 훅
 * - 공역 영역 표시
 * - 웨이포인트 마커 및 라벨
 * - 장애물 3D/2D 표시
 */
export default function useAirspaceLayers(
  map,
  mapLoaded,
  data,
  showWaypoints,
  showObstacles,
  showAirspace,
  show3DAltitude,
  is3DView,
  hasActiveProcedure
) {
  useEffect(() => {
    if (!map.current || !data || !mapLoaded) return;

    const safeRemoveLayer = (id) => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} };
    const safeRemoveSource = (id) => { try { if (map.current.getSource(id)) map.current.removeSource(id); } catch (e) {} };

    // Clean up previous layers
    ['waypoints-2d', 'waypoints-labels', 'obstacles-3d', 'obstacles-2d', 'airspace', 'airspace-outline'].forEach(safeRemoveLayer);
    ['waypoints-2d', 'obstacles-3d', 'obstacles-2d', 'airspace'].forEach(safeRemoveSource);

    // Airspace
    if (showAirspace && data.airspace) {
      const features = data.airspace.map((as) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: as.coordinates },
        properties: { name: as.name }
      }));
      map.current.addSource('airspace', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.current.addLayer({ id: 'airspace', type: 'fill', source: 'airspace', paint: { 'fill-color': '#E91E63', 'fill-opacity': 0.1 } });
      map.current.addLayer({ id: 'airspace-outline', type: 'line', source: 'airspace', paint: { 'line-color': '#E91E63', 'line-width': 2, 'line-dasharray': [4, 2] } });
    }

    // Waypoints (when no procedure is active)
    if (showWaypoints && !hasActiveProcedure && data.waypoints) {
      const waypointsArray = Array.isArray(data.waypoints) ? data.waypoints : Object.values(data.waypoints);
      if (waypointsArray.length > 0) {
        const features = waypointsArray.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
          properties: { ident: wp.ident || '', type: wp.type || 'WPT' }
        }));
        map.current.addSource('waypoints-2d', { type: 'geojson', data: { type: 'FeatureCollection', features } });
        map.current.addLayer({
          id: 'waypoints-2d',
          type: 'circle',
          source: 'waypoints-2d',
          paint: { 'circle-radius': 5, 'circle-color': '#00BCD4', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' }
        });
        map.current.addLayer({
          id: 'waypoints-labels',
          type: 'symbol',
          source: 'waypoints-2d',
          layout: {
            'text-field': ['get', 'ident'],
            'text-size': 11,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.8],
            'text-allow-overlap': false,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold']
          },
          paint: { 'text-color': '#00BCD4', 'text-halo-color': 'rgba(0, 0, 0, 0.9)', 'text-halo-width': 1.5 }
        });
      }
    }

    // Obstacles
    if (showObstacles && data.obstacles) {
      const filteredObstacles = data.obstacles.filter(obs => obs.height_m > 0);
      if (is3DView && show3DAltitude) {
        const features3d = filteredObstacles.map((obs) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: createObstacleShape(obs.lon, obs.lat, obs.type, 0.0002) },
          properties: { height: obs.height_m, color: OBSTACLE_COLORS[obs.type] || OBSTACLE_COLORS.Unknown }
        }));
        if (features3d.length > 0) {
          map.current.addSource('obstacles-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: features3d } });
          map.current.addLayer({ id: 'obstacles-3d', type: 'fill-extrusion', source: 'obstacles-3d', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.85 } });
        }
      } else {
        const features2d = filteredObstacles.map((obs) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
          properties: { color: OBSTACLE_COLORS[obs.type] || OBSTACLE_COLORS.Unknown }
        }));
        if (features2d.length > 0) {
          map.current.addSource('obstacles-2d', { type: 'geojson', data: { type: 'FeatureCollection', features: features2d } });
          map.current.addLayer({ id: 'obstacles-2d', type: 'circle', source: 'obstacles-2d', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
        }
      }
    }

  }, [data, mapLoaded, showWaypoints, showObstacles, showAirspace, show3DAltitude, is3DView, hasActiveProcedure]);
}
