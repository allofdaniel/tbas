#!/usr/bin/env python3
"""
통합 항공 데이터 크롤러
- UBIKAIS: NOTAM, SNOWTAM, 금지구역
- AIM Korea: NOTAM 백업
- 항공기상: METAR, TAF
- 인천공항: 출도착 정보
"""

import os
import json
import time
import glob
import logging
import schedule
import requests
import urllib3
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from playwright.sync_api import sync_playwright

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


@dataclass
class Config:
    """크롤러 설정"""
    output_dir: str = os.environ.get("OUTPUT_DIR", "/data")
    crawl_interval: int = int(os.environ.get("CRAWL_INTERVAL", "3600"))
    max_files_per_category: int = int(os.environ.get("MAX_FILES", "24"))  # 24시간치 보관
    request_timeout: int = 30
    retry_count: int = 3
    retry_delay: float = 1.0

    # UBIKAIS
    ubikais_url: str = "https://ubikais.fois.go.kr:8030"
    ubikais_username: str = os.environ.get("UBIKAIS_USERNAME", "allofdanie")
    ubikais_password: str = os.environ.get("UBIKAIS_PASSWORD", "pr12pr34!!")

    # 한국 주요 공항
    korean_airports: List[str] = None

    def __post_init__(self):
        if self.korean_airports is None:
            self.korean_airports = [
                "RKSI", "RKSS", "RKPC", "RKPK", "RKPU",
                "RKJJ", "RKTN", "RKNY", "RKJB", "RKJY"
            ]


class UnifiedAviationCrawler:
    """통합 항공 데이터 크롤러"""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self._init_session()
        self._init_directories()

    def _init_session(self) -> None:
        """HTTP 세션 초기화"""
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

    def _init_directories(self) -> None:
        """데이터 디렉토리 초기화"""
        categories = ["ubikais", "aim", "weather", "airport"]
        for category in categories:
            os.makedirs(os.path.join(self.config.output_dir, category), exist_ok=True)

    def _get_date_params(self) -> Dict[str, str]:
        """UBIKAIS용 날짜 파라미터 생성"""
        now = datetime.now()
        return {
            "today": now.strftime("%Y-%m-%d"),
            "today_short": now.strftime("%y%m%d"),
            "year": now.strftime("%Y")
        }

    def _request_with_retry(self, url: str, params: Dict = None,
                           timeout: int = None) -> Optional[requests.Response]:
        """재시도 로직이 있는 HTTP 요청"""
        timeout = timeout or self.config.request_timeout

        for attempt in range(self.config.retry_count):
            try:
                resp = self.session.get(url, params=params, timeout=timeout)
                if resp.status_code == 200:
                    return resp
            except Exception as e:
                if attempt < self.config.retry_count - 1:
                    time.sleep(self.config.retry_delay * (attempt + 1))
                else:
                    logger.warning(f"요청 실패 ({url}): {e}")
        return None

    def _save_data(self, category: str, name: str, data: Dict) -> str:
        """데이터 저장 및 오래된 파일 정리"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 타임스탬프 버전 저장
        filepath = os.path.join(self.config.output_dir, category, f"{name}_{timestamp}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # 최신 버전 저장
        latest_path = os.path.join(self.config.output_dir, category, f"{name}_latest.json")
        with open(latest_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # 오래된 파일 정리
        self._cleanup_old_files(category, name)

        logger.info(f"  저장: {filepath}")
        return filepath

    def _cleanup_old_files(self, category: str, name: str) -> None:
        """오래된 파일 정리 (최신 N개만 유지)"""
        pattern = os.path.join(self.config.output_dir, category, f"{name}_2*.json")
        files = sorted(glob.glob(pattern), reverse=True)

        # 최대 개수 초과 파일 삭제
        for old_file in files[self.config.max_files_per_category:]:
            try:
                os.remove(old_file)
                logger.debug(f"  삭제: {old_file}")
            except OSError:
                pass

    # ==================== UBIKAIS ====================
    def _ubikais_login(self) -> bool:
        """UBIKAIS Playwright 로그인"""
        logger.info("[UBIKAIS] 로그인 시작...")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-dev-shm-usage']
                )
                context = browser.new_context(ignore_https_errors=True)
                page = context.new_page()

                login_url = f"{self.config.ubikais_url}/common/login?systemId=sysUbikais"
                page.goto(login_url, wait_until="networkidle")
                page.fill('input[name="userId"]', self.config.ubikais_username)
                page.fill('input[name="userPw"]', self.config.ubikais_password)
                page.click('button[type="submit"], input[type="submit"], .btn-login, #loginBtn')
                page.wait_for_timeout(3000)

                for cookie in context.cookies():
                    if cookie['name'] == 'JSESSIONID':
                        self.session.cookies.set(
                            "JSESSIONID", cookie['value'],
                            domain="ubikais.fois.go.kr"
                        )
                        logger.info("[UBIKAIS] 로그인 성공!")
                        browser.close()
                        return True

                browser.close()
                return False
        except Exception as e:
            logger.error(f"[UBIKAIS] 로그인 실패: {e}")
            return False

    def _ubikais_fetch(self, endpoint: str, extra_params: Dict = None) -> Optional[Dict]:
        """UBIKAIS API 공통 요청"""
        dates = self._get_date_params()
        base_params = {
            "downloadYn": "1",
            "srchFir": "RKRR",
            "srchValid": dates["today"],
            "srchValidsh": f"{dates['today_short']}2359",
            "srchValidsh2": f"{dates['today_short']}0000",
            "srchValid2": "1",
            "cmd": "get-records",
            "limit": "1000",
            "offset": "0"
        }
        if extra_params:
            base_params.update(extra_params)

        url = f"{self.config.ubikais_url}/sysUbikais/biz/nps/{endpoint}"
        resp = self._request_with_retry(url, base_params)

        if resp:
            try:
                return resp.json()
            except json.JSONDecodeError:
                return None
        return None

    def crawl_ubikais(self) -> Optional[Dict]:
        """UBIKAIS 전체 크롤링"""
        logger.info("=" * 60)
        logger.info("[UBIKAIS] 크롤링 시작")

        if not self._ubikais_login():
            logger.error("[UBIKAIS] 로그인 실패, 스킵")
            return None

        data = {
            "crawled_at": datetime.now().isoformat(),
            "source": "UBIKAIS",
            "fir_notam": {},
            "ad_notam": {},
            "snowtam": None,
            "prohibited_area": None
        }

        # FIR NOTAM (시리즈별)
        for series in ["C", "A", "D"]:
            result = self._ubikais_fetch(
                "selectNotamRecFir.fois",
                {"srchAd": "RKRR", "srchSeries": series}
            )
            if result and result.get("records"):
                data["fir_notam"][series] = result
                logger.info(f"  FIR {series}: {len(result['records'])} records")
            time.sleep(0.5)

        # AD NOTAM (공항별)
        for airport in self.config.korean_airports:
            result = self._ubikais_fetch(
                "selectNotamRecAd.fois",
                {"srchAd": airport, "srchSeries": "C"}
            )
            if result and result.get("records"):
                data["ad_notam"][airport] = result
                logger.info(f"  AD {airport}: {len(result['records'])} records")
            time.sleep(0.3)

        # SNOWTAM
        dates = self._get_date_params()
        snowtam_params = {
            "printYn": "", "srchOriginator": "", "srchSeq": "", "srchAd": "",
            "srchValidFrom": dates["year"]
        }
        url = f"{self.config.ubikais_url}/sysUbikais/biz/nps/selectNotamRecSnow.fois"
        resp = self._request_with_retry(url, {
            "downloadYn": "1", "cmd": "get-records", "limit": "1000", "offset": "0",
            **snowtam_params
        })
        if resp:
            try:
                result = resp.json()
                if result.get("records"):
                    data["snowtam"] = result
                    logger.info(f"  SNOWTAM: {len(result['records'])} records")
            except json.JSONDecodeError:
                pass

        # 금지구역
        result = self._ubikais_fetch(
            "selectRecOffZone.fois",
            {"srchSeries": "D", "srchQcode": "QRP"}
        )
        if result and result.get("records"):
            data["prohibited_area"] = result
            logger.info(f"  Prohibited: {len(result['records'])} records")

        self._save_data("ubikais", "notam", data)
        return data

    # ==================== AIM Korea ====================
    def crawl_aim_korea(self) -> Dict:
        """AIM Korea NOTAM 크롤링"""
        logger.info("=" * 60)
        logger.info("[AIM Korea] 크롤링 시작")

        data = {
            "crawled_at": datetime.now().isoformat(),
            "source": "AIM_Korea",
            "notams": {}
        }

        base_url = "https://aim.koca.go.kr/ko/api/notam/list"

        for airport in self.config.korean_airports:
            resp = self._request_with_retry(base_url, {"icao": airport, "type": "all"})
            if resp:
                try:
                    data["notams"][airport] = resp.json()
                    logger.info(f"  {airport}: OK")
                except json.JSONDecodeError:
                    logger.warning(f"  {airport}: JSON 파싱 실패")
            time.sleep(0.3)

        self._save_data("aim", "notam", data)
        return data

    # ==================== 항공기상 ====================
    def crawl_aviation_weather(self) -> Dict:
        """항공기상 (METAR/TAF) 크롤링"""
        logger.info("=" * 60)
        logger.info("[항공기상] 크롤링 시작")

        data = {
            "crawled_at": datetime.now().isoformat(),
            "source": "Aviation_Weather",
            "metar": {},
            "taf": {}
        }

        airports_str = ",".join(self.config.korean_airports)

        # METAR
        metar_url = f"https://aviationweather.gov/api/data/metar?ids={airports_str}&format=json"
        resp = self._request_with_retry(metar_url)
        if resp:
            try:
                for item in resp.json():
                    data["metar"][item.get("icaoId", "")] = item
                logger.info(f"  METAR: {len(data['metar'])} records")
            except (json.JSONDecodeError, TypeError):
                logger.warning("  METAR: 파싱 실패")

        # TAF
        taf_url = f"https://aviationweather.gov/api/data/taf?ids={airports_str}&format=json"
        resp = self._request_with_retry(taf_url)
        if resp:
            try:
                for item in resp.json():
                    data["taf"][item.get("icaoId", "")] = item
                logger.info(f"  TAF: {len(data['taf'])} records")
            except (json.JSONDecodeError, TypeError):
                logger.warning("  TAF: 파싱 실패")

        # 기상청 백업
        kma_resp = self._request_with_retry("https://www.kma.go.kr/DFSROOT/APIS/getAviation.php")
        if kma_resp:
            data["kma_aviation"] = kma_resp.text
            logger.info("  KMA Aviation: OK")

        self._save_data("weather", "aviation", data)
        return data

    # ==================== 인천공항 ====================
    def crawl_incheon_airport(self) -> Dict:
        """인천공항 출도착 정보 크롤링"""
        logger.info("=" * 60)
        logger.info("[인천공항] 크롤링 시작")

        data = {
            "crawled_at": datetime.now().isoformat(),
            "source": "Incheon_Airport",
            "departures": [],
            "arrivals": [],
            "web_accessible": False
        }

        api_key = os.environ.get("DATA_GO_KR_API_KEY", "")

        if api_key:
            base_params = {"serviceKey": api_key, "numOfRows": "100", "pageNo": "1", "type": "json"}

            # 출발편
            dep_resp = self._request_with_retry(
                "http://apis.data.go.kr/B551177/StatusOfDepartures/getStatusOfDepartures",
                base_params
            )
            if dep_resp:
                try:
                    items = dep_resp.json().get("response", {}).get("body", {}).get("items", [])
                    data["departures"] = items
                    logger.info(f"  Departures: {len(items)} flights")
                except (json.JSONDecodeError, TypeError):
                    pass

            # 도착편
            arr_resp = self._request_with_retry(
                "http://apis.data.go.kr/B551177/StatusOfArrivals/getStatusOfArrivals",
                base_params
            )
            if arr_resp:
                try:
                    items = arr_resp.json().get("response", {}).get("body", {}).get("items", [])
                    data["arrivals"] = items
                    logger.info(f"  Arrivals: {len(items)} flights")
                except (json.JSONDecodeError, TypeError):
                    pass
        else:
            logger.warning("  DATA_GO_KR_API_KEY 없음")

        # 웹 접근성 확인
        web_resp = self._request_with_retry("https://www.airport.kr/ap_ko/index.do")
        if web_resp:
            data["web_accessible"] = True
            logger.info("  인천공항 웹: 접근 가능")

        self._save_data("airport", "incheon", data)
        return data

    # ==================== 메인 ====================
    def crawl_all(self) -> Dict[str, Any]:
        """모든 소스 크롤링"""
        logger.info("=" * 60)
        logger.info("통합 항공 데이터 크롤링 시작")
        logger.info(f"시간: {datetime.now().isoformat()}")
        logger.info("=" * 60)

        crawlers = [
            ("ubikais", self.crawl_ubikais),
            ("aim", self.crawl_aim_korea),
            ("weather", self.crawl_aviation_weather),
            ("airport", self.crawl_incheon_airport),
        ]

        results = {}
        for name, crawler in crawlers:
            try:
                results[name] = crawler()
            except Exception as e:
                logger.error(f"{name} 크롤링 실패: {e}")
                results[name] = None

        # 요약 저장
        summary = {
            "crawled_at": datetime.now().isoformat(),
            "sources": list(results.keys()),
            "status": {k: "success" if v else "failed" for k, v in results.items()}
        }

        summary_path = os.path.join(self.config.output_dir, "crawl_summary.json")
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        logger.info("=" * 60)
        logger.info("통합 크롤링 완료!")
        logger.info("=" * 60)

        return results

    def run(self) -> None:
        """메인 실행 (스케줄러)"""
        logger.info("통합 항공 데이터 크롤러 시작")
        logger.info(f"크롤링 간격: {self.config.crawl_interval}초")
        logger.info(f"파일 보관: 카테고리당 {self.config.max_files_per_category}개")

        def job():
            try:
                self.crawl_all()
            except Exception as e:
                logger.error(f"크롤링 오류: {e}")

        # 즉시 1회 실행
        job()

        # 스케줄 설정
        schedule.every(self.config.crawl_interval).seconds.do(job)

        # 무한 루프
        while True:
            schedule.run_pending()
            time.sleep(60)


if __name__ == "__main__":
    crawler = UnifiedAviationCrawler()
    crawler.run()
