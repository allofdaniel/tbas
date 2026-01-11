/**
 * TimeWeatherBar Component
 * 시간 및 날씨 표시 바
 */
import React from 'react';
import { formatUTC, formatKST } from '../utils/format';

/**
 * Time Display
 */
const TimeDisplay = ({ currentTime }) => (
  <div className="time-display">
    <span className="time-utc">{formatUTC(currentTime)}</span>
    <span className="time-separator">|</span>
    <span className="time-kst">{formatKST(currentTime)}</span>
  </div>
);

/**
 * Weather Compact Display
 */
const WeatherCompact = ({
  weatherData,
  metarPinned,
  setMetarPinned,
  setShowMetarPopup,
  tafPinned,
  setTafPinned,
  setShowTafPopup,
  parseMetar,
  parseMetarTime
}) => {
  if (!weatherData?.metar) return null;

  const parsedMetar = parseMetar(weatherData.metar);

  return (
    <div className="weather-compact">
      <span className="wx-label">METAR</span>
      <span className={`wx-cat ${weatherData.metar.fltCat?.toLowerCase() || 'vfr'}`}>
        {weatherData.metar.fltCat || 'VFR'}
      </span>
      <span className="wx-time" title="관측시간 (KST)">
        {parseMetarTime(weatherData.metar)}
      </span>
      {parsedMetar?.wind && (
        <span className="wx-item" title={parsedMetar.windMs}>
          {parsedMetar.wind}
        </span>
      )}
      {parsedMetar?.visibility && (
        <span className="wx-item">{parsedMetar.visibility}</span>
      )}
      {parsedMetar?.rvr && (
        <span className="wx-item wx-rvr">{parsedMetar.rvr}</span>
      )}
      {parsedMetar?.temp && (
        <span className="wx-item">{parsedMetar.temp}</span>
      )}
      {weatherData.metar.altim && (
        <span className="wx-item">Q{weatherData.metar.altim}</span>
      )}
      <button
        className={`wx-metar-btn ${metarPinned ? 'pinned' : ''}`}
        onMouseEnter={() => !metarPinned && setShowMetarPopup(true)}
        onMouseLeave={() => !metarPinned && setShowMetarPopup(false)}
        onClick={() => { setMetarPinned(!metarPinned); setShowMetarPopup(!metarPinned); }}
      >
        METAR
      </button>
      {weatherData?.taf && (
        <button
          className={`wx-metar-btn ${tafPinned ? 'pinned' : ''}`}
          onMouseEnter={() => !tafPinned && setShowTafPopup(true)}
          onMouseLeave={() => !tafPinned && setShowTafPopup(false)}
          onClick={() => { setTafPinned(!tafPinned); setShowTafPopup(!tafPinned); }}
        >
          TAF
        </button>
      )}
    </div>
  );
};

/**
 * METAR Popup
 */
const MetarPopup = ({ weatherData, showMetarPopup, metarPinned, parseMetar }) => {
  if (!(showMetarPopup || metarPinned) || !weatherData?.metar) return null;

  const parsedMetar = parseMetar(weatherData.metar);

  return (
    <div className="metar-popup metar-popup-compact">
      <div className="metar-compact-row">
        <span className="mc-item"><b>Wind</b> {parsedMetar?.wind} ({weatherData.metar.wspdMs}m/s)</span>
        <span className="mc-item"><b>Vis</b> {weatherData.metar.visibM}m</span>
        {(weatherData.metar.lRvr || weatherData.metar.rRvr) && (
          <span className="mc-item mc-rvr">
            <b>RVR</b> {weatherData.metar.lRvr || '-'}/{weatherData.metar.rRvr || '-'}m
          </span>
        )}
        <span className="mc-item"><b>Temp</b> {weatherData.metar.temp}/{weatherData.metar.dewp}°C</span>
        <span className="mc-item"><b>QNH</b> {weatherData.metar.altim}</span>
        {weatherData.metar.ceiling && (
          <span className="mc-item"><b>Ceil</b> {weatherData.metar.ceiling}ft</span>
        )}
      </div>
      <div className="metar-raw-line">{weatherData.metar.rawOb}</div>
    </div>
  );
};

/**
 * TAF Popup
 */
const TafPopup = ({ weatherData, showTafPopup, tafPinned }) => {
  if (!(showTafPopup || tafPinned) || !weatherData?.taf) return null;

  return (
    <div className="metar-popup taf-popup">
      <div className="metar-popup-section">
        <div className="metar-popup-label">TAF</div>
        <div className="metar-popup-text">{weatherData.taf.rawTAF}</div>
      </div>
    </div>
  );
};

/**
 * Time Weather Bar Component
 */
const TimeWeatherBar = ({
  currentTime,
  weatherData,
  showMetarPopup,
  setShowMetarPopup,
  metarPinned,
  setMetarPinned,
  showTafPopup,
  setShowTafPopup,
  tafPinned,
  setTafPinned,
  parseMetar,
  parseMetarTime
}) => {
  return (
    <div className="time-weather-display">
      <TimeDisplay currentTime={currentTime} />
      <WeatherCompact
        weatherData={weatherData}
        metarPinned={metarPinned}
        setMetarPinned={setMetarPinned}
        setShowMetarPopup={setShowMetarPopup}
        tafPinned={tafPinned}
        setTafPinned={setTafPinned}
        setShowTafPopup={setShowTafPopup}
        parseMetar={parseMetar}
        parseMetarTime={parseMetarTime}
      />
      <MetarPopup
        weatherData={weatherData}
        showMetarPopup={showMetarPopup}
        metarPinned={metarPinned}
        parseMetar={parseMetar}
      />
      <TafPopup
        weatherData={weatherData}
        showTafPopup={showTafPopup}
        tafPinned={tafPinned}
      />
    </div>
  );
};

export default TimeWeatherBar;
