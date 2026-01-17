/**
 * NotamPanel Component
 * NOTAM 드롭다운 패널 컴포넌트
 */
import React from 'react';
import {
  AIRPORT_DATABASE,
  COUNTRY_INFO,
  KOREA_AIRPORTS,
  AIRPORT_COORDINATES,
} from '../constants/airports';
import {
  getNotamType,
  getCancelledNotamRef,
  getNotamValidity,
  isNotamActive,
  buildCancelledNotamSet,
} from '../utils/notam';

interface NotamDataItem {
  id?: string;
  location?: string;
  notam_number?: string;
  e_text?: string;
  qcode?: string;
  qcode_mean?: string;
  full_text?: string;
  effective_start?: string;
  effective_end?: string;
  [key: string]: unknown;
}

interface NotamDataResponse {
  data?: NotamDataItem[];
  returned?: number;
}

interface NotamExpandedState {
  [key: string]: boolean;
}

interface NotamPanelProps {
  // Panel state
  showNotamPanel: boolean;
  setShowNotamPanel: (show: boolean) => void;

  // Data
  notamData: NotamDataResponse | null;
  notamLoading: boolean;
  notamError: string | null;
  notamCacheAge: number | null;

  // Filters
  notamPeriod: string;
  setNotamPeriod: (period: string) => void;
  notamLocationFilter: string;
  setNotamLocationFilter: (filter: string) => void;
  notamFilter: string;
  setNotamFilter: (filter: string) => void;

  // Expansion
  notamExpanded: NotamExpandedState;
  setNotamExpanded: React.Dispatch<React.SetStateAction<NotamExpandedState>>;

  // Map layer
  notamLocationsOnMap: Set<string>;
  setNotamLocationsOnMap: (locations: Set<string>) => void;

  // Actions
  fetchNotamData: (period: string, forceRefresh?: boolean) => void;
}

interface LocationFilterProps {
  notamData: NotamDataResponse | null;
  notamLocationFilter: string;
  setNotamLocationFilter: (filter: string) => void;
}

interface MapToggleSectionProps {
  notamData: NotamDataResponse | null;
  notamLocationsOnMap: Set<string>;
  setNotamLocationsOnMap: (locations: Set<string>) => void;
}

interface NotamListProps {
  notamData: NotamDataResponse;
  notamFilter: string;
  notamLocationsOnMap: Set<string>;
  notamExpanded: NotamExpandedState;
  setNotamExpanded: React.Dispatch<React.SetStateAction<NotamExpandedState>>;
}

interface NotamItemProps {
  notam: NotamDataItem;
  idx: number;
  cancelledSet: Set<string>;
  notamExpanded: NotamExpandedState;
  setNotamExpanded: React.Dispatch<React.SetStateAction<NotamExpandedState>>;
}

const NotamPanel: React.FC<NotamPanelProps> = ({
  // Panel state
  showNotamPanel,
  setShowNotamPanel,

  // Data
  notamData,
  notamLoading,
  notamError,
  notamCacheAge,

  // Filters
  notamPeriod,
  setNotamPeriod,
  notamLocationFilter,
  setNotamLocationFilter,
  notamFilter,
  setNotamFilter,

  // Expansion
  notamExpanded,
  setNotamExpanded,

  // Map layer
  notamLocationsOnMap,
  setNotamLocationsOnMap,

  // Actions
  fetchNotamData,
}) => {
  return (
    <div className="notam-dropdown-wrapper">
      <button
        className={`view-btn ${showNotamPanel ? 'active' : ''}`}
        onClick={() => setShowNotamPanel(!showNotamPanel)}
        title="NOTAM"
      >
        NOTAM
      </button>

      {showNotamPanel && (
        <div className="notam-dropdown">
          {/* Header */}
          <div className="notam-dropdown-header">
            <span className="notam-dropdown-title">NOTAM</span>
            <div className="notam-header-controls">
              <select
                className="notam-period-select"
                value={notamPeriod}
                onChange={(e) => setNotamPeriod(e.target.value)}
                title="기간"
              >
                <option value="current">현재 유효</option>
                <option value="1month">1개월</option>
                <option value="1year">1년</option>
                <option value="all">전체</option>
              </select>

              <LocationFilter
                notamData={notamData}
                notamLocationFilter={notamLocationFilter}
                setNotamLocationFilter={setNotamLocationFilter}
              />

              <button
                className="notam-refresh-btn"
                onClick={() => fetchNotamData(notamPeriod, true)}
                title="새로고침 (캐시 무시)"
              >
                ↻
              </button>

              {notamCacheAge !== null && (
                <span className="notam-cache-info" title="캐시된 데이터 사용 중">
                  📦 {Math.floor(notamCacheAge / 1000)}초 전
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="notam-search">
            <input
              type="text"
              placeholder="검색 (NOTAM 번호, 내용...)"
              value={notamFilter}
              onChange={(e) => setNotamFilter(e.target.value)}
              className="notam-search-input"
            />
          </div>

          {/* Map Toggle Section */}
          <MapToggleSection
            notamData={notamData}
            notamLocationsOnMap={notamLocationsOnMap}
            setNotamLocationsOnMap={setNotamLocationsOnMap}
          />

          {/* Legend */}
          <div className="notam-map-legend">
            <span className="notam-legend-item notam-legend-active">
              <span className="notam-legend-dot" style={{ background: '#FF9800' }}></span>
              활성 NOTAM
            </span>
            <span className="notam-legend-item notam-legend-future">
              <span className="notam-legend-dot" style={{ background: '#2196F3' }}></span>
              예정 NOTAM
            </span>
            <span className="notam-legend-info">
              {notamLocationsOnMap.size === 0 ? '공항 선택 시 지도 표시' : `${notamLocationsOnMap.size}개 공항 표시 중`}
            </span>
          </div>

          {/* Content */}
          <div className="notam-content">
            {notamLoading && <div className="notam-loading">로딩 중...</div>}
            {notamError && <div className="notam-error">오류: {notamError}</div>}
            {notamData && !notamLoading && (
              <NotamList
                notamData={notamData}
                notamFilter={notamFilter}
                notamLocationsOnMap={notamLocationsOnMap}
                notamExpanded={notamExpanded}
                setNotamExpanded={setNotamExpanded}
              />
            )}
          </div>

          {/* Footer */}
          <div className="notam-footer">
            {notamData && (
              <span className="notam-count">
                {notamLocationsOnMap.size > 0
                  ? `선택 공항 NOTAM ${notamData.data?.filter(n => notamLocationsOnMap.has(n.location || '')).length || 0}건`
                  : `전체 ${notamData.returned?.toLocaleString() || notamData.data?.length || 0}건`
                }
              </span>
            )}
            <span className="notam-update-time">
              {notamLocationsOnMap.size > 0 ? [...notamLocationsOnMap].join(', ') : '지도 영역 기준'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Location Filter Select Component
 */
const LocationFilter: React.FC<LocationFilterProps> = ({ notamData, notamLocationFilter, setNotamLocationFilter }) => {
  const locations = [...new Set(notamData?.data?.map(n => n.location).filter(Boolean) as string[])];
  const counts: Record<string, number> = {};
  locations.forEach(loc => {
    counts[loc] = notamData?.data?.filter(n => n.location === loc).length || 0;
  });

  const intlAirports = locations.filter(loc => KOREA_AIRPORTS[loc]?.type === 'international').sort();
  const domesticAirports = locations.filter(loc => KOREA_AIRPORTS[loc]?.type === 'domestic').sort();
  const firOther = locations.filter(loc => KOREA_AIRPORTS[loc]?.type === 'fir').sort();
  const others = locations.filter(loc => !KOREA_AIRPORTS[loc]).sort();

  return (
    <select
      className="notam-location-select"
      value={notamLocationFilter}
      onChange={(e) => setNotamLocationFilter(e.target.value)}
    >
      <option value="">전체 지역</option>
      {intlAirports.length > 0 && (
        <optgroup label="🌏 국제공항">
          {intlAirports.map(loc => (
            <option key={loc} value={loc}>{loc} {KOREA_AIRPORTS[loc]?.name} ({counts[loc]})</option>
          ))}
        </optgroup>
      )}
      {domesticAirports.length > 0 && (
        <optgroup label="🏠 국내공항">
          {domesticAirports.map(loc => (
            <option key={loc} value={loc}>{loc} {KOREA_AIRPORTS[loc]?.name} ({counts[loc]})</option>
          ))}
        </optgroup>
      )}
      {firOther.length > 0 && (
        <optgroup label="📡 FIR/ACC">
          {firOther.map(loc => (
            <option key={loc} value={loc}>{loc} {KOREA_AIRPORTS[loc]?.name} ({counts[loc]})</option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="기타">
          {others.map(loc => (
            <option key={loc} value={loc}>{loc} ({counts[loc]})</option>
          ))}
        </optgroup>
      )}
    </select>
  );
};

/**
 * Map Toggle Section Component
 */
const MapToggleSection: React.FC<MapToggleSectionProps> = ({ notamData, notamLocationsOnMap, setNotamLocationsOnMap }) => {
  const locations = [...new Set(notamData?.data?.map(n => n.location).filter(Boolean) as string[])];
  const locationsWithCoords = locations.filter(loc => AIRPORT_COORDINATES[loc]);

  // Group by country
  const byCountry: Record<string, string[]> = {};
  locationsWithCoords.forEach(loc => {
    const info = AIRPORT_DATABASE[loc];
    const country = info?.country || 'OTHER';
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(loc);
  });

  const countryOrder = ['KR', 'JP', 'CN', 'TW', 'HK', 'VN', 'TH', 'SG', 'PH', 'US', 'OTHER'];
  const sortedCountries = Object.keys(byCountry).sort((a, b) => {
    const ai = countryOrder.indexOf(a);
    const bi = countryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const toggleLocation = (loc: string): void => {
    const newSet = new Set(notamLocationsOnMap);
    if (newSet.has(loc)) {
      newSet.delete(loc);
    } else {
      newSet.add(loc);
    }
    setNotamLocationsOnMap(newSet);
  };

  const toggleAll = (locs: string[]): void => {
    const newSet = new Set(notamLocationsOnMap);
    const allSelected = locs.every(loc => newSet.has(loc));
    locs.forEach(loc => allSelected ? newSet.delete(loc) : newSet.add(loc));
    setNotamLocationsOnMap(newSet);
  };

  // Calculate NOTAM counts
  const getNotamCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {};
    const cancelledSet = buildCancelledNotamSet(notamData?.data || []);
    notamData?.data?.forEach(n => {
      const nType = getNotamType(n.full_text || '');
      if (nType === 'C') return;
      const validity = getNotamValidity(n, cancelledSet);
      if (!validity) return;
      counts[n.location || ''] = (counts[n.location || ''] || 0) + 1;
    });
    return counts;
  };

  const notamCounts = getNotamCounts();

  const renderChips = (locs: string[], label: string): React.ReactNode => locs.length > 0 && (
    <div className="notam-country-subgroup" key={label}>
      <span className="notam-subgroup-label">{label}</span>
      <div className="notam-map-location-chips">
        {locs.map(loc => {
          const isActive = notamLocationsOnMap.has(loc);
          const info = AIRPORT_DATABASE[loc];
          const shortName = info?.name?.replace('국제공항', '').replace('공항', '').replace('비행장', '') || loc;
          const count = notamCounts[loc] || 0;
          return (
            <button
              key={loc}
              className={`notam-map-chip ${isActive ? 'active' : ''} ${info?.type || 'other'}`}
              onClick={() => toggleLocation(loc)}
              title={`${loc} ${info?.name || ''} (${count}건) - 지도에 ${isActive ? '숨기기' : '표시'}`}
            >
              {loc} {shortName !== loc ? shortName : ''} ({count})
            </button>
          );
        })}
        <button className="notam-select-all-btn" onClick={() => toggleAll(locs)}>
          {locs.every(loc => notamLocationsOnMap.has(loc)) ? '전체해제' : '전체선택'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="notam-map-toggle-section">
      <span className="notam-map-toggle-label">지도 표시 필터 (좌표 있는 공항만):</span>

      {sortedCountries.map(country => {
        const countryInfo = COUNTRY_INFO[country];
        const countryName = countryInfo?.name || '기타';
        const countryFlag = countryInfo?.flag || '🌐';
        const airportsInCountry = byCountry[country].sort();

        if (country === 'KR') {
          const hub = airportsInCountry.filter(loc => AIRPORT_DATABASE[loc]?.type === 'hub');
          const general = airportsInCountry.filter(loc => AIRPORT_DATABASE[loc]?.type === 'general');
          const military = airportsInCountry.filter(loc => AIRPORT_DATABASE[loc]?.type === 'military');
          const fir = airportsInCountry.filter(loc => AIRPORT_DATABASE[loc]?.type === 'fir');
          const other = airportsInCountry.filter(loc => !['hub', 'general', 'military', 'fir'].includes(AIRPORT_DATABASE[loc]?.type || ''));

          return (
            <div className="notam-country-group" key={country}>
              <div className="notam-country-header">{countryFlag} {countryName}</div>
              {renderChips(hub, '거점공항')}
              {renderChips(general, '일반공항')}
              {renderChips(military, '군공항')}
              {renderChips(fir, 'FIR/ACC')}
              {renderChips(other, '기타')}
            </div>
          );
        }

        return (
          <div className="notam-country-group" key={country}>
            <div className="notam-country-header">{countryFlag} {countryName}</div>
            <div className="notam-map-location-chips">
              {airportsInCountry.map(loc => {
                const isActive = notamLocationsOnMap.has(loc);
                const info = AIRPORT_DATABASE[loc];
                const shortName = info?.name?.replace('공항', '').replace('국제', '') || loc;
                const count = notamCounts[loc] || 0;
                return (
                  <button
                    key={loc}
                    className={`notam-map-chip ${isActive ? 'active' : ''} ${info?.type || 'other'}`}
                    onClick={() => toggleLocation(loc)}
                    title={`${loc} ${info?.name || ''} (${count}건) - 지도에 ${isActive ? '숨기기' : '표시'}`}
                  >
                    {loc} {shortName !== loc ? shortName : ''} ({count})
                  </button>
                );
              })}
              <button className="notam-select-all-btn" onClick={() => toggleAll(airportsInCountry)}>
                {airportsInCountry.every(loc => notamLocationsOnMap.has(loc)) ? '전체해제' : '전체선택'}
              </button>
            </div>
          </div>
        );
      })}

      {notamLocationsOnMap.size > 0 && (
        <button
          className="notam-map-clear-btn"
          onClick={() => setNotamLocationsOnMap(new Set())}
        >
          필터 해제 ({notamLocationsOnMap.size}개 선택됨)
        </button>
      )}
    </div>
  );
};

/**
 * NOTAM List Component
 */
const NotamList: React.FC<NotamListProps> = ({ notamData, notamFilter, notamLocationsOnMap, notamExpanded, setNotamExpanded }) => {
  const cancelledSet = buildCancelledNotamSet(notamData.data || []);

  const filtered = notamData.data?.filter(n => {
    const matchMapFilter = notamLocationsOnMap.size === 0 || notamLocationsOnMap.has(n.location || '');
    const matchSearch = !notamFilter ||
      n.notam_number?.toLowerCase().includes(notamFilter.toLowerCase()) ||
      n.location?.toLowerCase().includes(notamFilter.toLowerCase()) ||
      n.e_text?.toLowerCase().includes(notamFilter.toLowerCase()) ||
      n.qcode_mean?.toLowerCase().includes(notamFilter.toLowerCase());
    const isValid = isNotamActive(n, cancelledSet);
    return matchMapFilter && matchSearch && isValid;
  }) || [];

  if (filtered.length === 0) {
    return <div className="notam-empty">해당 조건의 유효한 NOTAM이 없습니다.</div>;
  }

  return (
    <div className="notam-list">
      {filtered.map((n, idx) => (
        <NotamItem
          key={n.id || idx}
          notam={n}
          idx={idx}
          cancelledSet={cancelledSet}
          notamExpanded={notamExpanded}
          setNotamExpanded={setNotamExpanded}
        />
      ))}
    </div>
  );
};

/**
 * NOTAM Item Component
 */
const NotamItem: React.FC<NotamItemProps> = ({ notam, idx, cancelledSet, notamExpanded, setNotamExpanded }) => {
  const n = notam;
  const notamType = getNotamType(n.full_text || '');
  const typeLabel = notamType === 'R' ? 'REPLACE' : notamType === 'C' ? 'CANCEL' : 'NEW';
  const cancelledRef = getCancelledNotamRef(n.full_text || '');
  const validity = getNotamValidity(n, cancelledSet);
  const validityLabel = validity === 'future' ? '예정' : '활성';
  const itemKey = n.id || String(idx);

  return (
    <div className={`notam-item notam-type-${notamType} notam-validity-${validity}`}>
      <div
        className="notam-item-header"
        onClick={() => setNotamExpanded(p => ({ ...p, [itemKey]: !p[itemKey] }))}
      >
        <span className="notam-location">{n.location}</span>
        <span className="notam-number">{n.notam_number}</span>
        <span className={`notam-validity-badge notam-validity-${validity}`}>{validityLabel}</span>
        <span className={`notam-type-badge notam-type-${notamType}`}>{typeLabel}</span>
        <span className={`notam-expand-icon ${notamExpanded[itemKey] ? 'expanded' : ''}`}>▼</span>
      </div>

      {notamExpanded[itemKey] && (
        <div className="notam-item-detail">
          {notamType === 'R' && cancelledRef && (
            <div className="notam-detail-row notam-replaced-ref">
              <span className="notam-label">대체 대상:</span>
              <span>{cancelledRef}</span>
            </div>
          )}
          <div className="notam-detail-row">
            <span className="notam-label">Q-Code:</span>
            <span>{n.qcode} - {n.qcode_mean}</span>
          </div>
          <div className="notam-detail-row">
            <span className="notam-label">유효기간:</span>
            <span>{n.effective_start || '-'} ~ {n.effective_end || 'PERM'}</span>
          </div>
          <div className="notam-detail-row">
            <span className="notam-label">내용:</span>
          </div>
          <div className="notam-e-text">{n.e_text}</div>
          {n.full_text && (
            <>
              <div className="notam-detail-row">
                <span className="notam-label">전문:</span>
              </div>
              <div className="notam-full-text">{n.full_text}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NotamPanel;
