/**
 * AircraftDetailPanel Component
 * 항공기 상세 정보 패널 (FR24 스타일)
 */
import React from 'react';

/**
 * Aircraft Photo Section
 */
const AircraftPhotoSection = ({
  displayAircraft,
  aircraftPhoto,
  aircraftPhotoLoading,
  flightSchedule,
  getAircraftImage
}) => (
  <div className="aircraft-photo-section">
    {aircraftPhotoLoading && (
      <div className="aircraft-photo-loading">
        <div className="loading-spinner"></div>
      </div>
    )}
    {!aircraftPhotoLoading && (aircraftPhoto?.image || flightSchedule?.aircraft_images?.[0]?.src) && (
      <img
        src={aircraftPhoto?.image || flightSchedule?.aircraft_images?.[0]?.src}
        alt={displayAircraft.registration || displayAircraft.callsign}
        className="aircraft-photo"
        onError={(e) => {
          e.target.src = getAircraftImage(displayAircraft.icao_type || displayAircraft.type);
          e.target.onerror = null;
        }}
      />
    )}
    {!aircraftPhotoLoading && !aircraftPhoto?.image && !flightSchedule?.aircraft_images?.[0]?.src && (
      <img
        src={getAircraftImage(displayAircraft.icao_type || displayAircraft.type)}
        alt={displayAircraft.type || 'Aircraft'}
        className="aircraft-photo aircraft-photo-default"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    )}
    {(aircraftPhoto?.photographer || (flightSchedule?.aircraft_images?.[0]?.src && flightSchedule?._source === 'flightradar24')) && (
      <div className="aircraft-photo-credit">
        📷 {aircraftPhoto?.photographer || 'FlightRadar24'}
      </div>
    )}
    {!aircraftPhoto?.image && !flightSchedule?.aircraft_images?.[0]?.src && (displayAircraft.icao_type || displayAircraft.type) && (
      <div className="aircraft-photo-credit type-info">
        {displayAircraft.icao_type || displayAircraft.type}
      </div>
    )}
  </div>
);

/**
 * Route Display Section
 */
const RouteSection = ({ displayAircraft, flightSchedule, flightScheduleLoading, AIRPORT_DATABASE }) => (
  <div className="aircraft-route-section">
    <div className="route-display">
      <div className="route-airport origin">
        <span className="route-code">
          {flightSchedule?.departure?.iata || displayAircraft.origin || '???'}
        </span>
        <span className="route-name">
          {flightSchedule?.departure?.airport || AIRPORT_DATABASE[displayAircraft.origin]?.name || ''}
        </span>
        {(flightSchedule?.schedule?.std || flightSchedule?.schedule?.etd || flightSchedule?.departure?.scheduled) && (
          <span className="route-time">
            {flightSchedule?.schedule?.std || flightSchedule?.schedule?.etd ||
             (flightSchedule?.departure?.scheduled ? new Date(flightSchedule.departure.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '')}
          </span>
        )}
      </div>
      <div className="route-arrow">
        <div className="route-line"></div>
        <span className="route-icon">✈</span>
        <div className="route-line"></div>
      </div>
      <div className="route-airport destination">
        <span className="route-code">
          {flightSchedule?.arrival?.iata || displayAircraft.destination || '???'}
        </span>
        <span className="route-name">
          {flightSchedule?.arrival?.airport || AIRPORT_DATABASE[displayAircraft.destination]?.name || ''}
        </span>
        {(flightSchedule?.schedule?.sta || flightSchedule?.schedule?.eta || flightSchedule?.arrival?.scheduled) && (
          <span className="route-time">
            {flightSchedule?.schedule?.sta || flightSchedule?.schedule?.eta ||
             (flightSchedule?.arrival?.scheduled ? new Date(flightSchedule.arrival.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '')}
          </span>
        )}
      </div>
    </div>
    {flightScheduleLoading && (
      <div className="route-loading">스케줄 조회중...</div>
    )}
  </div>
);

/**
 * Takeoff/Landing Time Section
 * 실제 비행 데이터 기반으로 이륙 시간과 예상 착륙 시간 계산
 * IMPORTANT: 이륙 시간은 반드시 historical 데이터(OpenSky)가 있어야만 표시
 * realtimeData만으로는 이륙 시간을 알 수 없음 (세션 시작 이후 데이터만 있음)
 */
const TakeoffLandingSection = ({ flightSchedule, flightTrack, aircraftTrails, aircraftHex, displayAircraft, AIRPORT_DATABASE }) => {
  // 실제 비행 데이터에서 이륙 시간 추출 (AltitudeGraphSection과 동일한 로직)
  const getActualTakeoffTime = () => {
    const historicalData = flightTrack?.path || [];
    const realtimeData = aircraftTrails?.[aircraftHex] || [];

    // CRITICAL: historicalData가 없으면 이륙 시간을 계산할 수 없음
    // realtimeData만 있는 경우, 세션 시작 이후 데이터만 있어서 실제 이륙 시간을 알 수 없음
    if (historicalData.length === 0) {
      return null;
    }

    let trackData = [];

    // Merge historical and realtime data (same logic as AltitudeGraphSection)
    if (historicalData.length > 0 && realtimeData.length > 0) {
      const lastHistorical = historicalData[historicalData.length - 1];
      const lastHistTime = lastHistorical.time ? lastHistorical.time * 1000 : lastHistorical.timestamp || 0;

      const newerRealtimeData = realtimeData.filter(rt => {
        const rtTime = rt.timestamp || 0;
        return rtTime > lastHistTime;
      });

      trackData = [...historicalData, ...newerRealtimeData];
    } else {
      trackData = historicalData;
    }

    // Filter out ground data (on_ground=true or altitude < 100ft at start)
    let startIdx = 0;
    for (let i = 0; i < Math.min(trackData.length, 20); i++) {
      const pt = trackData[i];
      const altFt = pt.altitude_ft !== undefined ? pt.altitude_ft : (pt.altitude_m ? pt.altitude_m * 3.28084 : 0);
      if (pt.on_ground === true || altFt < 100) {
        startIdx = i + 1;
      } else {
        break;
      }
    }
    if (startIdx > 0 && startIdx < trackData.length) {
      trackData = trackData.slice(startIdx);
    }

    // Return first valid airborne point's timestamp
    if (trackData.length > 0) {
      const firstPoint = trackData[0];
      const timestamp = firstPoint.time ? firstPoint.time * 1000 : firstPoint.timestamp;
      return timestamp || null;
    }
    return null;
  };

  // 도착 공항까지 거리 계산 (NM)
  const getDistanceToDestination = () => {
    const destIcao = flightSchedule?.arrival?.icao;
    if (!destIcao || !AIRPORT_DATABASE?.[destIcao]) return null;

    const dest = AIRPORT_DATABASE[destIcao];
    const lat1 = displayAircraft?.lat;
    const lon1 = displayAircraft?.lon;
    const lat2 = dest.lat;
    const lon2 = dest.lon;

    if (!lat1 || !lon1 || !lat2 || !lon2) return null;

    // Haversine formula
    const R = 3440.065; // Earth radius in NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 예상 착륙 시간 계산 (현재 위치 + 속도 기반)
  const getEstimatedArrival = () => {
    const distanceNM = getDistanceToDestination();
    const groundSpeed = displayAircraft?.ground_speed;

    if (!distanceNM || !groundSpeed || groundSpeed < 50) return null;

    // 남은 비행 시간 (시간)
    const hoursRemaining = distanceNM / groundSpeed;
    // 착륙까지 약 15분 추가 (approach + landing)
    const totalMinutes = hoursRemaining * 60 + 15;

    const arrivalTime = new Date(Date.now() + totalMinutes * 60 * 1000);
    return arrivalTime;
  };

  const actualTakeoffTime = getActualTakeoffTime();
  const estimatedArrival = getEstimatedArrival();
  const distanceToDestNM = getDistanceToDestination();

  // 이륙 시간이나 착륙 예정이 없으면 표시 안 함
  if (!actualTakeoffTime && !estimatedArrival) {
    return null;
  }

  const takeoffTimeStr = actualTakeoffTime
    ? new Date(actualTakeoffTime).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})
    : '--:--';

  const arrivalTimeStr = estimatedArrival
    ? estimatedArrival.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})
    : '--:--';

  // 남은 비행 시간
  const getTimeRemaining = () => {
    if (!distanceToDestNM || !displayAircraft?.ground_speed || displayAircraft.ground_speed < 50) return null;
    const minutes = Math.round((distanceToDestNM / displayAircraft.ground_speed) * 60);
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  return (
    <div className="takeoff-landing-section">
      <div className="takeoff-landing-grid">
        <div className={`tl-item takeoff ${actualTakeoffTime ? '' : 'estimated'}`}>
          <span className="tl-label">이륙</span>
          <span className="tl-time">{takeoffTimeStr}</span>
        </div>
        <div className={`tl-item landing estimated`}>
          <span className="tl-label">착륙 예정</span>
          <span className="tl-time">{arrivalTimeStr}</span>
          {getTimeRemaining() && (
            <span className="tl-remaining">({getTimeRemaining()} 후)</span>
          )}
        </div>
      </div>
      {distanceToDestNM && (
        <div className="distance-remaining">
          도착까지 {Math.round(distanceToDestNM)} NM
        </div>
      )}
    </div>
  );
};

/**
 * Flight Data Grid Section
 */
const FlightDataSection = ({ displayAircraft }) => (
  <div className="aircraft-data-section">
    <div className="data-row">
      <div className="data-item">
        <span className="data-label">고도</span>
        <span className="data-value">{(displayAircraft.altitude_ft || 0).toLocaleString()} ft</span>
      </div>
      <div className="data-item">
        <span className="data-label">속도</span>
        <span className="data-value">{displayAircraft.ground_speed || 0} kt</span>
      </div>
      <div className="data-item">
        <span className="data-label">방향</span>
        <span className="data-value">{Math.round(displayAircraft.track || 0)}°</span>
      </div>
    </div>
    <div className="data-row">
      <div className="data-item">
        <span className="data-label">수직속도</span>
        <span className={`data-value ${displayAircraft.vertical_rate > 100 ? 'climbing' : displayAircraft.vertical_rate < -100 ? 'descending' : ''}`}>
          {displayAircraft.vertical_rate > 0 ? '+' : ''}{displayAircraft.vertical_rate || 0} fpm
        </span>
      </div>
      <div className="data-item">
        <span className="data-label">Squawk</span>
        <span className={`data-value squawk ${['7700', '7600', '7500'].includes(displayAircraft.squawk) ? 'emergency' : ''}`}>
          {displayAircraft.squawk || '----'}
        </span>
      </div>
    </div>
  </div>
);

/**
 * Flight Status Section (비행 단계, 공역, 절차)
 */
const FlightStatusSection = ({
  displayAircraft,
  data,
  atcData,
  sectionExpanded,
  toggleSection,
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure
}) => {
  const flightPhase = detectFlightPhase(displayAircraft, data?.airport);
  const currentAirspaces = detectCurrentAirspace(displayAircraft, atcData);
  const nearestWaypoints = findNearestWaypoints(displayAircraft, data?.waypoints, 3);
  const currentProcedure = detectCurrentProcedure(displayAircraft, data?.procedures, flightPhase.phase);

  return (
    <div className="flight-status-section collapsible-section">
      <div className="collapsible-header" onClick={() => toggleSection('flightStatus')}>
        <div className="section-title">비행 상태</div>
        <span className={`collapsible-icon ${sectionExpanded.flightStatus ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`collapsible-content ${!sectionExpanded.flightStatus ? 'collapsed' : ''}`}>
        <div className="status-item flight-phase">
          <span className="status-label">비행 단계</span>
          <span className="status-value" style={{ color: flightPhase.color }}>
            {flightPhase.icon} {flightPhase.phase_kr}
          </span>
        </div>

        {currentAirspaces.length > 0 && (
          <div className="status-item airspace-info">
            <span className="status-label">현재 공역</span>
            <div className="status-value-list">
              {currentAirspaces.slice(0, 3).map((as, idx) => (
                <div key={idx} className="airspace-chip" style={{ borderColor: as.color || '#64b5f6' }}>
                  <span className="airspace-type">{as.type}</span>
                  <span className="airspace-name">{as.name}</span>
                  {as.frequencies && as.frequencies[0] && (
                    <span className="airspace-freq">{as.frequencies[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentProcedure && (
          <div className="status-item procedure-info">
            <span className="status-label">현재 절차</span>
            <span className="status-value procedure">
              <span className="procedure-type">{currentProcedure.type}</span>
              {currentProcedure.name}
            </span>
          </div>
        )}

        {nearestWaypoints.length > 0 && (
          <div className="status-item waypoint-info">
            <span className="status-label">다음 경유지</span>
            <div className="waypoint-list">
              {nearestWaypoints.map((wp, idx) => (
                <div key={idx} className="waypoint-item">
                  <span className="waypoint-ident">{wp.ident}</span>
                  <span className="waypoint-dist">{wp.distance_nm.toFixed(1)} NM</span>
                  {wp.etaMinutes && (
                    <span className="waypoint-eta">
                      {wp.etaMinutes < 1 ? '<1분' : `${Math.round(wp.etaMinutes)}분`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Aircraft Info Section
 */
const AircraftInfoSection = ({
  displayAircraft,
  aircraftDetails,
  aircraftDetailsLoading,
  sectionExpanded,
  toggleSection
}) => (
  <div className="aircraft-info-section collapsible-section">
    <div className="collapsible-header" onClick={() => toggleSection('aircraftInfo')}>
      <div className="section-title">
        기체 정보
        {aircraftDetailsLoading && <span className="loading-dot">...</span>}
      </div>
      <span className={`collapsible-icon ${sectionExpanded.aircraftInfo ? 'expanded' : ''}`}>▼</span>
    </div>
    <div className={`collapsible-content ${!sectionExpanded.aircraftInfo ? 'collapsed' : ''}`}>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">기종</span>
          <span className="info-value">{aircraftDetails?.Type || displayAircraft.icao_type || displayAircraft.type || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">등록번호</span>
          <span className="info-value">{aircraftDetails?.Registration || displayAircraft.registration || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Mode-S Hex</span>
          <span className="info-value hex">{displayAircraft.hex?.toUpperCase() || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">운항사</span>
          <span className="info-value">{aircraftDetails?.RegisteredOwners || '-'}</span>
        </div>
        {aircraftDetails?.ICAOTypeCode && (
          <div className="info-item">
            <span className="info-label">ICAO 기종코드</span>
            <span className="info-value">{aircraftDetails.ICAOTypeCode}</span>
          </div>
        )}
        {aircraftDetails?.OperatorFlagCode && (
          <div className="info-item">
            <span className="info-label">운항사 코드</span>
            <span className="info-value">{aircraftDetails.OperatorFlagCode}</span>
          </div>
        )}
        {aircraftDetails?.Manufacturer && (
          <div className="info-item full-width">
            <span className="info-label">제조사</span>
            <span className="info-value">{aircraftDetails.Manufacturer}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

/**
 * Schedule Section
 */
const ScheduleSection = ({
  flightSchedule,
  flightScheduleLoading,
  sectionExpanded,
  toggleSection
}) => {
  if (!flightSchedule && !flightScheduleLoading) return null;

  return (
    <div className="aircraft-schedule-section collapsible-section">
      <div className="collapsible-header" onClick={() => toggleSection('schedule')}>
        <div className="section-title">
          스케줄 정보
          {flightScheduleLoading && <span className="loading-dot">...</span>}
          {flightSchedule?._source === 'ubikais' && <span className="data-source ubikais"> (UBIKAIS)</span>}
          {flightSchedule?._source === 'flightradar24' && <span className="data-source fr24"> (FR24)</span>}
        </div>
        <span className={`collapsible-icon ${sectionExpanded.schedule ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`collapsible-content ${!sectionExpanded.schedule ? 'collapsed' : ''}`}>
        {flightSchedule && (
          <div className="schedule-grid">
            <div className="schedule-item">
              <span className="schedule-label">항공편</span>
              <span className="schedule-value">{flightSchedule.flight?.iata || flightSchedule.flight?.icao || '-'}</span>
            </div>
            <div className="schedule-item">
              <span className="schedule-label">상태</span>
              <span className={`schedule-value status-${flightSchedule.flight_status}`}>
                {flightSchedule.flight_status === 'DEP' ? '출발' :
                 flightSchedule.flight_status === 'ARR' ? '도착' :
                 flightSchedule.flight_status === 'DLA' ? '지연' :
                 flightSchedule.flight_status === 'CNL' ? '취소' :
                 flightSchedule.flight_status === 'active' ? '운항중' :
                 flightSchedule.flight_status === 'scheduled' ? '예정' :
                 flightSchedule.flight_status === 'landed' ? '착륙' :
                 flightSchedule.flight_status === 'cancelled' ? '취소' :
                 flightSchedule.flight_status || '-'}
              </span>
            </div>
            {flightSchedule.schedule?.nature && (
              <div className="schedule-item">
                <span className="schedule-label">유형</span>
                <span className={`schedule-value nature-${flightSchedule.schedule.nature}`}>
                  {flightSchedule.schedule.nature === 'PAX' ? '✈️ 여객' :
                   flightSchedule.schedule.nature === 'CGO' ? '📦 화물' :
                   flightSchedule.schedule.nature === 'STP' ? '🛑 기술착륙' :
                   flightSchedule.schedule.nature === 'GEN' ? '🛩️ 일반' :
                   flightSchedule.schedule.nature}
                </span>
              </div>
            )}
            {flightSchedule.aircraft_info?.type && (
              <div className="schedule-item">
                <span className="schedule-label">기종</span>
                <span className="schedule-value">{flightSchedule.aircraft_info.type}</span>
              </div>
            )}
            <div className="schedule-item">
              <span className="schedule-label">출발</span>
              <span className="schedule-value">
                {flightSchedule.departure?.iata || flightSchedule.departure?.icao || '-'}
                {flightSchedule.departure?.scheduled && (
                  <span className="schedule-time">
                    {new Date(flightSchedule.departure.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                )}
              </span>
            </div>
            <div className="schedule-item">
              <span className="schedule-label">도착</span>
              <span className="schedule-value">
                {flightSchedule.arrival?.iata || flightSchedule.arrival?.icao || '-'}
                {flightSchedule.arrival?.scheduled && (
                  <span className="schedule-time">
                    {new Date(flightSchedule.arrival.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                )}
              </span>
            </div>
            {flightSchedule.schedule && (
              <>
                <div className="schedule-item full-width schedule-note">
                  <span className="schedule-hint">출발: {flightSchedule.departure?.iata || flightSchedule.departure?.icao} 현지시각 / 도착: {flightSchedule.arrival?.iata || flightSchedule.arrival?.icao} 현지시각</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">계획 출발</span>
                  <span className="schedule-value">{flightSchedule.schedule.std || '-'}</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">예상 출발</span>
                  <span className="schedule-value">{flightSchedule.schedule.etd || '-'}</span>
                </div>
                {flightSchedule.schedule.atd && (
                  <div className="schedule-item">
                    <span className="schedule-label">실제 출발</span>
                    <span className="schedule-value highlight">{flightSchedule.schedule.atd}</span>
                  </div>
                )}
                <div className="schedule-item">
                  <span className="schedule-label">계획 도착</span>
                  <span className="schedule-value">{flightSchedule.schedule.sta || '-'}</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">예상 도착</span>
                  <span className="schedule-value">{flightSchedule.schedule.eta || '-'}</span>
                </div>
              </>
            )}
            {flightSchedule.departure?.delay && (
              <div className="schedule-item full-width">
                <span className="schedule-label">지연</span>
                <span className="schedule-value delay">{flightSchedule.departure.delay}분</span>
              </div>
            )}
            {flightSchedule.departure?.gate && (
              <div className="schedule-item">
                <span className="schedule-label">출발 게이트</span>
                <span className="schedule-value">{flightSchedule.departure.gate}</span>
              </div>
            )}
            {flightSchedule.arrival?.gate && (
              <div className="schedule-item">
                <span className="schedule-label">도착 게이트</span>
                <span className="schedule-value">{flightSchedule.arrival.gate}</span>
              </div>
            )}
            {flightSchedule._lastUpdated && (
              <div className="schedule-item full-width">
                <span className="schedule-label">데이터 시각</span>
                <span className="schedule-value small">{flightSchedule._lastUpdated}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Altitude Graph Section
 */
const AltitudeGraphSection = ({
  displayAircraft,
  flightTrack,
  flightTrackLoading,
  aircraftTrails,
  graphHoverData,
  setGraphHoverData
}) => {
  // Merge historical data (flightTrack) with real-time data (aircraftTrails)
  // aircraftTrails has more recent data, so we append it to fill the gap
  const historicalData = flightTrack?.path || [];
  const realtimeData = aircraftTrails[displayAircraft.hex] || [];

  let trackData = [];

  if (historicalData.length > 0 && realtimeData.length > 0) {
    // Get the last timestamp from historical data
    const lastHistorical = historicalData[historicalData.length - 1];
    const lastHistTime = lastHistorical.time ? lastHistorical.time * 1000 : lastHistorical.timestamp || 0;

    // Filter realtime data that's newer than historical data
    const newerRealtimeData = realtimeData.filter(rt => {
      const rtTime = rt.timestamp || 0;
      return rtTime > lastHistTime;
    });

    // Merge: historical + newer realtime data
    trackData = [...historicalData, ...newerRealtimeData];
  } else if (historicalData.length > 0) {
    trackData = historicalData;
  } else {
    trackData = realtimeData;
  }

  // Filter out ground data (on_ground=true or altitude=0 at start)
  // Simple approach: just skip initial points where aircraft is on ground
  let startIdx = 0;
  for (let i = 0; i < Math.min(trackData.length, 20); i++) {
    const pt = trackData[i];
    // Skip if explicitly on ground or altitude is 0/very low (< 100ft)
    if (pt.on_ground === true || (pt.altitude_ft !== undefined && pt.altitude_ft < 100)) {
      startIdx = i + 1;
    } else {
      break;
    }
  }
  if (startIdx > 0 && startIdx < trackData.length) {
    trackData = trackData.slice(startIdx);
  }

  if (trackData.length < 4) return null;

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 320;
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2 || x < 30 || x > 310) { setGraphHoverData(null); return; }
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const idx = Math.round((x - 30) / xScale);
    const dp = validAltData[Math.max(0, Math.min(idx, validAltData.length - 1))];
    if (dp) {
      setGraphHoverData({
        time: dp.time ? new Date(dp.time * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : dp.timestamp ? new Date(dp.timestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null,
        altitude: dp.altitude_ft, x: (x / 320) * 100
      });
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 320;
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2 || x < 30 || x > 310) { setGraphHoverData(null); return; }
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const idx = Math.round((x - 30) / xScale);
    const dp = validAltData[Math.max(0, Math.min(idx, validAltData.length - 1))];
    if (dp) {
      setGraphHoverData({
        time: dp.time ? new Date(dp.time * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : dp.timestamp ? new Date(dp.timestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null,
        altitude: dp.altitude_ft, x: (x / 320) * 100
      });
    }
  };

  const renderGraph = () => {
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2) return null;

    const altitudes = validAltData.map(t => t.altitude_ft);
    const maxAlt = Math.max(...altitudes, 1000);
    const minAlt = Math.min(...altitudes.filter(a => a > 0), 0);
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const altRange = Math.max(maxAlt - minAlt, 1000);

    const altPath = validAltData.map((t, i) => {
      const x = 30 + i * xScale;
      const y = 105 - ((t.altitude_ft - minAlt) / altRange) * 90;
      if (isNaN(x) || isNaN(y)) return '';
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(p => p).join(' ');

    if (!altPath || altPath.length < 5) return null;
    const altArea = altPath + ` L310,105 L30,105 Z`;

    return (
      <>
        <path d={altArea} fill="url(#altGradient)" />
        <path d={altPath} fill="none" stroke="#64b5f6" strokeWidth="2" />
      </>
    );
  };

  const renderYAxisLabels = () => {
    if (trackData.length < 2) return null;
    const maxAlt = Math.max(...trackData.map(t => t.altitude_ft || 0), 1000);
    return (
      <>
        <text x="5" y="15" fill="#64b5f6" fontSize="8">{(maxAlt / 1000).toFixed(0)}k</text>
        <text x="5" y="108" fill="#64b5f6" fontSize="8">0</text>
        {graphHoverData && <line x1={graphHoverData.x * 3.2} y1="10" x2={graphHoverData.x * 3.2} y2="105" stroke="#fff" strokeWidth="1" strokeDasharray="3,3" />}
      </>
    );
  };

  const renderGraphSummary = () => {
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2) return null;
    const fp = validAltData[0], lp = validAltData[validAltData.length - 1];

    // Normalize timestamps to milliseconds
    const fpTimestamp = fp.time ? fp.time * 1000 : fp.timestamp || 0;
    const lpTimestamp = lp.time ? lp.time * 1000 : lp.timestamp || 0;

    // Format start time
    const startTime = fpTimestamp ? new Date(fpTimestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null;

    // Check if the last point is recent (within 2 minutes) - show "현재" for real-time data
    const isRecent = Date.now() - lpTimestamp < 120000; // 2 minutes
    const endTime = isRecent ? '현재' : (lpTimestamp ? new Date(lpTimestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '현재');

    // Calculate flight duration
    const durationMs = lpTimestamp - fpTimestamp;
    const durationMins = Math.round(durationMs / 60000);
    const durationHours = Math.floor(durationMins / 60);
    const durationRemMins = durationMins % 60;
    const durationStr = durationHours > 0
      ? `${durationHours}시간 ${durationRemMins}분`
      : `${durationMins}분`;

    const altChange = lp.altitude_ft - fp.altitude_ft;

    return (
      <div className="graph-summary">
        <span className="flight-duration">{startTime || '--:--'} ~ {endTime} KST ({durationStr})</span>
        <span className={`alt-change ${altChange > 500 ? 'climbing' : altChange < -500 ? 'descending' : ''}`}>
          {fp.altitude_ft?.toLocaleString()}ft → {lp.altitude_ft?.toLocaleString()}ft ({altChange > 0 ? '+' : ''}{altChange?.toLocaleString()}ft)
        </span>
      </div>
    );
  };

  // Determine data source label
  const hasHistorical = historicalData.length > 0;
  const hasRealtime = realtimeData.length > 0;
  const trinoSource = flightTrack?.source === 'trino';
  const sourceLabel = trinoSource
    ? (hasRealtime ? ' (Trino + 실시간)' : ' (Trino 전체이력)')
    : hasHistorical && hasRealtime ? ' (OpenSky + 실시간)' : hasHistorical ? ' (OpenSky)' : hasRealtime ? ' (실시간)' : '';

  return (
    <div className="aircraft-graph-section">
      <div className="section-title">
        비행 고도 그래프
        {flightTrackLoading && <span className="loading-dot">...</span>}
        <span className="graph-source">{sourceLabel}</span>
      </div>
      <div className="graph-container" style={{ position: "relative" }}>
        <svg
          viewBox="0 0 320 120"
          className="flight-graph"
          style={{ cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setGraphHoverData(null)}
          onMouseLeave={() => setGraphHoverData(null)}
        >
          <defs>
            <linearGradient id="altGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(100,181,246,0.3)" />
              <stop offset="100%" stopColor="rgba(100,181,246,0)" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="30" y1={10 + y} x2="310" y2={10 + y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}
          {renderGraph()}
          {renderYAxisLabels()}
        </svg>
        {graphHoverData && (
          <div className="graph-hover-tooltip" style={{ left: `${Math.min(Math.max(graphHoverData.x, 15), 85)}%`, transform: 'translateX(-50%)' }}>
            <div className="tooltip-altitude">{graphHoverData.altitude?.toLocaleString()} ft</div>
            {graphHoverData.time && <div className="tooltip-time">{graphHoverData.time}</div>}
          </div>
        )}
        <div className="graph-info">
          {renderGraphSummary()}
        </div>
      </div>
    </div>
  );
};

/**
 * Position Info Section
 */
const PositionSection = ({ displayAircraft }) => (
  <div className="aircraft-position-section">
    <div className="section-title">위치 정보</div>
    <div className="position-data">
      <div className="position-item">
        <span className="pos-label">LAT</span>
        <span className="pos-value">{displayAircraft.lat?.toFixed(5) || '-'}</span>
      </div>
      <div className="position-item">
        <span className="pos-label">LON</span>
        <span className="pos-value">{displayAircraft.lon?.toFixed(5) || '-'}</span>
      </div>
    </div>
    <div className="data-source">
      <span>📡 ADS-B: airplanes.live | 기체DB: hexdb.io</span>
    </div>
  </div>
);

/**
 * Main Aircraft Detail Panel Component
 */
const AircraftDetailPanel = ({
  showAircraftPanel,
  setShowAircraftPanel,
  selectedAircraft,
  setSelectedAircraft,
  aircraft,
  aircraftPhoto,
  aircraftPhotoLoading,
  aircraftDetails,
  aircraftDetailsLoading,
  flightSchedule,
  flightScheduleLoading,
  flightTrack,
  flightTrackLoading,
  aircraftTrails,
  sectionExpanded,
  toggleSection,
  graphHoverData,
  setGraphHoverData,
  data,
  atcData,
  getAircraftImage,
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
  AIRPORT_DATABASE
}) => {
  const displayAircraft = selectedAircraft ? aircraft.find(a => a.hex === selectedAircraft.hex) || selectedAircraft : null;
  const isLoading = aircraftPhotoLoading || !aircraftDetails;

  return (
    <div className={`aircraft-panel ${showAircraftPanel && displayAircraft ? 'open' : ''}`}>
      {showAircraftPanel && displayAircraft && (
        <div className="aircraft-panel-content">
          {/* Header */}
          <div className="aircraft-panel-header">
            <div className="aircraft-header-main">
              <span className="aircraft-callsign">{displayAircraft.callsign || displayAircraft.hex}</span>
              <span className="aircraft-reg">{displayAircraft.registration || 'N/A'}</span>
            </div>
            <button className="aircraft-close-btn" onClick={() => { setShowAircraftPanel(false); setSelectedAircraft(null); }}>×</button>
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div className="aircraft-panel-loading">
              <div className="spinner"></div>
              <span>항공기 정보 불러오는 중...</span>
            </div>
          )}

          {/* Photo Section */}
          <AircraftPhotoSection
            displayAircraft={displayAircraft}
            aircraftPhoto={aircraftPhoto}
            aircraftPhotoLoading={aircraftPhotoLoading}
            flightSchedule={flightSchedule}
            getAircraftImage={getAircraftImage}
          />

          {/* Route Section */}
          <RouteSection
            displayAircraft={displayAircraft}
            flightSchedule={flightSchedule}
            flightScheduleLoading={flightScheduleLoading}
            AIRPORT_DATABASE={AIRPORT_DATABASE}
          />

          {/* Takeoff/Landing Times */}
          <TakeoffLandingSection
            flightSchedule={flightSchedule}
            flightTrack={flightTrack}
            aircraftTrails={aircraftTrails}
            aircraftHex={displayAircraft.hex}
            displayAircraft={displayAircraft}
            AIRPORT_DATABASE={AIRPORT_DATABASE}
          />

          {/* Flight Data */}
          <FlightDataSection displayAircraft={displayAircraft} />

          {/* Flight Status */}
          <FlightStatusSection
            displayAircraft={displayAircraft}
            data={data}
            atcData={atcData}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
            detectFlightPhase={detectFlightPhase}
            detectCurrentAirspace={detectCurrentAirspace}
            findNearestWaypoints={findNearestWaypoints}
            detectCurrentProcedure={detectCurrentProcedure}
          />

          {/* Aircraft Info */}
          <AircraftInfoSection
            displayAircraft={displayAircraft}
            aircraftDetails={aircraftDetails}
            aircraftDetailsLoading={aircraftDetailsLoading}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
          />

          {/* Schedule */}
          <ScheduleSection
            flightSchedule={flightSchedule}
            flightScheduleLoading={flightScheduleLoading}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
          />

          {/* Altitude Graph */}
          <AltitudeGraphSection
            displayAircraft={displayAircraft}
            flightTrack={flightTrack}
            flightTrackLoading={flightTrackLoading}
            aircraftTrails={aircraftTrails}
            graphHoverData={graphHoverData}
            setGraphHoverData={setGraphHoverData}
          />

          {/* Position */}
          <PositionSection displayAircraft={displayAircraft} />
        </div>
      )}
    </div>
  );
};

export default AircraftDetailPanel;
