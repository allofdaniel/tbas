# 통합 항공 데이터 크롤러
# UBIKAIS, AIM Korea, 항공기상, 인천공항

FROM mcr.microsoft.com/playwright/python:v1.57.0-noble

WORKDIR /app

# Python 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 크롤러 스크립트 복사
COPY unified_crawler.py .
COPY auto_crawler.py .

# 데이터 디렉토리
RUN mkdir -p /data/ubikais /data/aim /data/weather /data/airport

# 환경변수
ENV UBIKAIS_USERNAME=allofdanie
ENV UBIKAIS_PASSWORD=pr12pr34!!
ENV OUTPUT_DIR=/data
ENV CRAWL_INTERVAL=3600

# 실행 (통합 크롤러)
CMD ["python", "-u", "unified_crawler.py"]
