/**
 * WeatherPanel Component
 * 항공기상 정보 패널 (SIGMET, NOTAM, 낙뢰)
 */
import React from 'react';

interface SigmetItem {
  hazard?: string;
  seriesId?: string;
  rawSigmet?: string;
  firName?: string;
  base?: number;
  top?: number;
  dir?: string;
  spd?: number;
}

interface SigmetData {
  kma?: SigmetItem[];
  international?: SigmetItem[];
}

interface NotamItem {
  notam_id?: string;
  classification?: string;
  traditional_message?: string;
  message?: string;
}

interface NotamData {
  RKPU?: NotamItem[];
  RKPK?: NotamItem[];
  note?: string;
}

interface LightningStrike {
  lat?: number;
  lon?: number;
  amplitude?: number;
}

interface LightningData {
  strikes?: LightningStrike[];
  timeRange?: {
    start?: string;
    end?: string;
  };
}

type WxPanelTab = 'sigmet' | 'notam' | 'lightning';

interface SigmetListProps {
  sigmetData: SigmetData | null;
}

interface NotamListProps {
  notamData: NotamData | null;
}

interface LightningListProps {
  lightningData: LightningData | null;
}

interface WeatherPanelProps {
  showWxPanel: boolean;
  setShowWxPanel: (show: boolean) => void;
  wxPanelTab: WxPanelTab;
  setWxPanelTab: (tab: WxPanelTab) => void;
  sigmetData: SigmetData | null;
  notamData: NotamData | null;
  lightningData: LightningData | null;
}

/**
 * SIGMET List Component
 */
const SigmetList: React.FC<SigmetListProps> = ({ sigmetData }) => (
  <div className="wx-sigmet-list">
    <div className="wx-section-title">
      <span>한국 FIR SIGMET</span>
      <span className="wx-count">{sigmetData?.kma?.length || 0}건</span>
    </div>
    {(!sigmetData?.kma || sigmetData.kma.length === 0) && (
      <div className="wx-no-data">현재 발효중인 SIGMET 없음</div>
    )}
    {sigmetData?.kma?.map((sig, i) => (
      <div key={i} className={`wx-sigmet-item hazard-${(sig.hazard || 'unknown').toLowerCase()}`}>
        <div className="sigmet-header">
          <span className="sigmet-type">{sig.hazard || 'SIGMET'}</span>
          <span className="sigmet-id">{sig.seriesId}</span>
        </div>
        <div className="sigmet-raw">{sig.rawSigmet}</div>
      </div>
    ))}

    <div className="wx-section-title" style={{ marginTop: '16px' }}>
      <span>국제 SIGMET (전 세계)</span>
      <span className="wx-count">{sigmetData?.international?.length || 0}건</span>
    </div>
    {sigmetData?.international?.slice(0, 15).map((sig, i) => (
      <div key={i} className={`wx-sigmet-item hazard-${(sig.hazard || 'unknown').toLowerCase()}`}>
        <div className="sigmet-header">
          <span className="sigmet-type">{sig.hazard || 'SIGMET'}</span>
          <span className="sigmet-fir">{sig.firName?.split(' ')[0]}</span>
          <span className="sigmet-id">{sig.seriesId}</span>
        </div>
        <div className="sigmet-info">
          {sig.base && sig.top && <span>FL{Math.round(sig.base/100)}-{Math.round(sig.top/100)}</span>}
          {sig.dir && sig.spd && <span>MOV {sig.dir} {sig.spd}kt</span>}
        </div>
        <div className="sigmet-raw">{sig.rawSigmet?.slice(0, 200)}...</div>
      </div>
    ))}
  </div>
);

/**
 * NOTAM List Component (for Weather Panel)
 */
const NotamList: React.FC<NotamListProps> = ({ notamData }) => (
  <div className="wx-notam-list">
    <div className="wx-section-title">
      <span>RKPU NOTAM</span>
      <span className="wx-count">{(notamData?.RKPU?.length || 0) + (notamData?.RKPK?.length || 0)}건</span>
    </div>
    {(!notamData || ((notamData.RKPU?.length || 0) + (notamData.RKPK?.length || 0) === 0)) && (
      <div className="wx-no-data">{notamData?.note || '현재 발효중인 NOTAM 없음'}</div>
    )}
    {notamData?.RKPU?.slice(0, 15).map((notam, i) => (
      <div key={`rkpu-${i}`} className="wx-notam-item">
        <div className="notam-header">
          <span className="notam-id">{notam.notam_id || `RKPU #${i + 1}`}</span>
          <span className="notam-type">{notam.classification || 'NOTAM'}</span>
        </div>
        <div className="notam-text">{notam.traditional_message || notam.message || JSON.stringify(notam).slice(0, 300)}</div>
      </div>
    ))}
    {notamData?.RKPK && notamData.RKPK.length > 0 && (
      <>
        <div className="wx-section-title" style={{marginTop: '12px'}}>
          <span>RKPK 김해공항 NOTAM</span>
          <span className="wx-count">{notamData.RKPK.length}건</span>
        </div>
        {notamData.RKPK.slice(0, 10).map((notam, i) => (
          <div key={`rkpk-${i}`} className="wx-notam-item">
            <div className="notam-header">
              <span className="notam-id">{notam.notam_id || `RKPK #${i + 1}`}</span>
              <span className="notam-type">{notam.classification || 'NOTAM'}</span>
            </div>
            <div className="notam-text">{notam.traditional_message || notam.message || JSON.stringify(notam).slice(0, 300)}</div>
          </div>
        ))}
      </>
    )}
  </div>
);

/**
 * Lightning List Component
 */
const LightningList: React.FC<LightningListProps> = ({ lightningData }) => (
  <div className="wx-lightning-list">
    <div className="wx-section-title">
      <span>낙뢰 정보 (1시간)</span>
      <span className="wx-count">{lightningData?.strikes?.length || 0}건</span>
    </div>
    {(!lightningData?.strikes || lightningData.strikes.length === 0) && (
      <div className="wx-no-data">최근 1시간 내 낙뢰 발생 없음</div>
    )}
    <div className="lightning-summary">
      {lightningData?.timeRange && (
        <div className="lightning-time">
          관측기간: {lightningData.timeRange.start?.slice(8, 12)} - {lightningData.timeRange.end?.slice(8, 12)}
        </div>
      )}
    </div>
    {lightningData?.strikes?.slice(0, 50).map((strike, i) => (
      <div key={i} className="wx-lightning-item">
        <span className="lightning-icon">⚡</span>
        <span className="lightning-pos">{strike.lat?.toFixed(3)}°N {strike.lon?.toFixed(3)}°E</span>
        {strike.amplitude && <span className="lightning-amp">{strike.amplitude}kA</span>}
      </div>
    ))}
  </div>
);

/**
 * Weather Legend Component
 */
const WeatherLegend: React.FC = () => (
  <div className="wx-legend">
    <div className="legend-title">SIGMET 유형</div>
    <div className="legend-items">
      <span className="legend-item"><span className="legend-color turb"></span>TURB 난류</span>
      <span className="legend-item"><span className="legend-color ice"></span>ICE 착빙</span>
      <span className="legend-item"><span className="legend-color ts"></span>TS 뇌우</span>
      <span className="legend-item"><span className="legend-color va"></span>VA 화산재</span>
    </div>
  </div>
);

/**
 * Weather Panel Component
 */
const WeatherPanel: React.FC<WeatherPanelProps> = ({
  showWxPanel,
  setShowWxPanel,
  wxPanelTab,
  setWxPanelTab,
  sigmetData,
  notamData,
  lightningData
}) => {
  return (
    <div className={`wx-right-panel ${showWxPanel ? 'open' : ''}`}>
      {showWxPanel && (
        <div className="wx-panel-content">
          <div className="wx-panel-header">
            <h3>항공기상 정보</h3>
            <button className="wx-close-btn" onClick={() => setShowWxPanel(false)}>×</button>
          </div>

          <div className="wx-tabs">
            <button
              className={`wx-tab ${wxPanelTab === 'sigmet' ? 'active' : ''}`}
              onClick={() => setWxPanelTab('sigmet')}
            >
              SIGMET
              {sigmetData?.international && sigmetData.international.length > 0 && (
                <span className="wx-badge warn">{sigmetData.international.length}</span>
              )}
            </button>
            <button
              className={`wx-tab ${wxPanelTab === 'notam' ? 'active' : ''}`}
              onClick={() => setWxPanelTab('notam')}
            >
              NOTAM
              {((notamData?.RKPU?.length || 0) + (notamData?.RKPK?.length || 0)) > 0 && (
                <span className="wx-badge">
                  {(notamData?.RKPU?.length || 0) + (notamData?.RKPK?.length || 0)}
                </span>
              )}
            </button>
            <button
              className={`wx-tab ${wxPanelTab === 'lightning' ? 'active' : ''}`}
              onClick={() => setWxPanelTab('lightning')}
            >
              낙뢰
              {lightningData?.strikes && lightningData.strikes.length > 0 && (
                <span className="wx-badge alert">{lightningData.strikes.length}</span>
              )}
            </button>
          </div>

          <div className="wx-tab-content">
            {wxPanelTab === 'sigmet' && <SigmetList sigmetData={sigmetData} />}
            {wxPanelTab === 'notam' && <NotamList notamData={notamData} />}
            {wxPanelTab === 'lightning' && <LightningList lightningData={lightningData} />}
          </div>

          <WeatherLegend />
        </div>
      )}
    </div>
  );
};

export default WeatherPanel;
