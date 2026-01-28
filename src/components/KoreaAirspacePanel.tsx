/**
 * KoreaAirspacePanel Component
 * 국내 항로/공역 패널
 */
import React, { useMemo } from 'react';
import Accordion from './Accordion';
import ToggleItem from './ToggleItem';
import type { KoreaAirspaceData } from '../hooks/useDataLoading';

interface KoreaAirspacePanelProps {
  koreaAirspaceData: KoreaAirspaceData | null;
  koreaRoutesExpanded: boolean;
  setKoreaRoutesExpanded: (expanded: boolean) => void;
  showKoreaRoutes: boolean;
  setShowKoreaRoutes: (show: boolean) => void;
  showKoreaWaypoints: boolean;
  setShowKoreaWaypoints: (show: boolean) => void;
  showKoreaNavaids: boolean;
  setShowKoreaNavaids: (show: boolean) => void;
  showKoreaAirspaces: boolean;
  setShowKoreaAirspaces: (show: boolean) => void;
  showKoreaAirports: boolean;
  setShowKoreaAirports: (show: boolean) => void;
  showKoreaHoldings: boolean;
  setShowKoreaHoldings: (show: boolean) => void;
  showKoreaTerminalWaypoints: boolean;
  setShowKoreaTerminalWaypoints: (show: boolean) => void;
  // Procedure props
  showKoreaSids: boolean;
  setShowKoreaSids: (show: boolean) => void;
  showKoreaStars: boolean;
  setShowKoreaStars: (show: boolean) => void;
  showKoreaIaps: boolean;
  setShowKoreaIaps: (show: boolean) => void;
  selectedKoreaAirport: string;
  setSelectedKoreaAirport: (airport: string) => void;
}

/**
 * Korea Airspace Panel Component
 */
const KoreaAirspacePanel: React.FC<KoreaAirspacePanelProps> = React.memo(({
  koreaAirspaceData,
  koreaRoutesExpanded,
  setKoreaRoutesExpanded,
  showKoreaRoutes,
  setShowKoreaRoutes,
  showKoreaWaypoints,
  setShowKoreaWaypoints,
  showKoreaNavaids,
  setShowKoreaNavaids,
  showKoreaAirspaces,
  setShowKoreaAirspaces,
  showKoreaAirports,
  setShowKoreaAirports,
  showKoreaHoldings,
  setShowKoreaHoldings,
  showKoreaTerminalWaypoints,
  setShowKoreaTerminalWaypoints,
  showKoreaSids,
  setShowKoreaSids,
  showKoreaStars,
  setShowKoreaStars,
  showKoreaIaps,
  setShowKoreaIaps,
  selectedKoreaAirport,
  setSelectedKoreaAirport,
}) => {
  // 프로시저가 있는 공항 목록 계산
  const airportsWithProcedures = useMemo(() => {
    if (!koreaAirspaceData?.procedures) return [];
    const sids = koreaAirspaceData.procedures.sids || {};
    const stars = koreaAirspaceData.procedures.stars || {};
    const iaps = koreaAirspaceData.procedures.iaps || {};
    const allAirports = new Set([
      ...Object.keys(sids),
      ...Object.keys(stars),
      ...Object.keys(iaps),
    ]);
    return Array.from(allAirports).sort();
  }, [koreaAirspaceData?.procedures]);

  // 선택된 공항의 프로시저 개수 계산
  const procedureCounts = useMemo(() => {
    if (!koreaAirspaceData?.procedures || !selectedKoreaAirport) {
      return { sids: 0, stars: 0, iaps: 0 };
    }
    const procs = koreaAirspaceData.procedures;
    return {
      sids: Object.keys(procs.sids?.[selectedKoreaAirport] || {}).length,
      stars: Object.keys(procs.stars?.[selectedKoreaAirport] || {}).length,
      iaps: Object.keys(procs.iaps?.[selectedKoreaAirport] || {}).length,
    };
  }, [koreaAirspaceData?.procedures, selectedKoreaAirport]);

  // 전체 프로시저 개수 계산
  const totalProcedureCounts = useMemo(() => {
    if (!koreaAirspaceData?.procedures) {
      return { sids: 0, stars: 0, iaps: 0 };
    }
    const procs = koreaAirspaceData.procedures;
    let sidCount = 0, starCount = 0, iapCount = 0;
    Object.values(procs.sids || {}).forEach(apt => { sidCount += Object.keys(apt).length; });
    Object.values(procs.stars || {}).forEach(apt => { starCount += Object.keys(apt).length; });
    Object.values(procs.iaps || {}).forEach(apt => { iapCount += Object.keys(apt).length; });
    return { sids: sidCount, stars: starCount, iaps: iapCount };
  }, [koreaAirspaceData?.procedures]);

  if (!koreaAirspaceData) return null;

  const hasProcedures = airportsWithProcedures.length > 0;

  return (
    <Accordion
      title="국내 항로/공역"
      expanded={koreaRoutesExpanded}
      onToggle={() => setKoreaRoutesExpanded(!koreaRoutesExpanded)}
      badge={`${(koreaAirspaceData.airports?.length || 0) + (koreaAirspaceData.routes?.length || 0) + (koreaAirspaceData.airspaces?.length || 0) + (koreaAirspaceData.holdings?.length || 0)}개`}
    >
      <ToggleItem
        label="공항/활주로/ILS"
        checked={showKoreaAirports}
        onChange={setShowKoreaAirports}
        count={koreaAirspaceData.airports?.length || 0}
      />
      <ToggleItem
        label="항로 (ATS/RNAV)"
        checked={showKoreaRoutes}
        onChange={setShowKoreaRoutes}
        count={koreaAirspaceData.routes?.length || 0}
      />
      <ToggleItem
        label="웨이포인트"
        checked={showKoreaWaypoints}
        onChange={setShowKoreaWaypoints}
        count={koreaAirspaceData.waypoints?.length || 0}
      />
      <ToggleItem
        label="NAVAID (VOR/DME)"
        checked={showKoreaNavaids}
        onChange={setShowKoreaNavaids}
        count={koreaAirspaceData.navaids?.length || 0}
      />
      <ToggleItem
        label="공역 (P/R/D/MOA)"
        checked={showKoreaAirspaces}
        onChange={setShowKoreaAirspaces}
        count={koreaAirspaceData.airspaces?.length || 0}
      />
      <ToggleItem
        label="홀딩 패턴"
        checked={showKoreaHoldings}
        onChange={setShowKoreaHoldings}
        count={koreaAirspaceData.holdings?.length || 0}
      />
      <ToggleItem
        label="터미널 웨이포인트"
        checked={showKoreaTerminalWaypoints}
        onChange={setShowKoreaTerminalWaypoints}
        count={koreaAirspaceData.terminalWaypoints?.length || 0}
      />

      {/* 프로시저 섹션 */}
      {hasProcedures && (
        <div className="korea-procedures-section">
          <div className="korea-procedures-header">
            <span className="korea-procedures-title">출/도착 절차 (SID/STAR/IAP)</span>
            <span className="korea-procedures-total">
              총 {totalProcedureCounts.sids + totalProcedureCounts.stars + totalProcedureCounts.iaps}개
            </span>
          </div>
          
          <div className="korea-airport-selector">
            <label htmlFor="korea-airport-select">공항 선택:</label>
            <select
              id="korea-airport-select"
              value={selectedKoreaAirport}
              onChange={(e) => setSelectedKoreaAirport(e.target.value)}
              className="korea-airport-select"
            >
              <option value="">-- 공항 선택 --</option>
              {airportsWithProcedures.map((apt) => (
                <option key={apt} value={apt}>{apt}</option>
              ))}
            </select>
          </div>

          {selectedKoreaAirport && (
            <div className="korea-procedure-toggles">
              <ToggleItem
                label={`SID (출발 절차)`}
                checked={showKoreaSids}
                onChange={setShowKoreaSids}
                count={procedureCounts.sids}
              />
              <ToggleItem
                label={`STAR (도착 절차)`}
                checked={showKoreaStars}
                onChange={setShowKoreaStars}
                count={procedureCounts.stars}
              />
              <ToggleItem
                label={`IAP (접근 절차)`}
                checked={showKoreaIaps}
                onChange={setShowKoreaIaps}
                count={procedureCounts.iaps}
              />
            </div>
          )}
        </div>
      )}

      <div className="korea-airspace-info">
        <small>출처: eAIP Korea + Navigraph (AIRAC {koreaAirspaceData.metadata?.airac})</small>
      </div>
    </Accordion>
  );
});

KoreaAirspacePanel.displayName = 'KoreaAirspacePanel';

export default KoreaAirspacePanel;
