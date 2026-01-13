import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAP_STYLES, TRAIL_COLOR } from '../constants/config';

/**
 * useMapInit - Mapbox 지도 초기화 훅
 * - 지도 생성 및 기본 레이어 설정
 * - DEM, 스카이, 3D 빌딩, 활주로
 * - 항적 화살표 이미지 생성
 */
export default function useMapInit(mapContainerRef) {
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainerRef.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.dark,
      center: [129.3518, 35.5934],
      zoom: 11,
      pitch: 60,
      bearing: -30,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      // Add terrain source
      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      });
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      // Add sky layer
      map.current.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });

      // Add 3D buildings
      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 12,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });

      // Add runway
      map.current.addSource('runway', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[129.3505, 35.5890], [129.3530, 35.5978]]
          }
        }
      });
      map.current.addLayer({
        id: 'runway',
        type: 'line',
        source: 'runway',
        paint: { 'line-color': '#FFFFFF', 'line-width': 8 }
      });

      // Create custom triangle arrow image for trail arrowheads
      const arrowSize = 24;
      const arrowCanvas = document.createElement('canvas');
      arrowCanvas.width = arrowSize;
      arrowCanvas.height = arrowSize;
      const ctx = arrowCanvas.getContext('2d');
      ctx.fillStyle = TRAIL_COLOR;
      ctx.beginPath();
      ctx.moveTo(arrowSize / 2, 0); // Top point
      ctx.lineTo(arrowSize, arrowSize); // Bottom right
      ctx.lineTo(arrowSize / 2, arrowSize * 0.7); // Center notch
      ctx.lineTo(0, arrowSize); // Bottom left
      ctx.closePath();
      ctx.fill();
      map.current.addImage('trail-arrow', ctx.getImageData(0, 0, arrowSize, arrowSize), { sdf: true });

      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapContainerRef]);

  return { map, mapLoaded, setMapLoaded };
}
