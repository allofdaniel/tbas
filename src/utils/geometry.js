/**
 * Geometry Utility Functions
 * 기하학 관련 유틸리티 함수 모음
 */

/**
 * 피트를 미터로 변환
 * @param {number} ft - 피트 값
 * @returns {number} 미터 값
 */
export const ftToM = (ft) => ft * 0.3048;

/**
 * 미터를 피트로 변환
 * @param {number} m - 미터 값
 * @returns {number} 피트 값
 */
export const mToFt = (m) => m / 0.3048;

/**
 * 해리를 미터로 변환
 * @param {number} nm - 해리 값
 * @returns {number} 미터 값
 */
export const nmToM = (nm) => nm * 1852;

/**
 * 미터를 해리로 변환
 * @param {number} m - 미터 값
 * @returns {number} 해리 값
 */
export const mToNm = (m) => m / 1852;

/**
 * 원형 폴리곤 좌표 생성
 * @param {number} lon - 중심 경도
 * @param {number} lat - 중심 위도
 * @param {number} radiusMeters - 반경 (미터)
 * @param {number} numPoints - 점 개수 (기본 64)
 * @returns {Array<Array<number>>} 좌표 배열 [[lon, lat], ...]
 */
export const createCirclePolygon = (lon, lat, radiusMeters, numPoints = 64) => {
  const coords = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const newLon = lon + (dx / 111320) / Math.cos(lat * Math.PI / 180);
    const newLat = lat + (dy / 110540);
    coords.push([newLon, newLat]);
  }
  return coords;
};

/**
 * 장애물 형상 좌표 생성
 * @param {Object} obstacle - 장애물 객체
 * @returns {Array<Array<number>>} 좌표 배열
 */
export const createObstacleShape = (obstacle) => {
  const lon = obstacle.lon;
  const lat = obstacle.lat;
  const size = 0.001; // 약 100m 크기

  // 삼각형 형태로 표시 (탑, 안테나 등)
  if (['Tower', 'Antenna', 'Mast', 'Chimney'].includes(obstacle.type)) {
    return [
      [lon, lat + size],
      [lon - size * 0.866, lat - size * 0.5],
      [lon + size * 0.866, lat - size * 0.5],
      [lon, lat + size]
    ];
  }

  // 사각형 형태 (건물)
  if (['Building', 'Structure'].includes(obstacle.type)) {
    return [
      [lon - size, lat - size],
      [lon + size, lat - size],
      [lon + size, lat + size],
      [lon - size, lat + size],
      [lon - size, lat - size]
    ];
  }

  // 기본: 원형
  return createCirclePolygon(lon, lat, 100, 8);
};

/**
 * 리본 세그먼트 생성 (절차 경로용)
 * @param {Array<number>} start - 시작점 [lon, lat]
 * @param {Array<number>} end - 끝점 [lon, lat]
 * @param {number} width - 리본 너비 (도 단위)
 * @returns {Array<Array<number>>} 리본 좌표 배열
 */
export const createRibbonSegment = (start, end, width = 0.002) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  // 수직 방향 벡터
  const nx = -dy / len * width;
  const ny = dx / len * width;

  return [
    [start[0] + nx, start[1] + ny],
    [end[0] + nx, end[1] + ny],
    [end[0] - nx, end[1] - ny],
    [start[0] - nx, start[1] - ny],
    [start[0] + nx, start[1] + ny]
  ];
};

/**
 * 두 좌표 사이의 거리 계산 (Haversine)
 * @param {number} lat1 - 시작 위도
 * @param {number} lon1 - 시작 경도
 * @param {number} lat2 - 끝 위도
 * @param {number} lon2 - 끝 경도
 * @returns {number} 거리 (미터)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // 지구 반경 (미터)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 두 좌표 사이의 방위각 계산
 * @param {number} lat1 - 시작 위도
 * @param {number} lon1 - 시작 경도
 * @param {number} lat2 - 끝 위도
 * @param {number} lon2 - 끝 경도
 * @returns {number} 방위각 (도)
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * 점이 다각형 내부에 있는지 확인
 * @param {Array<number>} point - 점 [lon, lat]
 * @param {Array<Array<number>>} polygon - 다각형 좌표 배열
 * @returns {boolean}
 */
export const isPointInPolygon = (point, polygon) => {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
};
