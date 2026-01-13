# UBIKAIS 크롤러

한국 공역 정보 시스템(UBIKAIS)에서 항공 데이터를 실시간으로 수집하는 크롤러입니다.

## 수집 데이터

### 비행계획 (i-ARO)
- IFR 출발/도착 비행계획 (600+ 건/일)
- VFR 비행계획
- ULP/LSA 비행계획

### NOTAM
- FIR NOTAM (RK NOTAM)
- AD NOTAM (공항별)
- SNOWTAM
- 금지구역 NOTAM
- Sequence List

### 기상 데이터
- METAR/SPECI (30분 간격)
- TAF (6시간 예보)
- SIGMET (중요 기상정보)

### AERO-DATA
- 공항 데이터 (16개 공항)
- 활주로 데이터
- 주기장 데이터
- NAVaid (항행안전시설)
- 장애물 데이터

### ATFM
- Daily Plan
- ATFM Message

## 빠른 시작

### Docker Compose 사용 (권장)

```bash
# 1. .env 파일 생성
cp .env.example .env

# 2. .env 파일 편집하여 인증 정보 입력
nano .env

# 3. 컨테이너 시작
docker-compose up -d

# 4. 로그 확인
docker-compose logs -f
```

### 직접 실행

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 환경 변수 설정
export UBIKAIS_USERNAME=your_username
export UBIKAIS_PASSWORD=your_password

# 3. 전체 크롤링 (1회)
python ubikais_crawler.py --mode full

# 4. 실시간 크롤링 (5분 간격)
python ubikais_crawler.py --mode realtime --interval 300
```

## NAS 배포

### Synology NAS

1. Container Manager 앱 설치
2. 이 디렉토리를 NAS에 업로드
3. docker-compose.yml 사용하여 컨테이너 생성
4. 자동 시작 설정

### QNAP NAS

1. Container Station 앱 사용
2. docker-compose 또는 수동 컨테이너 생성

## 출력 파일

```
data/
├── flight_schedule.json      # 현재 비행계획 (실시간 업데이트)
├── weather_current.json      # 현재 기상 데이터
├── notam_current.json        # 현재 NOTAM
├── realtime_current.json     # 메인 페이지 실시간 데이터
├── ubikais_full_YYYYMMDD_HHMMSS.json  # 전체 데이터 스냅샷
└── scheduler.log             # 스케줄러 로그
```

## API 엔드포인트

헬스 체크:
- `http://localhost:8080/health` - 상태 확인
- `http://localhost:8080/status` - 상세 상태

데이터 서버 (webserver 프로필):
- `http://localhost:8081/flight_schedule.json`
- `http://localhost:8081/weather_current.json`

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| UBIKAIS_USERNAME | 로그인 아이디 | - |
| UBIKAIS_PASSWORD | 로그인 비밀번호 | - |
| CRAWL_MODE | full 또는 realtime | realtime |
| CRAWL_INTERVAL | 크롤링 간격(초) | 300 |
| FULL_CRAWL_HOUR | 전체 크롤링 시간(0-23) | 6 |

## 주의사항

- UBIKAIS 계정이 필요합니다
- 과도한 요청은 서버에 부담을 줄 수 있으므로 적절한 간격 설정 권장
- 수집된 데이터는 비상업적 용도로만 사용

## RKPU Viewer 연동

크롤링된 데이터를 RKPU Viewer에서 사용:

1. `flight_schedule.json`을 RKPU Viewer의 `public/` 디렉토리로 복사
2. 또는 데이터 서버 URL을 API 설정에 추가

---

*UBIKAIS Crawler for RKPU Viewer*
