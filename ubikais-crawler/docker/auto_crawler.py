#!/usr/bin/env python3
"""
UBIKAIS 자동 크롤러
Playwright로 자동 로그인 후 API 크롤링
Docker 컨테이너에서 실행
"""

import os
import json
import time
import logging
import schedule
from datetime import datetime
from playwright.sync_api import sync_playwright
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 설정
BASE_URL = "https://ubikais.fois.go.kr:8030"
USERNAME = os.environ.get("UBIKAIS_USERNAME", "allofdanie")
PASSWORD = os.environ.get("UBIKAIS_PASSWORD", "pr12pr34!!")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/data")
CRAWL_INTERVAL = int(os.environ.get("CRAWL_INTERVAL", "3600"))  # 기본 1시간


class UBIKAISAutoCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    def login_with_playwright(self) -> bool:
        """Playwright로 자동 로그인하고 세션 쿠키 획득"""
        logger.info("Playwright 자동 로그인 시작...")

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-dev-shm-usage']
                )
                context = browser.new_context(
                    ignore_https_errors=True,
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                )
                page = context.new_page()

                # 로그인 페이지 접속
                page.goto(f"{BASE_URL}/common/login?systemId=sysUbikais", wait_until="networkidle")
                logger.info("로그인 페이지 접속 완료")

                # 로그인 폼 입력
                page.fill('input[name="userId"]', USERNAME)
                page.fill('input[name="userPw"]', PASSWORD)

                # 로그인 버튼 클릭
                page.click('button[type="submit"], input[type="submit"], .btn-login, #loginBtn')

                # 메인 페이지 로드 대기
                page.wait_for_timeout(3000)

                # 쿠키 추출
                cookies = context.cookies()
                jsessionid = None
                scouter = None

                for cookie in cookies:
                    if cookie['name'] == 'JSESSIONID':
                        jsessionid = cookie['value']
                    elif cookie['name'] == 'SCOUTER':
                        scouter = cookie['value']

                browser.close()

                if jsessionid:
                    self.session.cookies.set("JSESSIONID", jsessionid, domain="ubikais.fois.go.kr", path="/")
                    if scouter:
                        self.session.cookies.set("SCOUTER", scouter, domain="ubikais.fois.go.kr", path="/")
                    logger.info(f"로그인 성공! JSESSIONID: {jsessionid[:20]}...")
                    return True
                else:
                    logger.error("JSESSIONID 쿠키를 찾을 수 없음")
                    return False

        except Exception as e:
            logger.error(f"로그인 실패: {e}")
            return False

    def _get_headers(self, referer=None):
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": referer or f"{BASE_URL}/sysUbikais/biz/main.ubikais"
        }

    def fetch_notam_fir(self, series="C"):
        """FIR NOTAM 수집"""
        logger.info(f"FIR NOTAM 수집 (Series: {series})")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecFir.fois"
        params = {
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

        try:
            response = self.session.get(url, params=params, headers=self._get_headers(), timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"FIR NOTAM 수집 실패: {e}")
        return None

    def fetch_notam_ad(self, airport="RKSI"):
        """AD NOTAM 수집"""
        logger.info(f"AD NOTAM 수집 ({airport})")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecAd.fois"
        params = {
            "downloadYn": "1",
            "srchFir": "RKRR",
            "srchSeries": "C",
            "srchAd": airport,
            "srchValid": today,
            "srchValidsh": f"{today_short}2359",
            "srchValidsh2": f"{today_short}0000",
            "srchValid2": "1",
            "cmd": "get-records",
            "limit": "1000",
            "offset": "0"
        }

        try:
            response = self.session.get(url, params=params, headers=self._get_headers(), timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"AD NOTAM 수집 실패: {e}")
        return None

    def fetch_snowtam(self):
        """SNOWTAM 수집"""
        logger.info("SNOWTAM 수집")
        url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSnow.fois"
        params = {
            "downloadYn": "1",
            "printYn": "",
            "srchOriginator": "",
            "srchSeq": "",
            "srchAd": "",
            "srchValidFrom": datetime.now().strftime("%Y"),
            "cmd": "get-records",
            "limit": "1000",
            "offset": "0"
        }

        try:
            response = self.session.get(url, params=params, headers=self._get_headers(), timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"SNOWTAM 수집 실패: {e}")
        return None

    def fetch_prohibited_area(self):
        """금지구역 NOTAM 수집"""
        logger.info("금지구역 NOTAM 수집")
        today = datetime.now().strftime("%Y-%m-%d")
        today_short = datetime.now().strftime("%y%m%d")

        url = f"{BASE_URL}/sysUbikais/biz/nps/selectRecOffZone.fois"
        params = {
            "downloadYn": "1",
            "srchFir": "RKRR",
            "srchSeries": "D",
            "srchQcode": "QRP",
            "srchValid": today,
            "srchValidsh": f"{today_short}2359",
            "srchValidsh2": f"{today_short}0000",
            "srchValid2": "1",
            "cmd": "get-records",
            "limit": "1000",
            "offset": "0"
        }

        try:
            response = self.session.get(url, params=params, headers=self._get_headers(), timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"금지구역 NOTAM 수집 실패: {e}")
        return None

    def fetch_sequence_list(self, series="C"):
        """Sequence List 수집"""
        logger.info(f"Sequence List 수집 (Series: {series})")
        url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSeq.fois"
        params = {
            "downloadYn": "1",
            "printYn": "",
            "srchFir": "RKRR",
            "srchSeries": series,
            "srchSeq": "",
            "srchYear": datetime.now().strftime("%y"),
            "cmd": "get-records",
            "limit": "1000",
            "offset": "0"
        }

        try:
            response = self.session.get(url, params=params, headers=self._get_headers(), timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"Sequence List 수집 실패: {e}")
        return None

    def crawl_all(self):
        """모든 NOTAM 크롤링"""
        logger.info("=" * 60)
        logger.info("UBIKAIS 전체 NOTAM 크롤링 시작")
        logger.info("=" * 60)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        all_data = {
            "crawled_at": datetime.now().isoformat(),
            "fir_notam": {},
            "ad_notam": {},
            "snowtam": None,
            "prohibited_area": None,
            "sequence_list": {}
        }

        # FIR NOTAM (모든 시리즈)
        for series in ["C", "A", "D"]:
            result = self.fetch_notam_fir(series)
            if result and result.get("records"):
                all_data["fir_notam"][series] = result
                logger.info(f"  FIR {series}: {result.get('total', len(result.get('records', [])))} records")
            time.sleep(0.5)

        # AD NOTAM (주요 공항)
        airports = ["RKSI", "RKSS", "RKPC", "RKPK", "RKPU", "RKJJ", "RKTN"]
        for airport in airports:
            result = self.fetch_notam_ad(airport)
            if result:
                all_data["ad_notam"][airport] = result
                logger.info(f"  AD {airport}: {result.get('total', len(result.get('records', [])))} records")
            time.sleep(0.3)

        # SNOWTAM
        result = self.fetch_snowtam()
        if result:
            all_data["snowtam"] = result
            logger.info(f"  SNOWTAM: {result.get('total', len(result.get('records', [])))} records")

        # 금지구역
        result = self.fetch_prohibited_area()
        if result:
            all_data["prohibited_area"] = result
            logger.info(f"  Prohibited: {result.get('total', len(result.get('records', [])))} records")

        # Sequence List
        for series in ["C", "A", "D"]:
            result = self.fetch_sequence_list(series)
            if result and result.get("records"):
                all_data["sequence_list"][series] = result
                logger.info(f"  Sequence {series}: {result.get('total', len(result.get('records', [])))} records")
            time.sleep(0.3)

        # 저장
        # 타임스탬프 버전
        output_file = os.path.join(OUTPUT_DIR, f"notam_{timestamp}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        logger.info(f"저장: {output_file}")

        # 최신 버전 (덮어쓰기)
        latest_file = os.path.join(OUTPUT_DIR, "notam_latest.json")
        with open(latest_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        logger.info(f"최신 버전 저장: {latest_file}")

        logger.info("=" * 60)
        logger.info("크롤링 완료!")
        logger.info("=" * 60)

        return all_data

    def run(self):
        """메인 실행 함수"""
        logger.info("UBIKAIS 자동 크롤러 시작")
        logger.info(f"크롤링 간격: {CRAWL_INTERVAL}초")

        def job():
            try:
                if self.login_with_playwright():
                    self.crawl_all()
                else:
                    logger.error("로그인 실패로 크롤링 스킵")
            except Exception as e:
                logger.error(f"크롤링 오류: {e}")

        # 즉시 1회 실행
        job()

        # 스케줄 설정
        schedule.every(CRAWL_INTERVAL).seconds.do(job)

        # 무한 루프
        while True:
            schedule.run_pending()
            time.sleep(60)


if __name__ == "__main__":
    crawler = UBIKAISAutoCrawler()
    crawler.run()
