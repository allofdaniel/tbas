#!/usr/bin/env python3
"""
UBIKAIS 크롤러 스케줄러
Docker 컨테이너에서 주기적으로 크롤링 실행

환경 변수:
- UBIKAIS_USERNAME: 로그인 아이디
- UBIKAIS_PASSWORD: 로그인 비밀번호
- CRAWL_MODE: full(전체) 또는 realtime(실시간)
- CRAWL_INTERVAL: 크롤링 간격(초), 기본값 300초(5분)
- FULL_CRAWL_HOUR: 전체 크롤링 시간(0-23), 기본값 6
"""

import os
import time
import logging
import schedule
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import json

from ubikais_crawler import UBIKAISCrawler

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/data/scheduler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 전역 상태
crawler_status = {
    "last_crawl": None,
    "last_success": True,
    "crawl_count": 0,
    "error_count": 0,
    "running": False
}


class HealthCheckHandler(BaseHTTPRequestHandler):
    """헬스 체크 HTTP 핸들러"""

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "last_crawl": crawler_status["last_crawl"],
                "last_success": crawler_status["last_success"],
                "crawl_count": crawler_status["crawl_count"]
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(crawler_status).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # 로그 비활성화


def start_health_server():
    """헬스 체크 서버 시작"""
    server = HTTPServer(('0.0.0.0', 8080), HealthCheckHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info("헬스 체크 서버 시작: http://0.0.0.0:8080/health")


def run_crawl(mode: str = "realtime"):
    """크롤링 실행"""
    global crawler_status

    if crawler_status["running"]:
        logger.warning("이미 크롤링 실행 중")
        return

    username = os.environ.get("UBIKAIS_USERNAME")
    password = os.environ.get("UBIKAIS_PASSWORD")

    if not username or not password:
        logger.error("UBIKAIS 인증 정보가 설정되지 않음")
        return

    crawler_status["running"] = True

    try:
        crawler = UBIKAISCrawler(username, password, "/app/data")

        if not crawler.login():
            raise Exception("로그인 실패")

        if mode == "full":
            logger.info("전체 크롤링 시작")
            crawler.crawl_all()
        else:
            logger.info("실시간 크롤링 시작")
            crawler.crawl_realtime()

        crawler_status["last_crawl"] = datetime.now().isoformat()
        crawler_status["last_success"] = True
        crawler_status["crawl_count"] += 1
        logger.info("크롤링 완료")

    except Exception as e:
        logger.error(f"크롤링 오류: {e}")
        crawler_status["last_success"] = False
        crawler_status["error_count"] += 1

    finally:
        crawler_status["running"] = False


def main():
    """메인 스케줄러"""
    logger.info("=" * 50)
    logger.info("UBIKAIS 크롤러 스케줄러 시작")
    logger.info("=" * 50)

    # 환경 변수 읽기
    mode = os.environ.get("CRAWL_MODE", "realtime")
    interval = int(os.environ.get("CRAWL_INTERVAL", "300"))
    full_crawl_hour = int(os.environ.get("FULL_CRAWL_HOUR", "6"))

    logger.info(f"크롤링 모드: {mode}")
    logger.info(f"크롤링 간격: {interval}초")
    logger.info(f"전체 크롤링 시간: {full_crawl_hour}시")

    # 헬스 체크 서버 시작
    start_health_server()

    # 시작 시 1회 실행
    logger.info("초기 크롤링 실행...")
    run_crawl(mode)

    # 스케줄 설정
    if mode == "realtime":
        # 실시간 모드: 지정 간격으로 실시간 크롤링
        schedule.every(interval).seconds.do(run_crawl, mode="realtime")
        # 매일 지정 시간에 전체 크롤링
        schedule.every().day.at(f"{full_crawl_hour:02d}:00").do(run_crawl, mode="full")
    else:
        # 전체 모드: 지정 간격으로 전체 크롤링
        schedule.every(interval).seconds.do(run_crawl, mode="full")

    logger.info("스케줄러 대기 중...")

    # 스케줄러 실행
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()
