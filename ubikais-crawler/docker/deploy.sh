#!/bin/bash
# Proxmox 서버에서 실행하는 배포 스크립트

echo "====================================="
echo "UBIKAIS Crawler Docker 배포"
echo "====================================="

# 디렉토리 이동
cd /opt/ubikais-crawler

# 이전 컨테이너 정리
echo "[1/4] 기존 컨테이너 정리..."
docker-compose down 2>/dev/null || true

# 이미지 빌드
echo "[2/4] Docker 이미지 빌드..."
docker-compose build --no-cache

# 컨테이너 시작
echo "[3/4] 컨테이너 시작..."
docker-compose up -d

# 상태 확인
echo "[4/4] 상태 확인..."
sleep 5
docker-compose logs --tail=20

echo ""
echo "====================================="
echo "배포 완료!"
echo "====================================="
echo ""
echo "명령어:"
echo "  로그 확인: docker-compose logs -f"
echo "  상태 확인: docker-compose ps"
echo "  중지:      docker-compose down"
echo "  데이터:    ls -la ./data/"
echo ""
