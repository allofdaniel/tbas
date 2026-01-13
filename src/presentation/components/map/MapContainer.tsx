/**
 * MapContainer Component
 * DO-278A 요구사항 추적: SRS-UI-001
 *
 * Mapbox GL 지도 컨테이너 컴포넌트
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapContext } from '../../contexts/MapContext';
import {
  MAPBOX_ACCESS_TOKEN,
  MAP_STYLES,
} from '@/config/constants';

// Mapbox 토큰 설정
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

interface MapContainerProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 지도 컨테이너 컴포넌트
 */
export function MapContainer({
  children,
  className = '',
  style,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapRef, setMapLoaded, mapStyle, viewState } = useMapContext();

  /**
   * 지도 초기화
   */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleSpec = MAP_STYLES[mapStyle];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: typeof styleSpec === 'string' ? styleSpec : (JSON.parse(JSON.stringify(styleSpec)) as mapboxgl.Style),
      center: [viewState.center.lon, viewState.center.lat],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      antialias: true,
      attributionControl: false,
    });

    // 지형 설정
    map.on('load', () => {
      // 3D 지형 추가
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });

      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      // 3D 건물 레이어
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      if (labelLayerId && !map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': '#444',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6,
            },
          },
          labelLayerId
        );
      }

      setMapLoaded(true);
    });

    // 네비게이션 컨트롤
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /**
   * 스타일 변경 처리
   */
  useEffect(() => {
    if (!mapRef.current) return;

    const styleSpec = MAP_STYLES[mapStyle];
    mapRef.current.setStyle(
      typeof styleSpec === 'string' ? styleSpec : (JSON.parse(JSON.stringify(styleSpec)) as mapboxgl.Style)
    );
  }, [mapStyle]);

  return (
    <div
      ref={containerRef}
      className={`map-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default MapContainer;
