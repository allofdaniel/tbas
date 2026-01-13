#!/usr/bin/env python3
"""
UBIKAIS 데이터베이스 관리
NOTAM, AERO-DATA 등을 SQLite DB로 저장

작성일: 2026-01-11
"""

import sqlite3
import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class UBIKAISDatabase:
    """UBIKAIS 데이터 SQLite 저장소"""

    def __init__(self, db_path: str = "./data/ubikais.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = None
        self._init_database()

    def _init_database(self):
        """데이터베이스 초기화"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
        logger.info(f"데이터베이스 초기화 완료: {self.db_path}")

    def _create_tables(self):
        """테이블 생성"""
        cursor = self.conn.cursor()

        # ==================== NOTAM 테이블 ====================

        # RK NOTAM (FIR NOTAM)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notam_fir (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notam_id TEXT UNIQUE,
                series TEXT,
                number TEXT,
                year TEXT,
                type TEXT,
                fir TEXT,
                q_code TEXT,
                traffic TEXT,
                purpose TEXT,
                scope TEXT,
                lower_limit TEXT,
                upper_limit TEXT,
                coordinates TEXT,
                radius TEXT,
                location TEXT,
                valid_from TEXT,
                valid_to TEXT,
                schedule TEXT,
                full_text TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # AD NOTAM (공항별)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notam_ad (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notam_id TEXT,
                airport_icao TEXT,
                series TEXT,
                number TEXT,
                year TEXT,
                type TEXT,
                q_code TEXT,
                traffic TEXT,
                purpose TEXT,
                scope TEXT,
                lower_limit TEXT,
                upper_limit TEXT,
                coordinates TEXT,
                radius TEXT,
                valid_from TEXT,
                valid_to TEXT,
                schedule TEXT,
                full_text TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(notam_id, airport_icao)
            )
        ''')

        # SNOWTAM
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS snowtam (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snowtam_id TEXT UNIQUE,
                airport_icao TEXT,
                observation_time TEXT,
                runway TEXT,
                deposit_type TEXT,
                extent TEXT,
                depth TEXT,
                friction TEXT,
                contamination TEXT,
                full_text TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # PROHIBITED AREA
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS prohibited_area (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notam_id TEXT UNIQUE,
                area_name TEXT,
                area_type TEXT,
                coordinates TEXT,
                lower_limit TEXT,
                upper_limit TEXT,
                valid_from TEXT,
                valid_to TEXT,
                remarks TEXT,
                full_text TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # ==================== AERO-DATA 테이블 ====================

        # 공항 데이터
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS airports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                icao_code TEXT UNIQUE,
                iata_code TEXT,
                name TEXT,
                name_korean TEXT,
                city TEXT,
                usage_type TEXT,
                magnetic_variation TEXT,
                magnetic_variation_year TEXT,
                elevation_m REAL,
                elevation_ft REAL,
                geoid_undulation REAL,
                latitude TEXT,
                longitude TEXT,
                latitude_decimal REAL,
                longitude_decimal REAL,
                tower_elevation_m REAL,
                verification_date TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 활주로 데이터
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS runways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                airport_icao TEXT,
                runway_id TEXT,
                direction TEXT,
                length_m REAL,
                width_m REAL,
                surface TEXT,
                strength TEXT,
                threshold_latitude TEXT,
                threshold_longitude TEXT,
                threshold_elevation_m REAL,
                displaced_threshold_m REAL,
                stopway_m REAL,
                clearway_m REAL,
                tora_m REAL,
                toda_m REAL,
                asda_m REAL,
                lda_m REAL,
                slope_percent REAL,
                lighting TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(airport_icao, runway_id, direction)
            )
        ''')

        # 주기장 데이터
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS aprons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                airport_icao TEXT,
                apron_name TEXT,
                apron_type TEXT,
                surface TEXT,
                strength TEXT,
                area_sqm REAL,
                max_aircraft_size TEXT,
                stands_count INTEGER,
                latitude TEXT,
                longitude TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(airport_icao, apron_name)
            )
        ''')

        # NAVaid 데이터
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS navaids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                navaid_id TEXT UNIQUE,
                navaid_type TEXT,
                name TEXT,
                frequency TEXT,
                channel TEXT,
                latitude TEXT,
                longitude TEXT,
                latitude_decimal REAL,
                longitude_decimal REAL,
                elevation_m REAL,
                magnetic_variation TEXT,
                range_nm REAL,
                airport_icao TEXT,
                remarks TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 장애물 데이터
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS obstacles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                obstacle_id TEXT UNIQUE,
                obstacle_type TEXT,
                name TEXT,
                latitude TEXT,
                longitude TEXT,
                latitude_decimal REAL,
                longitude_decimal REAL,
                elevation_m REAL,
                height_m REAL,
                lighting TEXT,
                marking TEXT,
                airport_icao TEXT,
                area_affected TEXT,
                remarks TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # ==================== 비행계획 테이블 ====================

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flight_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign TEXT,
                flight_number TEXT,
                aircraft_type TEXT,
                registration TEXT,
                departure_icao TEXT,
                arrival_icao TEXT,
                alternate_icao TEXT,
                departure_time TEXT,
                arrival_time TEXT,
                eobt TEXT,
                atd TEXT,
                eta TEXT,
                ata TEXT,
                flight_rules TEXT,
                flight_type TEXT,
                route TEXT,
                cruise_altitude TEXT,
                cruise_speed TEXT,
                endurance TEXT,
                persons_on_board INTEGER,
                remarks TEXT,
                status TEXT,
                direction TEXT,
                crawled_date TEXT,
                raw_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(callsign, departure_time, crawled_date)
            )
        ''')

        # ==================== 기상 테이블 ====================

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                airport_icao TEXT,
                observation_time TEXT,
                raw_metar TEXT,
                wind_direction INTEGER,
                wind_speed INTEGER,
                wind_gust INTEGER,
                visibility_m INTEGER,
                weather TEXT,
                clouds TEXT,
                temperature INTEGER,
                dewpoint INTEGER,
                pressure_hpa INTEGER,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(airport_icao, observation_time)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS taf (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                airport_icao TEXT,
                issue_time TEXT,
                valid_from TEXT,
                valid_to TEXT,
                raw_taf TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(airport_icao, issue_time)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sigmet (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sigmet_id TEXT UNIQUE,
                fir TEXT,
                phenomenon TEXT,
                valid_from TEXT,
                valid_to TEXT,
                area TEXT,
                level TEXT,
                movement TEXT,
                intensity TEXT,
                raw_sigmet TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 인덱스 생성
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notam_fir_valid FROM notam_fir(valid_from)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notam_ad_airport ON notam_ad(airport_icao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_runways_airport ON runways(airport_icao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_navaids_airport ON navaids(airport_icao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_flight_plans_date ON flight_plans(crawled_date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_metar_airport ON metar(airport_icao)')

        self.conn.commit()
        logger.info("테이블 생성 완료")

    # ==================== NOTAM 저장 ====================

    def save_notam_fir(self, notam_list: List[Dict]) -> int:
        """FIR NOTAM 저장"""
        if not notam_list:
            return 0

        cursor = self.conn.cursor()
        count = 0

        for notam in notam_list:
            try:
                # UBIKAIS 응답 구조에 따라 파싱
                notam_id = notam.get('notamId') or notam.get('notamNo') or notam.get('id')
                if not notam_id:
                    continue

                cursor.execute('''
                    INSERT OR REPLACE INTO notam_fir
                    (notam_id, series, number, year, type, fir, q_code, traffic, purpose, scope,
                     lower_limit, upper_limit, coordinates, radius, location, valid_from, valid_to,
                     schedule, full_text, raw_data, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    notam_id,
                    notam.get('series'),
                    notam.get('number'),
                    notam.get('year'),
                    notam.get('type') or notam.get('notamType'),
                    notam.get('fir') or 'RKRR',
                    notam.get('qCode'),
                    notam.get('traffic'),
                    notam.get('purpose'),
                    notam.get('scope'),
                    notam.get('lowerLimit') or notam.get('flLower'),
                    notam.get('upperLimit') or notam.get('flUpper'),
                    notam.get('coordinates') or notam.get('coord'),
                    notam.get('radius'),
                    notam.get('location') or notam.get('ad'),
                    notam.get('validFrom') or notam.get('fromDt'),
                    notam.get('validTo') or notam.get('toDt'),
                    notam.get('schedule'),
                    notam.get('fullText') or notam.get('notamText') or notam.get('eText'),
                    json.dumps(notam, ensure_ascii=False),
                    datetime.now().isoformat()
                ))
                count += 1
            except Exception as e:
                logger.warning(f"NOTAM FIR 저장 오류: {e}")

        self.conn.commit()
        logger.info(f"FIR NOTAM {count}건 저장")
        return count

    def save_notam_ad(self, notam_list: List[Dict], airport_icao: str = None) -> int:
        """AD NOTAM 저장"""
        if not notam_list:
            return 0

        cursor = self.conn.cursor()
        count = 0

        for notam in notam_list:
            try:
                notam_id = notam.get('notamId') or notam.get('notamNo') or notam.get('id')
                icao = airport_icao or notam.get('ad') or notam.get('airport')
                if not notam_id:
                    continue

                cursor.execute('''
                    INSERT OR REPLACE INTO notam_ad
                    (notam_id, airport_icao, series, number, year, type, q_code, traffic,
                     purpose, scope, lower_limit, upper_limit, coordinates, radius,
                     valid_from, valid_to, schedule, full_text, raw_data, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    notam_id,
                    icao,
                    notam.get('series'),
                    notam.get('number'),
                    notam.get('year'),
                    notam.get('type') or notam.get('notamType'),
                    notam.get('qCode'),
                    notam.get('traffic'),
                    notam.get('purpose'),
                    notam.get('scope'),
                    notam.get('lowerLimit') or notam.get('flLower'),
                    notam.get('upperLimit') or notam.get('flUpper'),
                    notam.get('coordinates') or notam.get('coord'),
                    notam.get('radius'),
                    notam.get('validFrom') or notam.get('fromDt'),
                    notam.get('validTo') or notam.get('toDt'),
                    notam.get('schedule'),
                    notam.get('fullText') or notam.get('notamText') or notam.get('eText'),
                    json.dumps(notam, ensure_ascii=False),
                    datetime.now().isoformat()
                ))
                count += 1
            except Exception as e:
                logger.warning(f"AD NOTAM 저장 오류: {e}")

        self.conn.commit()
        logger.info(f"AD NOTAM {count}건 저장")
        return count

    def save_snowtam(self, snowtam_list: List[Dict]) -> int:
        """SNOWTAM 저장"""
        if not snowtam_list:
            return 0

        cursor = self.conn.cursor()
        count = 0

        for snowtam in snowtam_list:
            try:
                snowtam_id = snowtam.get('snowtamId') or snowtam.get('id')
                if not snowtam_id:
                    continue

                cursor.execute('''
                    INSERT OR REPLACE INTO snowtam
                    (snowtam_id, airport_icao, observation_time, runway, deposit_type,
                     extent, depth, friction, contamination, full_text, raw_data, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snowtam_id,
                    snowtam.get('ad') or snowtam.get('airport'),
                    snowtam.get('obsTime'),
                    snowtam.get('runway'),
                    snowtam.get('depositType'),
                    snowtam.get('extent'),
                    snowtam.get('depth'),
                    snowtam.get('friction'),
                    snowtam.get('contamination'),
                    snowtam.get('fullText') or snowtam.get('snowtamText'),
                    json.dumps(snowtam, ensure_ascii=False),
                    datetime.now().isoformat()
                ))
                count += 1
            except Exception as e:
                logger.warning(f"SNOWTAM 저장 오류: {e}")

        self.conn.commit()
        logger.info(f"SNOWTAM {count}건 저장")
        return count

    # ==================== AERO-DATA 저장 ====================

    def save_airport(self, airport_data: Dict) -> bool:
        """공항 데이터 저장"""
        cursor = self.conn.cursor()

        try:
            # 좌표 변환
            lat_str = airport_data.get('latitude') or airport_data.get('lat')
            lon_str = airport_data.get('longitude') or airport_data.get('lon')
            lat_dec = self._parse_coordinate(lat_str)
            lon_dec = self._parse_coordinate(lon_str)

            cursor.execute('''
                INSERT OR REPLACE INTO airports
                (icao_code, iata_code, name, name_korean, city, usage_type,
                 magnetic_variation, magnetic_variation_year, elevation_m, elevation_ft,
                 geoid_undulation, latitude, longitude, latitude_decimal, longitude_decimal,
                 tower_elevation_m, verification_date, raw_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                airport_data.get('icao') or airport_data.get('icaoCode'),
                airport_data.get('iata'),
                airport_data.get('name') or airport_data.get('apName'),
                airport_data.get('nameKo'),
                airport_data.get('city') or airport_data.get('cityName'),
                airport_data.get('usage') or airport_data.get('usageType'),
                airport_data.get('magVar') or airport_data.get('magneticVariation'),
                airport_data.get('magVarYear'),
                airport_data.get('elevation') or airport_data.get('elevM'),
                airport_data.get('elevationFt'),
                airport_data.get('geoidUndulation'),
                lat_str,
                lon_str,
                lat_dec,
                lon_dec,
                airport_data.get('towerElev'),
                airport_data.get('verificationDate') or airport_data.get('verDt'),
                json.dumps(airport_data, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"공항 데이터 저장 오류: {e}")
            return False

    def save_runway(self, runway_data: Dict, airport_icao: str) -> bool:
        """활주로 데이터 저장"""
        cursor = self.conn.cursor()

        try:
            cursor.execute('''
                INSERT OR REPLACE INTO runways
                (airport_icao, runway_id, direction, length_m, width_m, surface, strength,
                 threshold_latitude, threshold_longitude, threshold_elevation_m,
                 displaced_threshold_m, stopway_m, clearway_m, tora_m, toda_m, asda_m, lda_m,
                 slope_percent, lighting, raw_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                airport_icao,
                runway_data.get('rwyId') or runway_data.get('runwayId'),
                runway_data.get('direction') or runway_data.get('rwyDir'),
                runway_data.get('length') or runway_data.get('lengthM'),
                runway_data.get('width') or runway_data.get('widthM'),
                runway_data.get('surface') or runway_data.get('surfaceType'),
                runway_data.get('strength') or runway_data.get('pcn'),
                runway_data.get('thrLat'),
                runway_data.get('thrLon'),
                runway_data.get('thrElev'),
                runway_data.get('displacedThr'),
                runway_data.get('stopway'),
                runway_data.get('clearway'),
                runway_data.get('tora'),
                runway_data.get('toda'),
                runway_data.get('asda'),
                runway_data.get('lda'),
                runway_data.get('slope'),
                runway_data.get('lighting'),
                json.dumps(runway_data, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"활주로 데이터 저장 오류: {e}")
            return False

    def save_navaid(self, navaid_data: Dict) -> bool:
        """NAVaid 데이터 저장"""
        cursor = self.conn.cursor()

        try:
            lat_str = navaid_data.get('latitude') or navaid_data.get('lat')
            lon_str = navaid_data.get('longitude') or navaid_data.get('lon')

            cursor.execute('''
                INSERT OR REPLACE INTO navaids
                (navaid_id, navaid_type, name, frequency, channel, latitude, longitude,
                 latitude_decimal, longitude_decimal, elevation_m, magnetic_variation,
                 range_nm, airport_icao, remarks, raw_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                navaid_data.get('navaidId') or navaid_data.get('id'),
                navaid_data.get('type') or navaid_data.get('navaidType'),
                navaid_data.get('name'),
                navaid_data.get('frequency') or navaid_data.get('freq'),
                navaid_data.get('channel'),
                lat_str,
                lon_str,
                self._parse_coordinate(lat_str),
                self._parse_coordinate(lon_str),
                navaid_data.get('elevation') or navaid_data.get('elev'),
                navaid_data.get('magVar'),
                navaid_data.get('range'),
                navaid_data.get('airport') or navaid_data.get('ad'),
                navaid_data.get('remarks'),
                json.dumps(navaid_data, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"NAVaid 데이터 저장 오류: {e}")
            return False

    def save_obstacle(self, obstacle_data: Dict) -> bool:
        """장애물 데이터 저장"""
        cursor = self.conn.cursor()

        try:
            lat_str = obstacle_data.get('latitude') or obstacle_data.get('lat')
            lon_str = obstacle_data.get('longitude') or obstacle_data.get('lon')

            cursor.execute('''
                INSERT OR REPLACE INTO obstacles
                (obstacle_id, obstacle_type, name, latitude, longitude,
                 latitude_decimal, longitude_decimal, elevation_m, height_m,
                 lighting, marking, airport_icao, area_affected, remarks, raw_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                obstacle_data.get('obstId') or obstacle_data.get('id'),
                obstacle_data.get('type') or obstacle_data.get('obstType'),
                obstacle_data.get('name'),
                lat_str,
                lon_str,
                self._parse_coordinate(lat_str),
                self._parse_coordinate(lon_str),
                obstacle_data.get('elevation') or obstacle_data.get('elev'),
                obstacle_data.get('height'),
                obstacle_data.get('lighting'),
                obstacle_data.get('marking'),
                obstacle_data.get('airport') or obstacle_data.get('ad'),
                obstacle_data.get('areaAffected'),
                obstacle_data.get('remarks'),
                json.dumps(obstacle_data, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"장애물 데이터 저장 오류: {e}")
            return False

    # ==================== 비행계획 저장 ====================

    def save_flight_plan(self, fpl_data: Dict, direction: str = "DEP") -> bool:
        """비행계획 저장"""
        cursor = self.conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")

        try:
            callsign = fpl_data.get('callsign') or fpl_data.get('acid') or fpl_data.get('fltNo')
            dep_time = fpl_data.get('eobt') or fpl_data.get('std') or fpl_data.get('depTime')

            cursor.execute('''
                INSERT OR REPLACE INTO flight_plans
                (callsign, flight_number, aircraft_type, registration, departure_icao,
                 arrival_icao, alternate_icao, departure_time, arrival_time, eobt, atd,
                 eta, ata, flight_rules, flight_type, route, cruise_altitude, cruise_speed,
                 endurance, persons_on_board, remarks, status, direction, crawled_date,
                 raw_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                callsign,
                fpl_data.get('flightNumber') or fpl_data.get('fltNo'),
                fpl_data.get('aircraftType') or fpl_data.get('acType'),
                fpl_data.get('registration') or fpl_data.get('reg'),
                fpl_data.get('departure') or fpl_data.get('depAd') or fpl_data.get('adep'),
                fpl_data.get('arrival') or fpl_data.get('arrAd') or fpl_data.get('ades'),
                fpl_data.get('alternate') or fpl_data.get('altnAd'),
                dep_time,
                fpl_data.get('sta') or fpl_data.get('arrTime'),
                fpl_data.get('eobt'),
                fpl_data.get('atd'),
                fpl_data.get('eta'),
                fpl_data.get('ata'),
                fpl_data.get('flightRules') or fpl_data.get('fltRules'),
                fpl_data.get('flightType') or fpl_data.get('fltType'),
                fpl_data.get('route'),
                fpl_data.get('cruiseAlt') or fpl_data.get('rfl'),
                fpl_data.get('cruiseSpeed') or fpl_data.get('speed'),
                fpl_data.get('endurance') or fpl_data.get('eet'),
                fpl_data.get('pob'),
                fpl_data.get('remarks') or fpl_data.get('rmk'),
                fpl_data.get('status'),
                direction,
                today,
                json.dumps(fpl_data, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"비행계획 저장 오류: {e}")
            return False

    # ==================== 기상 저장 ====================

    def save_metar(self, metar_data: Dict) -> bool:
        """METAR 저장"""
        cursor = self.conn.cursor()

        try:
            cursor.execute('''
                INSERT OR REPLACE INTO metar
                (airport_icao, observation_time, raw_metar, wind_direction, wind_speed,
                 wind_gust, visibility_m, weather, clouds, temperature, dewpoint,
                 pressure_hpa, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metar_data.get('airport') or metar_data.get('ad'),
                metar_data.get('obsTime') or metar_data.get('time'),
                metar_data.get('rawMetar') or metar_data.get('metar') or metar_data.get('orgMsg'),
                metar_data.get('windDir'),
                metar_data.get('windSpeed') or metar_data.get('ws'),
                metar_data.get('windGust'),
                metar_data.get('visibility') or metar_data.get('vis'),
                metar_data.get('weather'),
                metar_data.get('clouds'),
                metar_data.get('temperature') or metar_data.get('temp'),
                metar_data.get('dewpoint') or metar_data.get('dp'),
                metar_data.get('pressure') or metar_data.get('qnh'),
                metar_data.get('remarks')
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.warning(f"METAR 저장 오류: {e}")
            return False

    # ==================== 유틸리티 ====================

    def _parse_coordinate(self, coord_str: str) -> Optional[float]:
        """좌표 문자열을 10진수로 변환"""
        if not coord_str:
            return None

        try:
            # N37-27-45.0023 형식
            if '-' in coord_str:
                direction = coord_str[0]
                parts = coord_str[1:].split('-')
                degrees = float(parts[0])
                minutes = float(parts[1]) if len(parts) > 1 else 0
                seconds = float(parts[2]) if len(parts) > 2 else 0

                decimal = degrees + minutes / 60 + seconds / 3600
                if direction in ['S', 'W']:
                    decimal = -decimal
                return decimal

            # 이미 10진수인 경우
            return float(coord_str)
        except:
            return None

    def get_stats(self) -> Dict:
        """데이터베이스 통계"""
        cursor = self.conn.cursor()
        stats = {}

        tables = ['notam_fir', 'notam_ad', 'snowtam', 'prohibited_area',
                  'airports', 'runways', 'aprons', 'navaids', 'obstacles',
                  'flight_plans', 'metar', 'taf', 'sigmet']

        for table in tables:
            try:
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                stats[table] = cursor.fetchone()[0]
            except:
                stats[table] = 0

        return stats

    def export_to_json(self, output_dir: str = "./data"):
        """모든 테이블을 JSON으로 내보내기"""
        cursor = self.conn.cursor()
        os.makedirs(output_dir, exist_ok=True)

        tables = ['notam_fir', 'notam_ad', 'airports', 'runways', 'navaids', 'obstacles']

        for table in tables:
            try:
                cursor.execute(f'SELECT * FROM {table}')
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]

                with open(os.path.join(output_dir, f'{table}.json'), 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                logger.info(f"{table} 내보내기 완료: {len(data)}건")
            except Exception as e:
                logger.warning(f"{table} 내보내기 오류: {e}")

    def close(self):
        """연결 종료"""
        if self.conn:
            self.conn.close()


if __name__ == "__main__":
    # 테스트
    db = UBIKAISDatabase("./data/ubikais_test.db")
    print("데이터베이스 통계:", db.get_stats())
    db.close()
