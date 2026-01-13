# UBIKAIS Crawler Docker Image
FROM python:3.11-slim

LABEL maintainer="RKPU Viewer Team"
LABEL description="UBIKAIS 한국 공역 정보 시스템 크롤러"

# 작업 디렉토리 설정
WORKDIR /app

# 필요한 패키지 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 크롤러 코드 복사
COPY ubikais_crawler.py .
COPY scheduler.py .

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

# 환경 변수 설정 (실행 시 오버라이드)
ENV UBIKAIS_USERNAME=""
ENV UBIKAIS_PASSWORD=""
ENV CRAWL_MODE="realtime"
ENV CRAWL_INTERVAL="300"
ENV TZ=Asia/Seoul

# 볼륨 마운트 포인트
VOLUME ["/app/data"]

# 헬스체크
HEALTHCHECK --interval=5m --timeout=30s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 기본 실행 명령
CMD ["python", "scheduler.py"]
