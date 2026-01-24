/**
 * ChartPanel Component
 * DO-278A 요구사항 추적: SRS-UI-011
 *
 * AIP 차트 선택 및 표시 패널
 */

import { useCallback } from 'react';
import { getKoreanAirports, AIRPORT_COORDINATES } from '@/config/airports';
import type { ChartData } from '@/presentation/components/map/ChartLayer';

// 차트 타입 정보
const CHART_TYPES: { type: string; label: string; description: string }[] = [
  { type: 'ADC', label: 'ADC', description: 'Aerodrome Chart' },
  { type: 'PDC', label: 'PDC', description: 'Parking/Docking' },
  { type: 'GMC', label: 'GMC', description: 'Ground Movement' },
  { type: 'AOC', label: 'AOC', description: 'Obstacle Chart' },
  { type: 'AOC-A', label: 'AOC-A', description: 'Type A' },
  { type: 'AOC-B', label: 'AOC-B', description: 'Type B' },
  { type: 'SID', label: 'SID', description: 'Departure' },
  { type: 'STAR', label: 'STAR', description: 'Arrival' },
  { type: 'IAC', label: 'IAC', description: 'Approach' },
  { type: 'VAC', label: 'VAC', description: 'Visual Approach' },
];

interface ChartPanelProps {
  selectedAirport: string;
  onAirportChange: (icao: string) => void;
  selectedChartTypes: string[];
  onChartTypesChange: (types: string[]) => void;
  chartOpacity: number;
  onOpacityChange: (opacity: number) => void;
  charts: ChartData[];
  onChartToggle?: (chart: ChartData, enabled: boolean) => void;
}

export function ChartPanel({
  selectedAirport,
  onAirportChange,
  selectedChartTypes,
  onChartTypesChange,
  chartOpacity,
  onOpacityChange,
  charts,
  onChartToggle: _onChartToggle,
}: ChartPanelProps) {
  const koreanAirports = getKoreanAirports();

  const handleChartTypeToggle = useCallback(
    (type: string) => {
      if (selectedChartTypes.includes(type)) {
        onChartTypesChange(selectedChartTypes.filter((t) => t !== type));
      } else {
        onChartTypesChange([...selectedChartTypes, type]);
      }
    },
    [selectedChartTypes, onChartTypesChange]
  );

  const selectAllTypes = useCallback(() => {
    onChartTypesChange(CHART_TYPES.map((t) => t.type));
  }, [onChartTypesChange]);

  const clearAllTypes = useCallback(() => {
    onChartTypesChange([]);
  }, [onChartTypesChange]);

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '12px',
        padding: '16px',
        color: '#fff',
        fontSize: '13px',
        minWidth: '280px',
        maxHeight: '500px',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '14px' }}>
        AIP Charts
      </div>

      {/* 공항 선택 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontSize: '11px' }}>
          Airport
        </label>
        <select
          value={selectedAirport}
          onChange={(e) => onAirportChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#333',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {koreanAirports
            .filter((a) => AIRPORT_COORDINATES[a.icao])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((airport) => (
              <option key={airport.icao} value={airport.icao}>
                {airport.icao} - {airport.name}
              </option>
            ))}
        </select>
      </div>

      {/* 차트 타입 선택 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ color: '#aaa', fontSize: '11px' }}>Chart Types</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={selectAllTypes}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: '#444',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={clearAllTypes}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: '#444',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              None
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CHART_TYPES.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => handleChartTypeToggle(type)}
              title={description}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: selectedChartTypes.includes(type)
                  ? '1px solid #2196F3'
                  : '1px solid #555',
                backgroundColor: selectedChartTypes.includes(type)
                  ? 'rgba(33, 150, 243, 0.3)'
                  : 'transparent',
                color: selectedChartTypes.includes(type) ? '#fff' : '#aaa',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 투명도 조절 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontSize: '11px' }}>
          Opacity: {Math.round(chartOpacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={chartOpacity * 100}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          style={{
            width: '100%',
            height: '4px',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* 로드된 차트 목록 */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '11px' }}>
          Loaded Charts ({charts.length})
        </label>
        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {charts.length === 0 ? (
            <div style={{ color: '#666', fontSize: '11px', fontStyle: 'italic' }}>
              No charts available for this airport
            </div>
          ) : (
            charts.map((chart) => (
              <div
                key={chart.id}
                style={{
                  padding: '6px 8px',
                  marginBottom: '4px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ color: '#2196F3', marginRight: '8px' }}>
                    {chart.chart_type}
                  </span>
                  <span style={{ color: '#888' }}>
                    {chart.runway ? `RWY ${chart.runway}` : chart.name}
                  </span>
                </div>
                <span style={{ color: '#666', fontSize: '10px' }}>
                  {chart.image_url.endsWith('.pdf') ? 'PDF' : 'IMG'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
