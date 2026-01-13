#!/usr/bin/env python3
"""
UBIKAIS Full Crawl Test
Tests all NOTAM types and AERO-DATA APIs
"""

import requests
import json
import os
from datetime import datetime

# SSL warning disable
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://ubikais.fois.go.kr:8030"

# Credentials
USERNAME = os.environ.get("UBIKAIS_USERNAME", "allofdanie")
PASSWORD = os.environ.get("UBIKAIS_PASSWORD", "pr12pr34!!")

def login(session):
    """UBIKAIS login using correct endpoint"""
    print("=" * 60)
    print("Logging in to UBIKAIS...")
    print("=" * 60)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    # Step 1: Get login page to initialize session
    login_page = session.get(
        f"{BASE_URL}/common/login",
        params={"systemId": "sysUbikais"},
        headers=headers
    )
    print(f"Login page: {login_page.status_code}")

    # Step 2: Submit login form
    login_data = {
        "userId": USERNAME,
        "userPw": PASSWORD,
        "systemId": "sysUbikais"
    }

    login_response = session.post(
        f"{BASE_URL}/common/loginProc",
        data=login_data,
        headers={
            **headers,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{BASE_URL}/common/login?systemId=sysUbikais"
        },
        allow_redirects=True
    )
    print(f"Login response: {login_response.status_code}")

    # Step 3: Access main page to verify login
    main_page = session.get(
        f"{BASE_URL}/sysUbikais/biz/main.ubikais",
        headers=headers
    )
    print(f"Main page: {main_page.status_code}")

    # Check if login was successful
    if "Logout" in main_page.text or "logout" in main_page.text.lower():
        print("[SUCCESS] Login successful!")
        return True
    else:
        print("[FAILED] Login failed")
        return False

def get_common_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
    }

def fetch_rk_notam(session, series="C"):
    """Fetch RK NOTAM (FIR NOTAM)"""
    print("\n[1] Fetching RK NOTAM...")

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
        "limit": "500",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"    Found {len(records)} RK NOTAMs (series {series})")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_ad_notam(session, airport="RKSI", series="C"):
    """Fetch AD NOTAM for specific airport"""
    print(f"\n[2] Fetching AD NOTAM ({airport})...")

    today = datetime.now().strftime("%Y-%m-%d")
    today_short = datetime.now().strftime("%y%m%d")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecAd.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "srchSeries": series,
        "srchAd": airport,
        "srchValid": today,
        "srchValidsh": f"{today_short}2359",
        "srchValidsh2": f"{today_short}0000",
        "srchValid2": "1",
        "cmd": "get-records",
        "limit": "500",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"    Found {len(records)} AD NOTAMs for {airport}")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_snowtam(session):
    """Fetch SNOWTAM"""
    print("\n[3] Fetching SNOWTAM...")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSnow.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "cmd": "get-records",
        "limit": "100",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"    Found {len(records)} SNOWTAMs")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_prohibited_area(session):
    """Fetch Prohibited Area NOTAM"""
    print("\n[4] Fetching PROHIBITED AREA...")

    today = datetime.now().strftime("%Y-%m-%d")
    today_short = datetime.now().strftime("%y%m%d")

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecOff.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "srchValid": today,
        "srchValidsh": f"{today_short}2359",
        "srchValidsh2": f"{today_short}0000",
        "srchValid2": "1",
        "cmd": "get-records",
        "limit": "500",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"    Found {len(records)} Prohibited Area NOTAMs")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_airport_data(session, airport="RKPU"):
    """Fetch Airport AERO-DATA"""
    print(f"\n[5] Fetching Airport Data ({airport})...")

    today = datetime.now().strftime("%Y%m%d")

    url = f"{BASE_URL}/sysUbikais/biz/ais/airport/select.fois"
    params = {
        "today": today,
        "srchAd": airport
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"    Airport data received")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_runway_data(session, airport="RKPU"):
    """Fetch Runway AERO-DATA"""
    print(f"\n[6] Fetching Runway Data ({airport})...")

    today = datetime.now().strftime("%Y%m%d")

    url = f"{BASE_URL}/sysUbikais/biz/ais/runway/select.fois"
    params = {
        "today": today,
        "srchAd": airport
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"    Runway data received")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_metar(session, airport="RKSI"):
    """Fetch METAR data"""
    print(f"\n[7] Fetching METAR ({airport})...")

    url = f"{BASE_URL}/sysUbikais/biz/wis/selectMetar.fois"
    params = {
        "srchAd": airport,
        "cmd": "get-records",
        "limit": "50",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"    Found {len(records)} METAR records")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def fetch_ifr_departures(session, airport="RKSI"):
    """Fetch IFR Departure list"""
    print(f"\n[8] Fetching IFR Departures ({airport})...")

    url = f"{BASE_URL}/sysUbikais/biz/fpl/selectDep.fois"
    params = {
        "srchAd": airport,
        "cmd": "get-records",
        "limit": "200",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=get_common_headers())

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('list', data.get('records', []))
            print(f"    Found {len(records)} IFR departures")
            return data
        except json.JSONDecodeError:
            print(f"    JSON parse error (may need page navigation first)")
    else:
        print(f"    Request failed: {response.status_code}")

    return None

def main():
    print("=" * 70)
    print("UBIKAIS Full Crawl Test")
    print("=" * 70)

    os.makedirs("./data", exist_ok=True)

    session = requests.Session()
    session.verify = False

    if not login(session):
        print("\nLogin failed. Cannot continue.")
        return

    all_data = {}

    # 1. RK NOTAM (all series)
    for series in ["C", "A", "D"]:
        data = fetch_rk_notam(session, series)
        if data and data.get('records'):
            all_data[f'rk_notam_{series}'] = data

    # 2. AD NOTAM for major airports
    airports = ["RKSI", "RKSS", "RKPC", "RKPK", "RKPU"]
    for airport in airports:
        data = fetch_ad_notam(session, airport)
        if data:
            all_data[f'ad_notam_{airport}'] = data

    # 3. SNOWTAM
    data = fetch_snowtam(session)
    if data:
        all_data['snowtam'] = data

    # 4. Prohibited Area
    data = fetch_prohibited_area(session)
    if data:
        all_data['prohibited_area'] = data

    # 5. Airport Data (RKPU - Ulsan)
    data = fetch_airport_data(session, "RKPU")
    if data:
        all_data['airport_RKPU'] = data

    # 6. Runway Data (RKPU)
    data = fetch_runway_data(session, "RKPU")
    if data:
        all_data['runway_RKPU'] = data

    # 7. METAR
    data = fetch_metar(session, "RKSI")
    if data:
        all_data['metar_RKSI'] = data

    # 8. IFR Departures
    data = fetch_ifr_departures(session, "RKSI")
    if data:
        all_data['ifr_dep_RKSI'] = data

    # Save all data
    output_file = f"./data/ubikais_full_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print(f"Crawl Complete!")
    print(f"Output: {output_file}")
    print("=" * 70)

    # Summary
    print("\nData Summary:")
    for key, value in all_data.items():
        if isinstance(value, dict):
            records = value.get('records', value.get('list', []))
            if isinstance(records, list):
                print(f"  - {key}: {len(records)} records")
            else:
                print(f"  - {key}: data present")
        else:
            print(f"  - {key}: {type(value)}")

if __name__ == "__main__":
    main()
