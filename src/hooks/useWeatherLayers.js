import { useEffect, useState } from 'react';

/**
 * useWeatherLayers - 기상 레이어 시각화 관리 훅
 * - Wind thread animation (바람 실타래 애니메이션)
 * - Lightning strikes layer (낙뢰 표시)
 * - SIGMET areas layer (SIGMET 표시)
 * - Radar overlay (레이더 오버레이)
 */
export default function useWeatherLayers(
  map,
  mapLoaded,
  weatherData,
  data,
  showRadar,
  showLightning,
  lightningData,
  showSigmet,
  sigmetData
) {
  // Wind thread animation - thin silk-like threads with fade in/out
  useEffect(() => {
    if (!map.current || !mapLoaded || !weatherData?.metar?.wdir || !data?.airport) return;

    const windDir = weatherData.metar.wdir;
    const windSpd = weatherData.metar.wspd || 5;
    if (windDir === 'VRB' || windDir === 0) return;

    const centerLon = data.airport.lon || 129.3518;
    const centerLat = data.airport.lat || 35.5934;
    const windRad = ((windDir + 180) % 360) * Math.PI / 180;

    // Thread configuration
    const threadCount = 30;
    const areaRadius = 0.022;
    const maxLife = 180; // Frames until respawn

    // Initialize threads
    let threads = [];
    for (let i = 0; i < threadCount; i++) {
      threads.push(createThread());
    }

    function createThread() {
      // Start from upwind edge with random lateral position
      const lateralOffset = (Math.random() - 0.5) * areaRadius * 2;
      const startLon = centerLon + Math.sin(windRad + Math.PI) * areaRadius * 1.2 + Math.cos(windRad) * lateralOffset;
      const startLat = centerLat + Math.cos(windRad + Math.PI) * areaRadius * 1.2 - Math.sin(windRad) * lateralOffset;
      return {
        points: [[startLon, startLat]],
        speed: 0.6 + Math.random() * 0.5,
        life: 0,
        maxLife: maxLife * (0.7 + Math.random() * 0.6)
      };
    }

    const sourceId = 'wind-threads';
    const glowSourceId = 'wind-threads-glow';
    const layerId = 'wind-threads-layer';
    const glowLayerId = 'wind-threads-glow-layer';

    [layerId, glowLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    [sourceId, glowSourceId].forEach(id => { try { if (map.current.getSource(id)) map.current.removeSource(id); } catch (e) {} });

    map.current.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.current.addSource(glowSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // Glow layer (wider, softer)
    map.current.addLayer({
      id: glowLayerId,
      type: 'line',
      source: glowSourceId,
      paint: {
        'line-color': '#00d4ff',
        'line-width': 3,
        'line-opacity': ['get', 'opacity'],
        'line-blur': 2
      }
    });

    // Main thread layer
    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity']
      }
    });

    const baseSpeed = 0.00012 * (windSpd / 10 + 0.5);
    let animFrame;

    const animate = () => {
      const features = [];
      const glowFeatures = [];

      threads.forEach((thread, idx) => {
        thread.life++;

        // Calculate life progress (0 to 1)
        const lifeProgress = thread.life / thread.maxLife;

        // Fade in (0-20%), full (20-70%), fade out (70-100%)
        let opacity;
        if (lifeProgress < 0.15) {
          opacity = lifeProgress / 0.15; // Fade in
        } else if (lifeProgress < 0.7) {
          opacity = 1; // Full
        } else {
          opacity = 1 - (lifeProgress - 0.7) / 0.3; // Fade out
        }
        opacity = Math.max(0, Math.min(1, opacity)) * 0.6;

        // Respawn if life ended
        if (thread.life >= thread.maxLife) {
          threads[idx] = createThread();
          return;
        }

        // Move head
        const head = thread.points[0];
        const wobble = (Math.random() - 0.5) * 0.00002;
        const newLon = head[0] + Math.sin(windRad) * baseSpeed * thread.speed + Math.cos(windRad) * wobble;
        const newLat = head[1] + Math.cos(windRad) * baseSpeed * thread.speed - Math.sin(windRad) * wobble;

        // Add new point at head
        thread.points.unshift([newLon, newLat]);

        // Limit trail length based on life
        const maxPoints = Math.min(50, Math.floor(thread.life * 0.5) + 5);
        if (thread.points.length > maxPoints) {
          thread.points = thread.points.slice(0, maxPoints);
        }

        if (thread.points.length >= 2 && opacity > 0.02) {
          // Create gradient segments (head is brighter, tail fades)
          const segmentCount = Math.min(5, Math.floor(thread.points.length / 3));
          const pointsPerSegment = Math.floor(thread.points.length / segmentCount);

          for (let s = 0; s < segmentCount; s++) {
            const startIdx = s * pointsPerSegment;
            const endIdx = Math.min((s + 1) * pointsPerSegment + 1, thread.points.length);
            const segmentPoints = thread.points.slice(startIdx, endIdx);

            if (segmentPoints.length >= 2) {
              // Opacity decreases towards tail
              const segOpacity = opacity * (1 - s * 0.18);
              const segWidth = 1.2 - s * 0.15;

              features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: segmentPoints },
                properties: { opacity: segOpacity, width: Math.max(0.5, segWidth) }
              });

              // Glow only for head segments
              if (s < 2) {
                glowFeatures.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: segmentPoints },
                  properties: { opacity: segOpacity * 0.3 }
                });
              }
            }
          }
        }
      });

      try {
        map.current?.getSource(sourceId)?.setData({ type: 'FeatureCollection', features });
        map.current?.getSource(glowSourceId)?.setData({ type: 'FeatureCollection', features: glowFeatures });
      } catch (e) {}

      animFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrame);
      [layerId, glowLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      [sourceId, glowSourceId].forEach(id => { try { if (map.current?.getSource(id)) map.current.removeSource(id); } catch (e) {} });
    };
  }, [weatherData?.metar?.wdir, weatherData?.metar?.wspd, mapLoaded, data?.airport]);

  // Lightning layer rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'lightning-strikes';
    const layerId = 'lightning-strikes-layer';
    const glowLayerId = 'lightning-glow-layer';

    // Remove existing
    [layerId, glowLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showLightning || !lightningData?.strikes?.length) return;

    const features = lightningData.strikes.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { amplitude: Math.abs(s.amplitude || 30) }
    }));

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    // Glow layer
    map.current.addLayer({
      id: glowLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 12,
        'circle-color': '#ffff00',
        'circle-opacity': 0.3,
        'circle-blur': 1
      }
    });

    // Main strike layer
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffff00',
        'circle-stroke-color': '#ff8800',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9
      }
    });

    return () => {
      [layerId, glowLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showLightning, lightningData, mapLoaded]);

  // SIGMET rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'sigmet-areas';
    const layerId = 'sigmet-fill-layer';
    const outlineLayerId = 'sigmet-outline-layer';
    const labelLayerId = 'sigmet-label-layer';

    [layerId, outlineLayerId, labelLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showSigmet || !sigmetData) return;

    // Process SIGMET data
    const features = [];
    const intlSigmets = sigmetData.international || [];

    intlSigmets.forEach((sig, idx) => {
      if (sig.coords && sig.coords.length >= 3) {
        const color = sig.hazard === 'TURB' ? '#ff9800' :
                      sig.hazard === 'ICE' ? '#2196f3' :
                      sig.hazard === 'TS' || sig.hazard === 'CONVECTIVE' ? '#f44336' :
                      sig.hazard === 'VA' ? '#9c27b0' : '#ff5722';

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [sig.coords.map(c => [c.lon, c.lat]).concat([[sig.coords[0].lon, sig.coords[0].lat]])]
          },
          properties: {
            type: sig.hazard || 'SIGMET',
            color,
            raw: sig.rawSigmet || ''
          }
        });
      }
    });

    if (features.length === 0) return;

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    map.current.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.2
      }
    });

    map.current.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-dasharray': [4, 2]
      }
    });

    return () => {
      [layerId, outlineLayerId, labelLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showSigmet, sigmetData, mapLoaded]);

  // RainViewer API에서 가용한 타임스탬프 가져오기
  const [radarTimestamp, setRadarTimestamp] = useState(null);
  const [radarHost, setRadarHost] = useState('https://tilecache.rainviewer.com');

  useEffect(() => {
    if (!showRadar) return;

    const fetchRadarData = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        if (data?.radar?.past?.length > 0) {
          const latestFrame = data.radar.past[data.radar.past.length - 1];
          setRadarTimestamp(latestFrame.path);
          setRadarHost(data.host);
        }
      } catch (e) {
        console.error('Failed to fetch radar data:', e);
      }
    };

    fetchRadarData();
    const interval = setInterval(fetchRadarData, 300000); // 5분마다 갱신
    return () => clearInterval(interval);
  }, [showRadar]);

  // Radar overlay rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'radar-overlay';
    const layerId = 'radar-layer';

    try { if (map.current.getLayer(layerId)) map.current.removeLayer(layerId); } catch (e) {}
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showRadar || !radarTimestamp) return;

    // RainViewer API - 실제 가용한 타임스탬프 사용
    const tileUrl = `${radarHost}${radarTimestamp}/256/{z}/{x}/{y}/4/1_1.png`;

    map.current.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256
    });

    // 존재하지 않을 수 있는 레이어 이름 대신 안전하게 추가
    const beforeLayer = map.current.getLayer('aeroway-line') ? 'aeroway-line' : undefined;
    map.current.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': 0.6,
        'raster-fade-duration': 0
      }
    }, beforeLayer);

    return () => {
      try { if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId); } catch (e) {}
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showRadar, radarTimestamp, radarHost, mapLoaded]);
}
