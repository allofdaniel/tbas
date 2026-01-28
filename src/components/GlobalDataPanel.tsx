/**
 * GlobalDataPanel Component
 * Global aviation data layer toggles
 */
import React from 'react';
import Accordion from './Accordion';
import ToggleItem from './ToggleItem';
import type { GlobalDataCounts } from '../hooks/useGlobalData';

interface GlobalDataPanelProps {
  globalExpanded: boolean;
  setGlobalExpanded: (v: boolean) => void;
  counts: GlobalDataCounts;
  loading: Record<string, boolean>;
  showGlobalAirports: boolean;
  setShowGlobalAirports: (v: boolean) => void;
  showGlobalNavaids: boolean;
  setShowGlobalNavaids: (v: boolean) => void;
  showGlobalHeliports: boolean;
  setShowGlobalHeliports: (v: boolean) => void;
  showGlobalWaypoints: boolean;
  setShowGlobalWaypoints: (v: boolean) => void;
  showGlobalAirways: boolean;
  setShowGlobalAirways: (v: boolean) => void;
  showGlobalHoldings: boolean;
  setShowGlobalHoldings: (v: boolean) => void;
  showGlobalCtrlAirspace: boolean;
  setShowGlobalCtrlAirspace: (v: boolean) => void;
  showGlobalRestrAirspace: boolean;
  setShowGlobalRestrAirspace: (v: boolean) => void;
  showGlobalFirUir: boolean;
  setShowGlobalFirUir: (v: boolean) => void;
}

const GlobalDataPanel: React.FC<GlobalDataPanelProps> = React.memo(({
  globalExpanded, setGlobalExpanded,
  counts, loading,
  showGlobalAirports, setShowGlobalAirports,
  showGlobalNavaids, setShowGlobalNavaids,
  showGlobalHeliports, setShowGlobalHeliports,
  showGlobalWaypoints, setShowGlobalWaypoints,
  showGlobalAirways, setShowGlobalAirways,
  showGlobalHoldings, setShowGlobalHoldings,
  showGlobalCtrlAirspace, setShowGlobalCtrlAirspace,
  showGlobalRestrAirspace, setShowGlobalRestrAirspace,
  showGlobalFirUir, setShowGlobalFirUir,
}) => {
  const totalLoaded = Object.values(counts).reduce((a, b) => a + b, 0);
  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <Accordion
      title={`Global Data${anyLoading ? ' ...' : ''}`}
      expanded={globalExpanded}
      onToggle={() => setGlobalExpanded(!globalExpanded)}
      badge={totalLoaded > 0 ? `${totalLoaded.toLocaleString()}` : undefined}
    >
      <ToggleItem
        label={`Airports${loading.airports ? ' ...' : ''}`}
        checked={showGlobalAirports}
        onChange={setShowGlobalAirports}
        count={counts.airports || undefined}
      />
      <ToggleItem
        label={`NAVAIDs${loading.navaids ? ' ...' : ''}`}
        checked={showGlobalNavaids}
        onChange={setShowGlobalNavaids}
        count={counts.navaids || undefined}
      />
      <ToggleItem
        label={`Heliports${loading.heliports ? ' ...' : ''}`}
        checked={showGlobalHeliports}
        onChange={setShowGlobalHeliports}
        count={counts.heliports || undefined}
      />
      <ToggleItem
        label={`Waypoints${loading.waypoints ? ' ...' : ''}`}
        checked={showGlobalWaypoints}
        onChange={setShowGlobalWaypoints}
        count={counts.waypoints || undefined}
      />
      <ToggleItem
        label={`Airways${loading.airways ? ' ...' : ''}`}
        checked={showGlobalAirways}
        onChange={setShowGlobalAirways}
        count={counts.airways || undefined}
      />
      <ToggleItem
        label={`Holdings${loading.holdings ? ' ...' : ''}`}
        checked={showGlobalHoldings}
        onChange={setShowGlobalHoldings}
        count={counts.holdings || undefined}
      />
      <ToggleItem
        label={`Ctrl Airspace${loading.ctrlAirspace ? ' ...' : ''}`}
        checked={showGlobalCtrlAirspace}
        onChange={setShowGlobalCtrlAirspace}
        count={counts.ctrlAirspace || undefined}
      />
      <ToggleItem
        label={`Restr Airspace${loading.restrAirspace ? ' ...' : ''}`}
        checked={showGlobalRestrAirspace}
        onChange={setShowGlobalRestrAirspace}
        count={counts.restrAirspace || undefined}
      />
      <ToggleItem
        label={`FIR/UIR${loading.firUir ? ' ...' : ''}`}
        checked={showGlobalFirUir}
        onChange={setShowGlobalFirUir}
        count={counts.firUir || undefined}
      />
      <div className="korea-airspace-info">
        <small>Source: Navigraph AIRAC 2601 (Jeppesen)</small>
      </div>
    </Accordion>
  );
});

GlobalDataPanel.displayName = 'GlobalDataPanel';

export default GlobalDataPanel;
