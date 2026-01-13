#!/usr/bin/env python3
"""
UBIKAIS 종합 크롤러 (한국 공역 정보 시스템)
모든 메뉴 데이터를 실시간으로 수집하여 JSON 파일 및 SQLite DB로 저장

작성일: 2026-01-11
"""

import requests
import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import time

# 데이터베이스 모듈 임포트
try:
    from ubikais_database import UBIKAISDatabase
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ubikais_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class UBIKAISCrawler:
    """UBIKAIS 종합 크롤러"""

    BASE_URL = "https://ubikais.fois.go.kr:8030"

    # 한국 공항 ICAO 코드 목록
    AIRPORTS = [
        "RKSI",  # 인천
        "RKSS",  # 김포
        "RKTU",  # 청주
        "RKNY",  # 양양
        "RKJK",  # 군산
        "RKNW",  # 원주
        "RKPC",  # 제주
        "RKPK",  # 김해
        "RKTN",  # 대구
        "RKJJ",  # 광주
        "RKJY",  # 여수
        "RKPU",  # 울산
        "RKTH",  # 포항
        "RKPS",  # 사천
        "RKJB",  # 무안
        "RKTL",  # 울진
    ]

    def __init__(self, username: str, password: str, output_dir: str = "./data", use_db: bool = True):
        self.username = username
        self.password = password
        self.output_dir = output_dir
        self.session = requests.Session()
        self.session.verify = False  # HTTPS 인증서 검증 비활성화 (필요시)

        # SSL 경고 비활성화
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        # 출력 디렉토리 생성
        os.makedirs(output_dir, exist_ok=True)

        # 데이터베이스 초기화
        self.db = None
        if use_db and DB_AVAILABLE:
            self.db = UBIKAISDatabase(os.path.join(output_dir, "ubikais.db"))
            logger.info("SQLite 데이터베이스 활성화")

    def login(self) -> bool:
        """UBIKAIS 로그인"""
        logger.info("UBIKAIS 로그인 시도...")

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }

            # Step 1: 로그인 페이지 접속하여 세션 초기화
            self.session.get(
                f"{self.BASE_URL}/common/login",
                params={"systemId": "sysUbikais"},
                headers=headers
            )

            # Step 2: 로그인 요청 (정확한 엔드포인트: /common/loginProc)
            login_data = {
                "userId": self.username,
                "userPw": self.password,
                "systemId": "sysUbikais"
            }

            response = self.session.post(
                f"{self.BASE_URL}/common/loginProc",
                data=login_data,
                headers={
                    **headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": f"{self.BASE_URL}/common/login?systemId=sysUbikais"
                },
                allow_redirects=True
            )

            # Step 3: 메인 페이지 접속하여 세션 확인
            main_response = self.session.get(
                f"{self.BASE_URL}/sysUbikais/biz/main.ubikais",
                headers=headers
            )

            if "Logout" in main_response.text or "logout" in main_response.text.lower():
                logger.info("로그인 성공!")
                return True
            else:
                logger.error("로그인 실패: 세션 확인 불가")
                return False

        except Exception as e:
            logger.error(f"로그인 오류: {e}")
            return False

    def set_session_cookie(self, jsessionid: str, scouter: str = "x1tua7ph2435ed"):
        """브라우저에서 가져온 세션 쿠키 설정 (로그인 우회용)"""
        self.session.cookies.set("JSESSIONID", jsessionid, domain="ubikais.fois.go.kr", path="/")
        self.session.cookies.set("SCOUTER", scouter, domain="ubikais.fois.go.kr", path="/")
        logger.info("세션 쿠키 설정 완료")

    def _get_today(self) -> str:
        """오늘 날짜 (YYYYMMDD)"""
        return datetime.now().strftime("%Y%m%d")

    def _get_date_range(self, days: int = 2) -> tuple:
        """날짜 범위 반환 (YYYY-MM-DD 형식)"""
        today = datetime.now()
        start = today - timedelta(days=days)
        return start.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")

    def _make_request(self, endpoint: str, params: dict = None, referer: str = None) -> Optional[dict]:
        """API 요청"""
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": referer or f"{self.BASE_URL}/sysUbikais/biz/main.ubikais"
        }
        try:
            response = self.session.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except json.JSONDecodeError:
            logger.warning(f"JSON 파싱 실패: {endpoint}")
            return {"raw": response.text[:500] if response.text else ""}
        except Exception as e:
            logger.error(f"요청 실패 {endpoint}: {e}")
            return None

    def _save_data(self, data: Any, filename: str):
        """데이터 저장"""
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"저장 완료: {filepath}")

    # ==================== 메인 페이지 데이터 ====================

    def crawl_main_departures(self, airport: str = "RKSI") -> dict:
        """메인 페이지 출발 항공편"""
        logger.info(f"메인 출발 데이터 수집: {airport}")
        return self._make_request(
            "/main/selectIfr.fois",
            {"depArr": "dep", "apIcao": airport}
        )

    def crawl_main_arrivals(self, airport: str = "RKSI") -> dict:
        """메인 페이지 도착 항공편"""
        logger.info(f"메인 도착 데이터 수집: {airport}")
        return self._make_request(
            "/main/selectIfr.fois",
            {"depArr": "arr", "apIcao": airport}
        )

    def crawl_main_weather(self, airport: str = "RKSI") -> dict:
        """메인 페이지 기상 요약"""
        logger.info(f"메인 기상 데이터 수집: {airport}")
        return self._make_request(
            "/main/selectMetSpec.fois",
            {"apIcao": airport}
        )

    # ==================== NOTAM 데이터 ====================

    def crawl_notam_fir(self, series: str = "C") -> dict:
        """FIR NOTAM (RK NOTAM)

        Args:
            series: NOTAM 시리즈 (C, A, D, E, H, G, Z)
        """
        logger.info(f"FIR NOTAM 수집 (Series: {series})")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        return self._make_request(
            "/sysUbikais/biz/nps/selectNotamRecFir.fois",
            {
                "downloadYn": "1",
                "srchFir": "RKRR",
                "srchAd": "RKRR",
                "srchSeries": series,
                "srchValid": today,
                "srchValidsh": f"{today_short}2359",
                "srchValidsh2": f"{today_short}0000",
                "srchValid2": "1",
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }
        )

    def crawl_notam_ad(self, airport: str = "RKSI", series: str = "C") -> dict:
        """AD NOTAM (공항별)

        Args:
            airport: 공항 ICAO 코드
            series: NOTAM 시리즈
        """
        logger.info(f"AD NOTAM 수집: {airport}")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        return self._make_request(
            "/sysUbikais/biz/nps/selectNotamRecAd.fois",
            {
                "downloadYn": "1",
                "srchFir": "RKRR",
                "srchSeries": series,
                "srchAd": airport,
                "srchValid": today,
                "srchValidsh": f"{today_short}2359",
                "srchValidsh2": f"{today_short}0000",
                "srchValid2": "1",
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }
        )

    def crawl_notam_snow(self) -> dict:
        """SNOWTAM"""
        logger.info("SNOWTAM 수집")
        return self._make_request(
            "/sysUbikais/biz/nps/selectNotamRecSnow.fois",
            {
                "downloadYn": "1",
                "printYn": "",
                "srchOriginator": "",
                "srchSeq": "",
                "srchAd": "",
                "srchValidFrom": datetime.now().strftime("%Y"),  # 연도만 (예: "2026")
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }
        )

    def crawl_notam_prohibited(self, qcode: str = "QRP") -> dict:
        """금지구역 NOTAM

        Args:
            qcode: Q-code (QRP=Prohibited, QRR=Restricted, QRD=Danger)
        """
        logger.info(f"금지구역 NOTAM 수집 (QCode: {qcode})")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        # 정확한 엔드포인트: selectRecOffZone.fois
        return self._make_request(
            "/sysUbikais/biz/nps/selectRecOffZone.fois",
            {
                "downloadYn": "1",
                "srchFir": "RKRR",
                "srchSeries": "D",
                "srchQcode": qcode,
                "srchValid": today,
                "srchValidsh": f"{today_short}2359",
                "srchValidsh2": f"{today_short}0000",
                "srchValid2": "1",
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }
        )

    def crawl_notam_sequence(self, series: str = "C") -> dict:
        """NOTAM Sequence List

        Args:
            series: NOTAM 시리즈 (C, A, D, E, H, G, Z)
        """
        logger.info(f"NOTAM Sequence 수집 (Series: {series})")
        return self._make_request(
            "/sysUbikais/biz/nps/selectNotamRecSeq.fois",
            {
                "downloadYn": "1",
                "printYn": "",
                "srchFir": "RKRR",
                "srchSeries": series,
                "srchSeq": "",
                "srchYear": datetime.now().strftime("%y"),  # 2자리 연도 (예: "26")
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }
        )

    # ==================== 비행 계획 (i-ARO) ====================

    def crawl_fpl_departures(self) -> dict:
        """IFR 출발 비행계획"""
        logger.info("IFR 출발 비행계획 수집")
        today = self._get_today()
        return self._make_request(
            "/sysUbikais/biz/fpl/selectDep.fois",
            {
                "today": today,
                "cmd": "get-records",
                "limit": 1000,
                "offset": 0
            }
        )

    def crawl_fpl_arrivals(self) -> dict:
        """IFR 도착 비행계획"""
        logger.info("IFR 도착 비행계획 수집")
        today = self._get_today()
        return self._make_request(
            "/sysUbikais/biz/fpl/selectArr.fois",
            {
                "today": today,
                "cmd": "get-records",
                "limit": 1000,
                "offset": 0
            }
        )

    def crawl_fpl_vfr(self) -> dict:
        """VFR 비행계획"""
        logger.info("VFR 비행계획 수집")
        today = self._get_today()
        return self._make_request(
            "/sysUbikais/biz/fpl/selectVfrFpl.fois",
            {
                "today": today,
                "cmd": "get-records",
                "limit": 1000,
                "offset": 0
            }
        )

    def crawl_fpl_ulp(self) -> dict:
        """ULP/LSA 비행계획"""
        logger.info("ULP/LSA 비행계획 수집")
        today = self._get_today()
        return self._make_request(
            "/sysUbikais/biz/fpl/selectUlpFpl.fois",
            {
                "today": today,
                "cmd": "get-records",
                "limit": 1000,
                "offset": 0
            }
        )

    # ==================== 기상 데이터 (WEATHER) ====================

    def crawl_metar(self, airport: str = "RKSI", days: int = 2) -> dict:
        """METAR/SPECI 데이터"""
        logger.info(f"METAR 수집: {airport}")
        date_from, date_to = self._get_date_range(days)
        return self._make_request(
            "/sysUbikais/biz/wis/selectMetar.fois",
            {
                "today": self._get_today(),
                "srchApIcao": airport,
                "srchDateFr": date_from,
                "srchDateTo": date_to,
                "cmd": "get-records",
                "limit": 500,
                "offset": 0
            }
        )

    def crawl_taf(self, airport: str = "RKSI", days: int = 2) -> dict:
        """TAF 데이터"""
        logger.info(f"TAF 수집: {airport}")
        date_from, date_to = self._get_date_range(days)
        return self._make_request(
            "/sysUbikais/biz/wis/selectTaf.fois",
            {
                "today": self._get_today(),
                "srchApIcao": airport,
                "srchDateFr": date_from,
                "srchDateTo": date_to,
                "cmd": "get-records",
                "limit": 500,
                "offset": 0
            }
        )

    def crawl_sigmet(self) -> dict:
        """SIGMET 데이터"""
        logger.info("SIGMET 수집")
        date_from, date_to = self._get_date_range(7)
        return self._make_request(
            "/sysUbikais/biz/wis/selectSigmet.fois",
            {
                "srchDateFr": date_from,
                "srchDateTo": date_to,
                "cmd": "get-records",
                "limit": 100,
                "offset": 0
            }
        )

    # ==================== AERO-DATA ====================

    def crawl_airport_data(self, airport: str = "RKSI") -> dict:
        """공항 데이터"""
        logger.info(f"공항 데이터 수집: {airport}")
        return self._make_request(
            "/sysUbikais/biz/ais/airport/select.fois",
            {"today": self._get_today(), "srchAd": airport}
        )

    def crawl_runway_data(self, airport: str = "RKSI") -> dict:
        """활주로 데이터"""
        logger.info(f"활주로 데이터 수집: {airport}")
        return self._make_request(
            "/sysUbikais/biz/ais/runway/select.fois",
            {"today": self._get_today(), "srchAd": airport}
        )

    def crawl_apron_data(self, airport: str = "RKSI") -> dict:
        """주기장 데이터"""
        logger.info(f"주기장 데이터 수집: {airport}")
        return self._make_request(
            "/sysUbikais/biz/ais/apron/select.fois",
            {"today": self._get_today(), "srchAd": airport}
        )

    def crawl_navaid_data(self) -> dict:
        """항행안전시설 데이터"""
        logger.info("NAVaid 데이터 수집")
        return self._make_request(
            "/sysUbikais/biz/ais/navaid/select.fois",
            {"today": self._get_today(), "cmd": "get-records", "limit": 500, "offset": 0}
        )

    def crawl_obstacle_data(self) -> dict:
        """장애물 데이터"""
        logger.info("장애물 데이터 수집")
        return self._make_request(
            "/sysUbikais/biz/ais/obst/select.fois",
            {"today": self._get_today(), "cmd": "get-records", "limit": 500, "offset": 0}
        )

    # ==================== ATFM ====================

    def crawl_atfm_adp(self) -> dict:
        """ATFM Daily Plan"""
        logger.info("ATFM Daily Plan 수집")
        return self._make_request(
            "/sysUbikais/biz/atfms/selectAdp.fois",
            {"today": self._get_today(), "cmd": "get-records", "limit": 100, "offset": 0}
        )

    def crawl_atfm_message(self) -> dict:
        """ATFM Message"""
        logger.info("ATFM Message 수집")
        return self._make_request(
            "/sysUbikais/biz/atfms/selectDfl.fois",
            {"today": self._get_today(), "cmd": "get-records", "limit": 100, "offset": 0}
        )

    # ==================== 종합 크롤링 ====================

    def crawl_all(self, save: bool = True) -> dict:
        """모든 데이터 크롤링"""
        logger.info("=" * 50)
        logger.info("UBIKAIS 전체 데이터 크롤링 시작")
        logger.info("=" * 50)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        all_data = {
            "crawled_at": datetime.now().isoformat(),
            "data": {}
        }

        # 1. 메인 페이지 데이터 (주요 공항)
        main_airports = ["RKSI", "RKSS", "RKPK", "RKPC", "RKPU"]
        all_data["data"]["main"] = {
            "departures": {},
            "arrivals": {},
            "weather": {}
        }
        for apt in main_airports:
            all_data["data"]["main"]["departures"][apt] = self.crawl_main_departures(apt)
            all_data["data"]["main"]["arrivals"][apt] = self.crawl_main_arrivals(apt)
            all_data["data"]["main"]["weather"][apt] = self.crawl_main_weather(apt)
            time.sleep(0.5)  # Rate limiting

        # 2. NOTAM (모든 타입)
        all_data["data"]["notam"] = {
            "fir": {},
            "ad": {},
            "snow": self.crawl_notam_snow(),
            "prohibited": self.crawl_notam_prohibited(),
            "sequence": {}
        }

        # FIR NOTAM (모든 시리즈)
        for series in ["C", "A", "D"]:
            result = self.crawl_notam_fir(series)
            if result and result.get("records"):
                all_data["data"]["notam"]["fir"][series] = result
            time.sleep(0.3)

        # AD NOTAM (주요 공항)
        for airport in main_airports:
            result = self.crawl_notam_ad(airport)
            if result:
                all_data["data"]["notam"]["ad"][airport] = result
            time.sleep(0.3)

        # Sequence List (모든 시리즈)
        for series in ["C", "A", "D"]:
            result = self.crawl_notam_sequence(series)
            if result and result.get("records"):
                all_data["data"]["notam"]["sequence"][series] = result
            time.sleep(0.3)

        # 3. 비행계획
        all_data["data"]["flight_plans"] = {
            "ifr_departures": self.crawl_fpl_departures(),
            "ifr_arrivals": self.crawl_fpl_arrivals(),
            "vfr": self.crawl_fpl_vfr(),
            "ulp_lsa": self.crawl_fpl_ulp()
        }

        # 4. 기상 데이터 (주요 공항)
        all_data["data"]["weather"] = {
            "metar": {},
            "taf": {}
        }
        for apt in main_airports:
            all_data["data"]["weather"]["metar"][apt] = self.crawl_metar(apt)
            all_data["data"]["weather"]["taf"][apt] = self.crawl_taf(apt)
            time.sleep(0.3)
        all_data["data"]["weather"]["sigmet"] = self.crawl_sigmet()

        # 5. AERO-DATA
        all_data["data"]["aero_data"] = {
            "airports": {},
            "runways": {},
            "aprons": {}
        }
        for apt in self.AIRPORTS:
            all_data["data"]["aero_data"]["airports"][apt] = self.crawl_airport_data(apt)
            all_data["data"]["aero_data"]["runways"][apt] = self.crawl_runway_data(apt)
            all_data["data"]["aero_data"]["aprons"][apt] = self.crawl_apron_data(apt)
            time.sleep(0.3)
        all_data["data"]["aero_data"]["navaids"] = self.crawl_navaid_data()
        all_data["data"]["aero_data"]["obstacles"] = self.crawl_obstacle_data()

        # 6. ATFM
        all_data["data"]["atfm"] = {
            "daily_plan": self.crawl_atfm_adp(),
            "messages": self.crawl_atfm_message()
        }

        # 데이터 저장
        if save:
            self._save_data(all_data, f"ubikais_full_{timestamp}.json")

            # 개별 파일로도 저장
            self._save_data(all_data["data"]["notam"], f"notam_{timestamp}.json")
            self._save_data(all_data["data"]["flight_plans"], f"flight_plans_{timestamp}.json")
            self._save_data(all_data["data"]["weather"], f"weather_{timestamp}.json")
            self._save_data(all_data["data"]["aero_data"], f"aero_data_{timestamp}.json")

            # 실시간 데이터 (최신 버전으로 덮어쓰기)
            self._save_data(all_data["data"]["flight_plans"], "flight_schedule.json")
            self._save_data(all_data["data"]["weather"], "weather_current.json")
            self._save_data(all_data["data"]["notam"], "notam_current.json")

        logger.info("=" * 50)
        logger.info("크롤링 완료!")
        logger.info("=" * 50)

        return all_data

    def crawl_realtime(self, save: bool = True) -> dict:
        """실시간 데이터만 크롤링 (빈번한 업데이트용)"""
        logger.info("실시간 데이터 크롤링...")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        data = {
            "crawled_at": datetime.now().isoformat(),
            "departures": {},
            "arrivals": {},
            "weather": {}
        }

        main_airports = ["RKSI", "RKSS", "RKPK", "RKPC", "RKPU"]
        for apt in main_airports:
            data["departures"][apt] = self.crawl_main_departures(apt)
            data["arrivals"][apt] = self.crawl_main_arrivals(apt)
            data["weather"][apt] = self.crawl_main_weather(apt)
            time.sleep(0.3)

        if save:
            self._save_data(data, "realtime_current.json")

        return data


def main():
    """메인 실행 함수"""
    import argparse

    parser = argparse.ArgumentParser(description="UBIKAIS 크롤러")
    parser.add_argument("--mode", choices=["full", "realtime"], default="full",
                        help="크롤링 모드: full(전체) 또는 realtime(실시간)")
    parser.add_argument("--output", default="./data", help="출력 디렉토리")
    parser.add_argument("--interval", type=int, default=0,
                        help="반복 간격(초). 0이면 1회 실행")
    args = parser.parse_args()

    # 환경 변수에서 인증 정보 읽기
    username = os.environ.get("UBIKAIS_USERNAME", "allofdanie")
    password = os.environ.get("UBIKAIS_PASSWORD", "pr12pr34!!")

    crawler = UBIKAISCrawler(username, password, args.output)

    if not crawler.login():
        logger.error("로그인 실패. 프로그램 종료.")
        return

    if args.interval > 0:
        # 반복 실행
        while True:
            try:
                if args.mode == "full":
                    crawler.crawl_all()
                else:
                    crawler.crawl_realtime()

                logger.info(f"{args.interval}초 후 다음 크롤링...")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                logger.info("사용자에 의해 중단됨")
                break
            except Exception as e:
                logger.error(f"크롤링 오류: {e}")
                time.sleep(60)  # 오류 시 1분 대기
    else:
        # 1회 실행
        if args.mode == "full":
            crawler.crawl_all()
        else:
            crawler.crawl_realtime()


if __name__ == "__main__":
    main()
