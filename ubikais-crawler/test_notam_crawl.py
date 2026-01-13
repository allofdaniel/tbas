#!/usr/bin/env python3
"""
UBIKAIS NOTAM 크롤링 테스트
실제로 NOTAM 데이터를 가져와서 확인

사용법:
    python test_notam_crawl.py
"""

import requests
import json
import os
from datetime import datetime

# SSL 경고 비활성화
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://ubikais.fois.go.kr:8030"

# 인증 정보
USERNAME = os.environ.get("UBIKAIS_USERNAME", "allofdanie")
PASSWORD = os.environ.get("UBIKAIS_PASSWORD", "pr12pr34!!")

def login(session):
    """UBIKAIS 로그인 (올바른 엔드포인트 사용)"""
    print("로그인 시도...")

    # 1. 로그인 페이지 접속 (세션 초기화)
    login_page = session.get(
        f"{BASE_URL}/common/login",
        params={"systemId": "sysUbikais"},
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    )
    print(f"로그인 페이지 접속: {login_page.status_code}")

    # 2. 로그인 요청 (올바른 엔드포인트: /common/loginProc)
    login_data = {
        "userId": USERNAME,
        "userPw": PASSWORD,
        "systemId": "sysUbikais"
    }

    response = session.post(
        f"{BASE_URL}/common/loginProc",
        data=login_data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{BASE_URL}/common/login?systemId=sysUbikais",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    )
    print(f"로그인 요청 응답: {response.status_code}")

    # 리다이렉트 확인
    if response.history:
        print(f"리다이렉트: {[r.url for r in response.history]}")

    # 3. 메인 페이지 접속하여 로그인 확인
    main_response = session.get(f"{BASE_URL}/sysUbikais/biz/main.ubikais")
    print(f"메인 페이지 응답: {main_response.status_code}")

    # 로그인 성공 여부 확인
    if "logout" in main_response.text.lower() or "Logout" in main_response.text or USERNAME in main_response.text:
        print("[OK] Login Success!")
        return True
    else:
        print("[FAIL] Login Failed")
        # 디버깅용 출력
        print(f"Response snippet: {main_response.text[:500]}")
        return False

def get_notam_fir(session):
    """FIR NOTAM (RK NOTAM) 가져오기"""
    print("\n" + "=" * 50)
    print("FIR NOTAM (RK NOTAM) 수집 중...")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecFir.fois"
    params = {
        "cmd": "get-records",
        "limit": 100,
        "offset": 0
    }

    response = session.get(url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"응답 키: {data.keys() if isinstance(data, dict) else 'list'}")

            # 데이터 구조 확인
            if isinstance(data, dict):
                if 'list' in data:
                    records = data['list']
                elif 'records' in data:
                    records = data['records']
                elif 'data' in data:
                    records = data['data']
                else:
                    records = data

                print(f"레코드 수: {len(records) if isinstance(records, list) else 'N/A'}")

                if isinstance(records, list) and len(records) > 0:
                    print("\n첫 번째 NOTAM 샘플:")
                    print(json.dumps(records[0], indent=2, ensure_ascii=False))
                    return records
            else:
                print("응답이 dict가 아님")
                print(json.dumps(data[:2] if isinstance(data, list) else data, indent=2, ensure_ascii=False))
                return data

        except json.JSONDecodeError:
            print(f"JSON 파싱 실패. 원본 응답:\n{response.text[:500]}")
    else:
        print(f"요청 실패: {response.status_code}")

    return None

def get_notam_ad(session, airport="RKSI"):
    """AD NOTAM (공항별) 가져오기"""
    print("\n" + "=" * 50)
    print(f"AD NOTAM ({airport}) 수집 중...")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecAd.fois"
    params = {
        "srchAd": airport,
        "cmd": "get-records",
        "limit": 100,
        "offset": 0
    }

    response = session.get(url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"응답 키: {data.keys() if isinstance(data, dict) else 'list'}")

            if isinstance(data, dict):
                records = data.get('list') or data.get('records') or data.get('data') or data
                print(f"레코드 수: {len(records) if isinstance(records, list) else 'N/A'}")

                if isinstance(records, list) and len(records) > 0:
                    print("\n첫 번째 AD NOTAM 샘플:")
                    print(json.dumps(records[0], indent=2, ensure_ascii=False))
                    return records

        except json.JSONDecodeError:
            print(f"JSON 파싱 실패")
    else:
        print(f"요청 실패: {response.status_code}")

    return None

def get_snowtam(session):
    """SNOWTAM 가져오기"""
    print("\n" + "=" * 50)
    print("SNOWTAM 수집 중...")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSnow.fois"
    params = {
        "cmd": "get-records",
        "limit": 50,
        "offset": 0
    }

    response = session.get(url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"응답 키: {data.keys() if isinstance(data, dict) else type(data)}")

            if isinstance(data, dict):
                records = data.get('list') or data.get('records') or []
                print(f"SNOWTAM 수: {len(records)}")
                if records:
                    print("\n첫 번째 SNOWTAM:")
                    print(json.dumps(records[0], indent=2, ensure_ascii=False))
                return records

        except json.JSONDecodeError:
            print(f"JSON 파싱 실패")

    return None

def get_prohibited_area(session):
    """금지구역 NOTAM 가져오기"""
    print("\n" + "=" * 50)
    print("금지구역 NOTAM 수집 중...")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecOff.fois"
    params = {
        "cmd": "get-records",
        "limit": 100,
        "offset": 0
    }

    response = session.get(url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"응답 키: {data.keys() if isinstance(data, dict) else type(data)}")

            if isinstance(data, dict):
                records = data.get('list') or data.get('records') or []
                print(f"금지구역 NOTAM 수: {len(records)}")
                if records:
                    print("\n첫 번째 금지구역 NOTAM:")
                    print(json.dumps(records[0], indent=2, ensure_ascii=False))
                return records

        except json.JSONDecodeError:
            print(f"JSON 파싱 실패")

    return None

def get_aero_data(session, data_type="airport", airport="RKSI"):
    """AERO-DATA 가져오기"""
    print("\n" + "=" * 50)
    print(f"AERO-DATA ({data_type} - {airport}) 수집 중...")

    endpoints = {
        "airport": "/sysUbikais/biz/ais/airport/select.fois",
        "runway": "/sysUbikais/biz/ais/runway/select.fois",
        "apron": "/sysUbikais/biz/ais/apron/select.fois",
        "navaid": "/sysUbikais/biz/ais/navaid/select.fois",
        "obstacle": "/sysUbikais/biz/ais/obst/select.fois",
    }

    url = f"{BASE_URL}{endpoints.get(data_type, endpoints['airport'])}"
    params = {
        "today": datetime.now().strftime("%Y%m%d"),
        "srchAd": airport
    }

    response = session.get(url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"응답: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}...")
            return data
        except json.JSONDecodeError:
            print(f"JSON 파싱 실패")

    return None

def main():
    print("=" * 60)
    print("UBIKAIS NOTAM 크롤링 테스트")
    print("=" * 60)

    session = requests.Session()
    session.verify = False

    if not login(session):
        print("로그인 실패. 종료합니다.")
        return

    # 데이터 수집
    all_data = {}

    # 1. FIR NOTAM
    fir_notam = get_notam_fir(session)
    if fir_notam:
        all_data['notam_fir'] = fir_notam

    # 2. AD NOTAM (인천)
    ad_notam = get_notam_ad(session, "RKSI")
    if ad_notam:
        all_data['notam_ad_rksi'] = ad_notam

    # 3. AD NOTAM (울산)
    ad_notam_rkpu = get_notam_ad(session, "RKPU")
    if ad_notam_rkpu:
        all_data['notam_ad_rkpu'] = ad_notam_rkpu

    # 4. SNOWTAM
    snowtam = get_snowtam(session)
    if snowtam:
        all_data['snowtam'] = snowtam

    # 5. 금지구역
    prohibited = get_prohibited_area(session)
    if prohibited:
        all_data['prohibited'] = prohibited

    # 6. AERO-DATA (공항)
    airport_data = get_aero_data(session, "airport", "RKPU")
    if airport_data:
        all_data['airport_rkpu'] = airport_data

    # 7. AERO-DATA (활주로)
    runway_data = get_aero_data(session, "runway", "RKPU")
    if runway_data:
        all_data['runway_rkpu'] = runway_data

    # 결과 저장
    os.makedirs("./data", exist_ok=True)
    output_file = f"./data/notam_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"테스트 완료! 결과 저장: {output_file}")
    print("=" * 60)

    # 요약
    print("\n수집 데이터 요약:")
    for key, value in all_data.items():
        if isinstance(value, list):
            print(f"  - {key}: {len(value)}건")
        else:
            print(f"  - {key}: 데이터 있음")


if __name__ == "__main__":
    main()
