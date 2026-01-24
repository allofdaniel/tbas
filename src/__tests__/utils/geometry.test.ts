/**
 * Geometry Utility Tests
 * DO-278A 요구사항 추적: SRS-TEST-002
 */

import { describe, it, expect } from 'vitest';
import {
  ftToM,
  mToFt,
  nmToM,
  mToNm,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  isValidAltitude,
  createCirclePolygon,
  createObstacleShape,
  createRibbonSegment,
  calculateDistance,
  calculateBearing,
  isPointInPolygon,
} from '../../utils/geometry';

describe('Unit Conversion Functions', () => {
  describe('ftToM (feet to meters)', () => {
    it('should convert 0 feet to 0 meters', () => {
      expect(ftToM(0)).toBe(0);
    });

    it('should convert 1 foot to 0.3048 meters', () => {
      expect(ftToM(1)).toBeCloseTo(0.3048, 4);
    });

    it('should convert 1000 feet to 304.8 meters', () => {
      expect(ftToM(1000)).toBeCloseTo(304.8, 1);
    });

    it('should convert negative feet to negative meters', () => {
      expect(ftToM(-100)).toBeCloseTo(-30.48, 2);
    });

    it('should convert typical cruise altitude (35000 ft)', () => {
      expect(ftToM(35000)).toBeCloseTo(10668, 0);
    });
  });

  describe('mToFt (meters to feet)', () => {
    it('should convert 0 meters to 0 feet', () => {
      expect(mToFt(0)).toBe(0);
    });

    it('should convert 1 meter to approximately 3.28 feet', () => {
      expect(mToFt(1)).toBeCloseTo(3.28084, 4);
    });

    it('should be inverse of ftToM', () => {
      const original = 10000;
      expect(mToFt(ftToM(original))).toBeCloseTo(original, 5);
    });
  });

  describe('nmToM (nautical miles to meters)', () => {
    it('should convert 1 NM to 1852 meters', () => {
      expect(nmToM(1)).toBe(1852);
    });

    it('should convert 100 NM correctly', () => {
      expect(nmToM(100)).toBe(185200);
    });
  });

  describe('mToNm (meters to nautical miles)', () => {
    it('should convert 1852 meters to 1 NM', () => {
      expect(mToNm(1852)).toBeCloseTo(1, 5);
    });

    it('should be inverse of nmToM', () => {
      const original = 50;
      expect(mToNm(nmToM(original))).toBeCloseTo(original, 5);
    });
  });
});

describe('Validation Functions', () => {
  describe('isValidLatitude', () => {
    it('should accept valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45)).toBe(true);
      expect(isValidLatitude(-45)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should reject invalid latitudes', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(180)).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(isValidLatitude('45')).toBe(false);
      expect(isValidLatitude(null)).toBe(false);
      expect(isValidLatitude(undefined)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should accept valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(90)).toBe(true);
      expect(isValidLongitude(-90)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should reject invalid longitudes', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(isValidLongitude('90')).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
    });
  });

  describe('isValidCoordinate', () => {
    it('should accept valid coordinates', () => {
      expect(isValidCoordinate(35.5934, 129.3518)).toBe(true); // RKPK
      expect(isValidCoordinate(0, 0)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(null, null)).toBe(false);
    });
  });

  describe('isValidAltitude', () => {
    it('should accept valid altitudes', () => {
      expect(isValidAltitude(0)).toBe(true);
      expect(isValidAltitude(35000)).toBe(true);
      expect(isValidAltitude(-1000)).toBe(true); // Below sea level
      expect(isValidAltitude(60000)).toBe(true); // High altitude
    });

    it('should reject invalid altitudes', () => {
      expect(isValidAltitude(-3000)).toBe(false);
      expect(isValidAltitude(150000)).toBe(false);
      expect(isValidAltitude(NaN)).toBe(false);
    });
  });
});

describe('Geometry Creation Functions', () => {
  describe('createCirclePolygon', () => {
    it('should create a closed polygon', () => {
      const polygon = createCirclePolygon(129.3518, 35.5934, 1000, 8);
      expect(polygon.length).toBe(9); // 8 points + closing point
      expect(polygon[0]).toEqual(polygon[polygon.length - 1]);
    });

    it('should create polygon centered on given coordinates', () => {
      const lon = 129.3518;
      const lat = 35.5934;
      const polygon = createCirclePolygon(lon, lat, 1000, 64);

      // All points should be roughly equidistant from center
      const distances = polygon.map(([pLon, pLat]) =>
        Math.sqrt((pLon - lon) ** 2 + (pLat - lat) ** 2)
      );
      const maxDist = Math.max(...distances);
      const minDist = Math.min(...distances);

      // Distances should be similar (not exact due to lat/lon projection)
      expect(maxDist / minDist).toBeLessThan(1.5);
    });
  });

  describe('createObstacleShape', () => {
    it('should create triangle for tower type', () => {
      const obstacle = { lon: 129.0, lat: 35.0, type: 'Tower' };
      const shape = createObstacleShape(obstacle);
      expect(shape.length).toBe(4); // 3 points + closing
    });

    it('should create rectangle for building type', () => {
      const obstacle = { lon: 129.0, lat: 35.0, type: 'Building' };
      const shape = createObstacleShape(obstacle);
      expect(shape.length).toBe(5); // 4 points + closing
    });

    it('should create circle for unknown type', () => {
      const obstacle = { lon: 129.0, lat: 35.0, type: 'Unknown' };
      const shape = createObstacleShape(obstacle);
      expect(shape.length).toBeGreaterThan(4); // Circle has more points
    });
  });

  describe('createRibbonSegment', () => {
    it('should create a ribbon segment between two points', () => {
      const start: [number, number, number?] = [129.0, 35.0, 1000];
      const end: [number, number, number?] = [129.1, 35.1, 2000];
      const segment = createRibbonSegment(start, end);

      expect(segment).not.toBeNull();
      expect(segment?.coordinates).toHaveLength(1);
      expect(segment?.coordinates[0]).toHaveLength(5); // Rectangle + closing
      expect(segment?.avgAlt).toBe(1500);
    });

    it('should return null for zero-length segment', () => {
      const point: [number, number, number?] = [129.0, 35.0, 1000];
      const segment = createRibbonSegment(point, point);
      expect(segment).toBeNull();
    });

    it('should handle missing altitude', () => {
      const start: [number, number] = [129.0, 35.0];
      const end: [number, number] = [129.1, 35.1];
      const segment = createRibbonSegment(start, end);

      expect(segment?.avgAlt).toBe(0);
    });
  });
});

describe('Distance and Bearing Calculations', () => {
  describe('calculateDistance (Haversine)', () => {
    it('should return 0 for same point', () => {
      expect(calculateDistance(35.5934, 129.3518, 35.5934, 129.3518)).toBe(0);
    });

    it('should calculate reasonable distance between airports', () => {
      // RKPK (Gimhae) to RKSS (Gimpo) - approximately 300km
      const distance = calculateDistance(35.1795, 128.9383, 37.5587, 126.7906);
      expect(distance).toBeGreaterThan(290000);
      expect(distance).toBeLessThan(330000);
    });

    it('should handle antipodal points', () => {
      const distance = calculateDistance(0, 0, 0, 180);
      // Half Earth circumference ≈ 20,000 km
      expect(distance).toBeGreaterThan(19000000);
      expect(distance).toBeLessThan(21000000);
    });
  });

  describe('calculateBearing', () => {
    it('should return 0 for due north', () => {
      const bearing = calculateBearing(35.0, 129.0, 36.0, 129.0);
      expect(bearing).toBeCloseTo(0, 0);
    });

    it('should return 90 for due east', () => {
      const bearing = calculateBearing(35.0, 129.0, 35.0, 130.0);
      expect(bearing).toBeCloseTo(90, 0);
    });

    it('should return 180 for due south', () => {
      const bearing = calculateBearing(36.0, 129.0, 35.0, 129.0);
      expect(bearing).toBeCloseTo(180, 0);
    });

    it('should return 270 for due west', () => {
      const bearing = calculateBearing(35.0, 130.0, 35.0, 129.0);
      expect(bearing).toBeCloseTo(270, 0);
    });

    it('should always return value between 0 and 360', () => {
      const bearing = calculateBearing(35.0, 129.0, 34.0, 128.0);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });
});

describe('Point in Polygon', () => {
  const square: [number, number][] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];

  it('should detect point inside polygon', () => {
    expect(isPointInPolygon([1, 1], square)).toBe(true);
    expect(isPointInPolygon([0.5, 0.5], square)).toBe(true);
  });

  it('should detect point outside polygon', () => {
    expect(isPointInPolygon([3, 1], square)).toBe(false);
    expect(isPointInPolygon([-1, 1], square)).toBe(false);
    expect(isPointInPolygon([1, 3], square)).toBe(false);
  });

  it('should work with complex polygon', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [4, 0],
      [2, 4],
      [0, 0],
    ];
    expect(isPointInPolygon([2, 1], triangle)).toBe(true);
    expect(isPointInPolygon([0.5, 3], triangle)).toBe(false);
  });
});
