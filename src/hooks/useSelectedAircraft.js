import { useState, useEffect } from 'react';
import { AIRPORT_DATABASE } from '../constants/airports';
import { ICAO_TO_IATA } from '../constants/aircraft';

/**
 * useSelectedAircraft - 선택된 항공기 상세 정보 관리 훅
 * - 항공기 사진 로딩
 * - hexdb.io 기체 상세정보
 * - 비행 스케줄 정보
 * - OpenSky 비행 경로
 */
export default function useSelectedAircraft(selectedAircraft) {
  const [aircraftPhoto, setAircraftPhoto] = useState(null);
  const [aircraftPhotoLoading, setAircraftPhotoLoading] = useState(false);
  const [aircraftDetails, setAircraftDetails] = useState(null);
  const [aircraftDetailsLoading, setAircraftDetailsLoading] = useState(false);
  const [flightSchedule, setFlightSchedule] = useState(null);
  const [flightScheduleLoading, setFlightScheduleLoading] = useState(false);
  const [flightTrack, setFlightTrack] = useState(null);
  const [flightTrackLoading, setFlightTrackLoading] = useState(false);
  const [showAircraftPanel, setShowAircraftPanel] = useState(false);

  // aviationstack API key (환경변수 또는 직접 설정)
  const AVIATIONSTACK_API_KEY = import.meta.env.VITE_AVIATIONSTACK_API_KEY || '';

  // Fetch aircraft photo when selectedAircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      setAircraftPhoto(null);
      setShowAircraftPanel(false);
      return;
    }

    setShowAircraftPanel(true);
    setAircraftPhotoLoading(true);
    setAircraftPhoto(null);

    const hex = selectedAircraft.hex?.toUpperCase();
    const reg = selectedAircraft.registration;

    // Vercel API Route를 통한 사진 조회 (CORS 해결)
    const fetchPhoto = async () => {
      try {
        const params = new URLSearchParams();
        if (hex) params.append('hex', hex);
        if (reg) params.append('reg', reg);

        const res = await fetch(`/api/aircraft-photo?${params}`);
        const data = await res.json();

        if (data.image) {
          setAircraftPhoto(data);
        }
        setAircraftPhotoLoading(false);
      } catch (err) {
        console.warn('Failed to fetch aircraft photo:', err);
        setAircraftPhotoLoading(false);
      }
    };

    fetchPhoto();
  }, [selectedAircraft?.hex]);

  // Fetch aircraft details from hexdb.io when selectedAircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      setAircraftDetails(null);
      return;
    }

    const hex = selectedAircraft.hex?.toUpperCase();
    if (!hex) return;

    setAircraftDetailsLoading(true);
    setAircraftDetails(null);

    const fetchDetails = async () => {
      try {
        const res = await fetch(`https://hexdb.io/api/v1/aircraft/${hex}`);
        if (res.ok) {
          const data = await res.json();
          setAircraftDetails(data);
        }
      } catch (err) {
        console.warn('Failed to fetch aircraft details from hexdb.io:', err);
      } finally {
        setAircraftDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedAircraft?.hex]);

  // Fetch flight route from FlightRadar24 (primary) or aviationstack (fallback)
  useEffect(() => {
    if (!selectedAircraft) {
      setFlightSchedule(null);
      return;
    }

    const callsign = selectedAircraft.callsign?.trim();
    const hex = selectedAircraft.hex;
    if (!callsign && !hex) return;

    setFlightScheduleLoading(true);
    setFlightSchedule(null);

    const fetchSchedule = async () => {
      // ICAO to IATA 변환 맵 (UBIKAIS 데이터용)
      const icaoToIata = {
        'RKSI': 'ICN', 'RKSS': 'GMP', 'RKPK': 'PUS', 'RKPC': 'CJU',
        'RKPU': 'USN', 'RKTN': 'TAE', 'RKTU': 'CJJ', 'RKJB': 'MWX',
        'RKNY': 'YNY', 'RKJY': 'RSU', 'RKPS': 'HIN', 'RKTH': 'KPO',
        'RJTT': 'HND', 'RJAA': 'NRT', 'RJBB': 'KIX', 'RJOO': 'ITM',
        'RJFF': 'FUK', 'RJCC': 'CTS', 'VHHH': 'HKG', 'RCTP': 'TPE',
        'WSSS': 'SIN', 'VTBS': 'BKK', 'WMKK': 'KUL', 'RPLL': 'MNL',
        'ZGGG': 'CAN', 'ZSPD': 'PVG', 'ZSSS': 'SHA', 'ZBAA': 'PEK',
        'VVTS': 'SGN', 'VVNB': 'HAN', 'VVCR': 'CXR', 'VVDN': 'DAD', 'VVPQ': 'PQC',
        'OMDB': 'DXB', 'OTHH': 'DOH', 'HAAB': 'ADD', 'LTFM': 'IST',
        'KLAX': 'LAX', 'KJFK': 'JFK', 'KORD': 'ORD', 'KCVG': 'CVG', 'PANC': 'ANC',
        'EDDF': 'FRA', 'EDDP': 'LEJ', 'EBBR': 'BRU', 'LIMC': 'MXP',
        'ZMCK': 'UBN', 'WBKK': 'BKI', 'ZSYT': 'YNT'
      };

      try {
        // 1차: 로컬 UBIKAIS 정적 JSON 파일 직접 검색 (API 없이 작동)
        const reg = selectedAircraft?.registration;
        try {
          const ubikaisRes = await fetch('/flight_schedule.json');
          if (ubikaisRes.ok) {
            const ubikaisData = await ubikaisRes.json();
            const departures = ubikaisData.departures || [];
            let matchedFlight = null;

            // callsign으로 검색
            if (callsign) {
              const normalizedCallsign = callsign.replace(/\s/g, '').toUpperCase();
              matchedFlight = departures.find(f => {
                const flightNum = f.flight_number?.replace(/\s/g, '').toUpperCase();
                return flightNum === normalizedCallsign ||
                       flightNum === normalizedCallsign.replace(/^([A-Z]+)0*/, '$1');
              });
            }

            // registration으로 검색
            if (!matchedFlight && reg) {
              const normalizedReg = reg.replace(/-/g, '').toUpperCase();
              matchedFlight = departures.find(f => {
                const flightReg = f.registration?.replace(/-/g, '').toUpperCase();
                return flightReg === normalizedReg;
              });
            }

            if (matchedFlight) {
              // 스케줄이 현재 비행과 일치하는지 검증
              // 착륙 시간(eta/sta)이 현재 시간보다 과거면 이미 완료된 비행 → 무시
              const isStaleSchedule = () => {
                const etaStr = matchedFlight.eta || matchedFlight.sta;
                if (!etaStr) return false;
                // "오후 02:26" 같은 형식 파싱
                const match = etaStr.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
                if (!match) return false;
                let hour = parseInt(match[2]);
                const minute = parseInt(match[3]);
                if (match[1] === '오후' && hour !== 12) hour += 12;
                if (match[1] === '오전' && hour === 12) hour = 0;

                const now = new Date();
                const eta = new Date();
                eta.setHours(hour, minute, 0, 0);

                // 날짜 정보가 없으므로 크로스-데이 처리 필요:
                // ETA가 현재보다 6시간 이상 미래면, 어제 스케줄로 간주하여 하루 전으로 조정
                const sixHours = 6 * 60 * 60 * 1000;
                if (eta - now > sixHours) {
                  eta.setDate(eta.getDate() - 1);
                }

                // 착륙 예정 시간이 현재보다 2시간 이상 과거면 stale
                return (now - eta) > 2 * 60 * 60 * 1000;
              };

              if (isStaleSchedule()) {
                console.log('UBIKAIS: Stale schedule detected (past ETA), skipping:', matchedFlight.flight_number);
                // stale 스케줄은 무시하고 다음 소스로 진행
              } else {
                const originIcao = matchedFlight.origin;
                const destIcao = matchedFlight.destination;
                setFlightSchedule({
                  flight: { iata: matchedFlight.flight_number, icao: callsign },
                  departure: originIcao ? {
                    iata: icaoToIata[originIcao] || originIcao,
                    icao: originIcao,
                    airport: AIRPORT_DATABASE[originIcao]?.name
                  } : null,
                  arrival: destIcao ? {
                    iata: icaoToIata[destIcao] || destIcao,
                    icao: destIcao,
                    airport: AIRPORT_DATABASE[destIcao]?.name
                  } : null,
                  flight_status: matchedFlight.status,
                  schedule: {
                    std: matchedFlight.std,
                    etd: matchedFlight.etd,
                    atd: matchedFlight.atd,
                    sta: matchedFlight.sta,
                    eta: matchedFlight.eta,
                    status: matchedFlight.status,
                    nature: matchedFlight.nature
                  },
                  aircraft_info: {
                    registration: matchedFlight.registration,
                    type: matchedFlight.aircraft_type
                  },
                  _source: 'ubikais',
                  _lastUpdated: ubikaisData.last_updated
                });
                setFlightScheduleLoading(false);
                console.log('UBIKAIS match found:', matchedFlight.flight_number);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('UBIKAIS static JSON search error:', e.message);
        }

        // 2차: UBIKAIS + FlightRadar24 통합 API로 출발/도착 정보 가져오기
        const params = new URLSearchParams();
        if (callsign) params.append('callsign', callsign);
        if (hex) params.append('hex', hex);
        if (reg) params.append('reg', reg);

        const fr24Res = await fetch(`/api/flight-route?${params}`);
        if (fr24Res.ok) {
          const routeData = await fr24Res.json();
          if (routeData?.origin?.iata || routeData?.destination?.iata) {
            // 스케줄이 현재 비행과 일치하는지 검증
            const isStaleSchedule = () => {
              const etaStr = routeData.schedule?.eta || routeData.schedule?.sta;
              if (!etaStr) return false;
              // "오후 02:26" 같은 형식 파싱
              const match = etaStr.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
              if (!match) return false;
              let hour = parseInt(match[2]);
              const minute = parseInt(match[3]);
              if (match[1] === '오후' && hour !== 12) hour += 12;
              if (match[1] === '오전' && hour === 12) hour = 0;

              const now = new Date();
              const eta = new Date();
              eta.setHours(hour, minute, 0, 0);

              // 날짜 정보가 없으므로 크로스-데이 처리 필요:
              // ETA가 현재보다 6시간 이상 미래면, 어제 스케줄로 간주하여 하루 전으로 조정
              const sixHours = 6 * 60 * 60 * 1000;
              if (eta - now > sixHours) {
                eta.setDate(eta.getDate() - 1);
              }

              // 착륙 예정 시간이 현재보다 2시간 이상 과거면 stale
              return (now - eta) > 2 * 60 * 60 * 1000;
            };

            // stale 스케줄이면 시간 정보만 제거하고 출발/도착 공항은 유지
            const scheduleData = isStaleSchedule() ? null : routeData.schedule;
            if (isStaleSchedule()) {
              console.log('FR24: Stale schedule detected (past ETA), removing time data');
            }

            // UBIKAIS 또는 FR24 데이터를 통합 형식으로 변환
            setFlightSchedule({
              flight: { iata: routeData.callsign, icao: callsign },
              departure: routeData.origin ? {
                iata: routeData.origin.iata,
                icao: routeData.origin.icao,
                airport: routeData.origin.name || AIRPORT_DATABASE[routeData.origin.icao]?.name
              } : null,
              arrival: routeData.destination ? {
                iata: routeData.destination.iata,
                icao: routeData.destination.icao,
                airport: routeData.destination.name || AIRPORT_DATABASE[routeData.destination.icao]?.name
              } : null,
              flight_status: isStaleSchedule() ? 'active' : (routeData.schedule?.status || routeData.status?.text || 'active'),
              // stale 스케줄이면 시간 정보 제거
              schedule: scheduleData,
              aircraft_info: routeData.aircraft,
              // FR24 항공기 사진 (fallback용)
              aircraft_images: routeData.aircraft?.images || [],
              _source: routeData.source,
              _lastUpdated: routeData.lastUpdated,
              _staleSchedule: isStaleSchedule()
            });
            setFlightScheduleLoading(false);
            return;
          }
        }

        // 3차: aviationstack API 백업 (FR24에서 못 찾으면)
        if (AVIATIONSTACK_API_KEY && callsign) {
          const icaoMatch = callsign.match(/^([A-Z]{3})(\d+)/);
          let flightNumber = callsign;

          if (icaoMatch) {
            const icaoCode = icaoMatch[1];
            const number = icaoMatch[2];
            const iataCode = ICAO_TO_IATA[icaoCode];
            if (iataCode) {
              flightNumber = iataCode + number;
            }
          }

          const avRes = await fetch(`/api/flight-schedule?flight=${flightNumber}`);
          if (avRes.ok) {
            const avData = await avRes.json();
            if (avData?.data?.length > 0) {
              setFlightSchedule({ ...avData.data[0], _source: 'aviationstack' });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch flight schedule:', err);
      } finally {
        setFlightScheduleLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedAircraft?.hex, selectedAircraft?.callsign, AVIATIONSTACK_API_KEY]);

  // Fetch flight track from OpenSky Trino (full history) or REST API (fallback)
  useEffect(() => {
    if (!selectedAircraft) {
      setFlightTrack(null);
      return;
    }

    const hex = selectedAircraft.hex?.toLowerCase();
    if (!hex) return;

    setFlightTrackLoading(true);
    setFlightTrack(null);

    const fetchTrack = async () => {
      try {
        // 1차: OpenSky Trino API (전체 비행 이력 - 이륙부터 착륙까지)
        // 5초 타임아웃 - 느리면 REST API로 폴백
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          console.log(`[FlightTrack] Fetching Trino data for ${hex}...`);
          const trinoRes = await fetch(`/api/opensky-history?icao24=${hex}&hours=24`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (trinoRes.ok) {
            const trinoData = await trinoRes.json();
            console.log(`[FlightTrack] Trino response:`, trinoData);
            if (trinoData.path && trinoData.path.length > 0) {
              console.log(`[FlightTrack] ✅ Trino: ${trinoData.path.length} points (sampled from ${trinoData.totalPoints})`);
              // Log first and last timestamps for debugging
              const firstPt = trinoData.path[0];
              const lastPt = trinoData.path[trinoData.path.length - 1];
              console.log(`[FlightTrack] Time range: ${new Date(firstPt.time * 1000).toLocaleString()} ~ ${new Date(lastPt.time * 1000).toLocaleString()}`);
              setFlightTrack({
                icao24: trinoData.icao24,
                callsign: trinoData.path[0]?.callsign,
                startTime: trinoData.startTime,
                endTime: trinoData.endTime,
                path: trinoData.path,
                source: 'trino'
              });
              setFlightTrackLoading(false);
              return;
            } else {
              console.warn(`[FlightTrack] Trino returned empty path, error: ${trinoData.error || 'none'}`);
            }
          } else {
            const errText = await trinoRes.text();
            console.warn(`[FlightTrack] Trino API error ${trinoRes.status}: ${errText}`);
          }
        } catch (trinoErr) {
          if (trinoErr.name === 'AbortError') {
            console.warn('[FlightTrack] Trino API timeout (5s), falling back to REST API');
          } else {
            console.warn('[FlightTrack] Trino API failed:', trinoErr.message);
          }
        }

        // 2차: OpenSky REST tracks API (제한된 데이터)
        console.log(`[FlightTrack] Falling back to OpenSky REST API for ${hex}...`);
        const res = await fetch(
          `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`
        );
        if (res.ok) {
          const data = await res.json();
          console.log(`[FlightTrack] OpenSky REST response:`, data);
          if (data && data.path && data.path.length > 0) {
            // path 배열을 그래프용 데이터로 변환
            const trackData = data.path.map(p => ({
              time: p[0],
              lat: p[1],
              lon: p[2],
              altitude_ft: p[3] ? Math.round(p[3] * 3.28084) : 0, // meters to feet
              track: p[4],
              on_ground: p[5]
            }));
            console.log(`[FlightTrack] ✅ REST: ${trackData.length} points`);
            console.log(`[FlightTrack] Time range: ${new Date(trackData[0].time * 1000).toLocaleString()} ~ ${new Date(trackData[trackData.length-1].time * 1000).toLocaleString()}`);
            setFlightTrack({
              icao24: data.icao24,
              callsign: data.callsign,
              startTime: data.startTime,
              endTime: data.endTime,
              path: trackData,
              source: 'rest'
            });
          }
        } else {
          console.warn(`[FlightTrack] OpenSky REST API error ${res.status}`);
        }
      } catch (err) {
        console.warn('Failed to fetch flight track from OpenSky:', err);
      } finally {
        setFlightTrackLoading(false);
      }
    };

    fetchTrack();
  }, [selectedAircraft?.hex]);

  return {
    aircraftPhoto,
    aircraftPhotoLoading,
    aircraftDetails,
    aircraftDetailsLoading,
    flightSchedule,
    flightScheduleLoading,
    flightTrack,
    flightTrackLoading,
    showAircraftPanel,
    setShowAircraftPanel
  };
}
