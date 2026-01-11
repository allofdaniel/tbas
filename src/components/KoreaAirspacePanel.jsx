/**
 * KoreaAirspacePanel Component
 * 국내 항로/공역 패널
 */
import React from 'react';
import Accordion from './Accordion';
import ToggleItem from './ToggleItem';

/**
 * Korea Airspace Panel Component
 */
const KoreaAirspacePanel = ({
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
  setShowKoreaAirspaces
}) => {
  if (!koreaAirspaceData) return null;

  return (
    <Accordion
      title="국내 항로/공역"
      expanded={koreaRoutesExpanded}
      onToggle={() => setKoreaRoutesExpanded(!koreaRoutesExpanded)}
      badge={`${(koreaAirspaceData.routes?.length || 0) + (koreaAirspaceData.airspaces?.length || 0)}개`}
    >
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
      <div className="korea-airspace-info">
        <small>출처: eAIP Korea (AIRAC {koreaAirspaceData.metadata?.airac})</small>
      </div>
    </Accordion>
  );
};

export default KoreaAirspacePanel;
