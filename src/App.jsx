import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYWxsb2ZkYW5pZWwiLCJhIjoiY2xuY2czd2Q2MGk3MDJ2cWxpNjRkYjBlOSJ9.uaGA_rHt0kp20sd1Wyye2g';

const COLORS = {
  waypoint: '#FFEB3B',
  obstacle_building: '#F44336',
  obstacle_tower: '#FF5722',
  obstacle_natural: '#4CAF50',
  obstacle_tree: '#8BC34A',
  obstacle_navaid: '#9C27B0',
  obstacle_etc: '#607D8B',
  SID: '#00C853',
  STAR: '#FF6D00',
  APPROACH: '#2979FF',
  airspace: '#E91E63',
  runway: '#FFFFFF',
};

const OBSTACLE_COLORS = {
  Building: COLORS.obstacle_building,
  Tower: COLORS.obstacle_tower,
  Natural: COLORS.obstacle_natural,
  Tree: COLORS.obstacle_tree,
  Navaid: COLORS.obstacle_navaid,
  ETC: COLORS.obstacle_etc,
};

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [data, setData] = useState(null);
  const [layers, setLayers] = useState({
    waypoints: true,
    obstacles: true,
    airspace: false,
    SID: false,
    STAR: false,
    APPROACH: true,
  });
  const [obstacleTypes, setObstacleTypes] = useState({
    Building: true,
    Tower: true,
    Natural: true,
    Tree: true,
    Navaid: true,
    ETC: true,
  });

  // Load data
  useEffect(() => {
    fetch('/aviation_data.json')
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error('Failed to load data:', err));
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [129.3518, 35.5934],
      zoom: 12,
      pitch: 45,
      bearing: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      // Add 3D buildings
      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 12,
        paint: {
          'fill-extrusion-color': '#1a1a2e',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6,
        },
      });

      // Add runway
      map.current.addSource('runway', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [129.3505, 35.5890],
              [129.3530, 35.5978],
            ],
          },
          properties: { name: 'Runway 18/36' },
        },
      });
      map.current.addLayer({
        id: 'runway',
        type: 'line',
        source: 'runway',
        paint: {
          'line-color': COLORS.runway,
          'line-width': 8,
        },
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update layers when data or settings change
  useEffect(() => {
    if (!map.current || !data || !map.current.isStyleLoaded()) return;

    // Remove existing layers
    ['waypoints', 'waypoints-labels', 'obstacles', 'obstacles-labels', 'airspace', 'airspace-outline', 'procedures-sid', 'procedures-star', 'procedures-approach'].forEach((id) => {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
      if (map.current.getSource(id)) map.current.removeSource(id);
    });

    // Add waypoints
    if (layers.waypoints && data.waypoints) {
      const waypointFeatures = Object.entries(data.waypoints).map(([name, wp]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
        properties: { name, altitude: wp.altitude || 0, sources: wp.sources.join(', ') },
      }));

      map.current.addSource('waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: waypointFeatures },
      });

      map.current.addLayer({
        id: 'waypoints',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 6,
          'circle-color': COLORS.waypoint,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#000',
        },
      });

      map.current.addLayer({
        id: 'waypoints-labels',
        type: 'symbol',
        source: 'waypoints',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      });
    }

    // Add obstacles
    if (layers.obstacles && data.obstacles) {
      const obstacleFeatures = data.obstacles
        .filter((obs) => obstacleTypes[obs.type])
        .map((obs) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
          properties: {
            id: obs.id,
            type: obs.type,
            elevation: obs.elevation,
            color: OBSTACLE_COLORS[obs.type] || COLORS.obstacle_etc,
          },
        }));

      map.current.addSource('obstacles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: obstacleFeatures },
      });

      map.current.addLayer({
        id: 'obstacles',
        type: 'circle',
        source: 'obstacles',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 10],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000',
          'circle-opacity': 0.8,
        },
      });

      map.current.addLayer({
        id: 'obstacles-labels',
        type: 'symbol',
        source: 'obstacles',
        minzoom: 13,
        layout: {
          'text-field': ['concat', '#', ['get', 'id']],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      });
    }

    // Add airspace
    if (layers.airspace && data.airspace) {
      const airspaceFeatures = data.airspace
        .filter((as) => as.coordinates && as.coordinates[0])
        .map((as) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: as.coordinates },
          properties: { name: as.name, base: as.base_alt, top: as.top_alt },
        }));

      if (airspaceFeatures.length > 0) {
        map.current.addSource('airspace', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: airspaceFeatures },
        });

        map.current.addLayer({
          id: 'airspace',
          type: 'fill',
          source: 'airspace',
          paint: {
            'fill-color': COLORS.airspace,
            'fill-opacity': 0.2,
          },
        });

        map.current.addLayer({
          id: 'airspace-outline',
          type: 'line',
          source: 'airspace',
          paint: {
            'line-color': COLORS.airspace,
            'line-width': 2,
          },
        });
      }
    }

    // Add procedures
    const addProcedures = (type, color, layerId) => {
      if (!layers[type] || !data.procedures[type]) return;

      const features = data.procedures[type]
        .filter((proc) => proc.coordinates && proc.coordinates.length >= 2)
        .map((proc) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: proc.coordinates },
          properties: { name: proc.name, table: proc.table },
        }));

      if (features.length > 0) {
        map.current.addSource(layerId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });

        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          paint: {
            'line-color': color,
            'line-width': 3,
            'line-opacity': 0.8,
          },
        });
      }
    };

    addProcedures('SID', COLORS.SID, 'procedures-sid');
    addProcedures('STAR', COLORS.STAR, 'procedures-star');
    addProcedures('APPROACH', COLORS.APPROACH, 'procedures-approach');

    // Add click handlers
    const handleClick = (e, layerId) => {
      const features = map.current.queryRenderedFeatures(e.point, { layers: [layerId] });
      if (features.length === 0) return;

      const f = features[0];
      const props = f.properties;

      let html = '';
      if (layerId === 'waypoints') {
        html = `
          <div class="popup-title">${props.name}</div>
          <div class="popup-row"><span class="popup-label">고도</span><span class="popup-value">${props.altitude}m</span></div>
          <div class="popup-row"><span class="popup-label">출처</span><span class="popup-value">${props.sources}</span></div>
        `;
      } else if (layerId === 'obstacles') {
        html = `
          <div class="popup-title">장애물 #${props.id}</div>
          <div class="popup-row"><span class="popup-label">유형</span><span class="popup-value">${props.type}</span></div>
          <div class="popup-row"><span class="popup-label">표고</span><span class="popup-value">${props.elevation}m</span></div>
        `;
      }

      if (html) {
        new mapboxgl.Popup()
          .setLngLat(f.geometry.coordinates)
          .setHTML(html)
          .addTo(map.current);
      }
    };

    map.current.on('click', 'waypoints', (e) => handleClick(e, 'waypoints'));
    map.current.on('click', 'obstacles', (e) => handleClick(e, 'obstacles'));

    // Change cursor on hover
    ['waypoints', 'obstacles'].forEach((layer) => {
      map.current.on('mouseenter', layer, () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', layer, () => {
        map.current.getCanvas().style.cursor = '';
      });
    });

  }, [data, layers, obstacleTypes]);

  const toggleLayer = (layer) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const toggleObstacleType = (type) => {
    setObstacleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const flyToAirport = () => {
    if (map.current) {
      map.current.flyTo({
        center: [129.3518, 35.5934],
        zoom: 13,
        pitch: 60,
        bearing: 0,
        duration: 2000,
      });
    }
  };

  return (
    <div className="app-container">
      <div ref={mapContainer} id="map" />

      <div className="control-panel">
        <div className="panel-header">
          <span className="panel-title">울산공항 비행절차 뷰어</span>
          <span className="airport-code">RKPU</span>
        </div>

        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{data ? Object.keys(data.waypoints).length : '-'}</div>
            <div className="stat-label">웨이포인트</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data ? data.obstacles.length : '-'}</div>
            <div className="stat-label">장애물</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {data ? data.procedures.SID.length + data.procedures.STAR.length + data.procedures.APPROACH.length : '-'}
            </div>
            <div className="stat-label">절차</div>
          </div>
        </div>

        <div className="panel-content">
          <div className="section">
            <div className="section-title">기본 레이어</div>
            <div className="toggle-group">
              {[
                { key: 'waypoints', label: '웨이포인트', color: COLORS.waypoint },
                { key: 'obstacles', label: '장애물', color: COLORS.obstacle_building },
                { key: 'airspace', label: '공역', color: COLORS.airspace },
              ].map(({ key, label, color }) => (
                <div
                  key={key}
                  className={`toggle-item ${layers[key] ? 'active' : ''}`}
                  onClick={() => toggleLayer(key)}
                >
                  <input type="checkbox" className="toggle-checkbox" checked={layers[key]} readOnly />
                  <span className="toggle-label">{label}</span>
                  <div className="toggle-color" style={{ background: color }} />
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-title">비행 절차</div>
            <div className="toggle-group">
              {[
                { key: 'SID', label: 'SID (표준계기출발)', color: COLORS.SID },
                { key: 'STAR', label: 'STAR (표준도착경로)', color: COLORS.STAR },
                { key: 'APPROACH', label: '접근 절차', color: COLORS.APPROACH },
              ].map(({ key, label, color }) => (
                <div
                  key={key}
                  className={`toggle-item ${layers[key] ? 'active' : ''}`}
                  onClick={() => toggleLayer(key)}
                >
                  <input type="checkbox" className="toggle-checkbox" checked={layers[key]} readOnly />
                  <span className="toggle-label">{label}</span>
                  <div className="toggle-color" style={{ background: color }} />
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-title">장애물 유형</div>
            <div className="toggle-group">
              {Object.entries(obstacleTypes).map(([type, enabled]) => (
                <div
                  key={type}
                  className={`toggle-item ${enabled ? 'active' : ''}`}
                  onClick={() => toggleObstacleType(type)}
                >
                  <input type="checkbox" className="toggle-checkbox" checked={enabled} readOnly />
                  <span className="toggle-label">{type}</span>
                  <div className="toggle-color" style={{ background: OBSTACLE_COLORS[type] }} />
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="info-box">
              <div className="info-label">공항 정보</div>
              <div className="info-value">{data?.airport?.name_kr || '울산공항'}</div>
              <div className="info-sub">
                ICAO: {data?.airport?.icao || 'RKPU'} | 표고: {data?.airport?.elevation || 14}m
              </div>
            </div>
          </div>

          <div className="section">
            <button className="fly-btn" onClick={flyToAirport}>
              공항으로 이동
            </button>
          </div>

          <div className="section">
            <div className="section-title">범례</div>
            <div className="legend">
              {[
                { label: '웨이포인트', color: COLORS.waypoint },
                { label: '건물', color: COLORS.obstacle_building },
                { label: '타워', color: COLORS.obstacle_tower },
                { label: '자연물', color: COLORS.obstacle_natural },
                { label: 'SID', color: COLORS.SID },
                { label: 'STAR', color: COLORS.STAR },
                { label: '접근', color: COLORS.APPROACH },
                { label: '공역', color: COLORS.airspace },
              ].map(({ label, color }) => (
                <div key={label} className="legend-item">
                  <div className="legend-color" style={{ background: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
