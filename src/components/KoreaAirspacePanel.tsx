/**
 * KoreaAirspacePanel Component
 * 국내 항로/공역 패널
 */
import React from 'react';
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
}) => {
  if (!koreaAirspaceData) return null;

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
      <div className="korea-airspace-info">
        <small>출처: eAIP Korea + Navigraph (AIRAC {koreaAirspaceData.metadata?.airac})</small>
      </div>
    </Accordion>
  );
});

KoreaAirspacePanel.displayName = 'KoreaAirspacePanel';

export default KoreaAirspacePanel;
