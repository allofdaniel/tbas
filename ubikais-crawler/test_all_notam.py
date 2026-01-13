#!/usr/bin/env python3
"""
UBIKAIS All NOTAM Types Test
Using session cookie from browser - tests all NOTAM types
"""

import requests
import json
import os
from datetime import datetime

# SSL warning disable
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://ubikais.fois.go.kr:8030"

# Session cookie from Playwright browser (update this after fresh login)
JSESSIONID = "asyXmbvs5cCfIMnYG27YTAEtZWSPkbTOb1SEarACmQDh3gjztZ7igVG1kpqQ6uEq.amV1c19kb21haW4vdWJpa2Fpc18y"

def get_session():
    session = requests.Session()
    session.verify = False
    session.cookies.set("JSESSIONID", JSESSIONID, domain="ubikais.fois.go.kr", path="/")
    session.cookies.set("SCOUTER", "x1tua7ph2435ed", domain="ubikais.fois.go.kr", path="/")
    return session

def get_headers(referer=None):
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": referer or f"{BASE_URL}/sysUbikais/biz/nps/notamRecFir"
    }

def fetch_rk_notam(session, series="C"):
    """Fetch RK NOTAM (FIR NOTAM)"""
    print(f"\n{'='*60}")
    print(f"Fetching RK NOTAM (Series: {series})")
    print('='*60)

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

    response = session.get(url, params=params, headers=get_headers())
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"Total: {data.get('total', len(records))} records")

            if records:
                print(f"\nSample NOTAM (first):")
                sample = records[0]
                print(f"  ID: {sample.get('ntmPk')}")
                print(f"  Series/Year/Seq: {sample.get('ntSeries')}{sample.get('ntSndSeq')}/{sample.get('ntYear')}")
                print(f"  FIR: {sample.get('ntFir')}")
                print(f"  Code: {sample.get('ntCode')}")
                print(f"  Valid: {sample.get('ntStartDate')} - {sample.get('ntEndDate')}")

            return data
        except json.JSONDecodeError:
            print(f"JSON parse error: {response.text[:200]}")
    return None

def fetch_ad_notam(session, airport="RKSI"):
    """Fetch AD NOTAM for specific airport"""
    print(f"\n{'='*60}")
    print(f"Fetching AD NOTAM ({airport})")
    print('='*60)

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
        "limit": "500",
        "offset": "0"
    }

    headers = get_headers(f"{BASE_URL}/sysUbikais/biz/nps/notamRecAd")
    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"Total: {data.get('total', len(records))} records")
            return data
        except json.JSONDecodeError:
            print(f"JSON parse error: {response.text[:200]}")
    return None

def fetch_snowtam(session):
    """Fetch SNOWTAM"""
    print(f"\n{'='*60}")
    print("Fetching SNOWTAM")
    print('='*60)

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSnow.fois"
    # Correct params discovered from network capture - requires srchValidFrom (year)
    params = {
        "downloadYn": "1",
        "printYn": "",
        "srchOriginator": "",
        "srchSeq": "",
        "srchAd": "",
        "srchValidFrom": datetime.now().strftime("%Y"),  # Year only (e.g., "2026")
        "cmd": "get-records",
        "limit": "500",
        "offset": "0"
    }

    headers = get_headers(f"{BASE_URL}/sysUbikais/biz/nps/notamRecSnow")
    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"Total: {data.get('total', len(records))} records")

            if records:
                print(f"\nSample SNOWTAM (first):")
                sample = records[0]
                print(f"  ID: {sample.get('stmPk')}")
                print(f"  Airport: {sample.get('apIcao')}")
                print(f"  Nation: {sample.get('nation')}")
                print(f"  Seq: {sample.get('stSndSeq')}")
                print(f"  Date: {sample.get('stDate')}")

            return data
        except json.JSONDecodeError:
            print(f"JSON parse error: {response.text[:200]}")
    return None

def fetch_prohibited_area(session):
    """Fetch Prohibited Area NOTAM"""
    print(f"\n{'='*60}")
    print("Fetching PROHIBITED AREA")
    print('='*60)

    today = datetime.now().strftime("%Y-%m-%d")
    today_short = datetime.now().strftime("%y%m%d")

    # Correct endpoint: selectRecOffZone.fois (NOT selectNotamRecOff.fois)
    url = f"{BASE_URL}/sysUbikais/biz/nps/selectRecOffZone.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "srchSeries": "D",
        "srchQcode": "QRP",  # Prohibited area Q-code
        "srchValid": today,
        "srchValidsh": f"{today_short}2359",
        "srchValidsh2": f"{today_short}0000",
        "srchValid2": "1",
        "cmd": "get-records",
        "limit": "500",
        "offset": "0"
    }

    headers = get_headers(f"{BASE_URL}/sysUbikais/biz/nps/notamRecOff")
    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"Total: {data.get('total', len(records))} records")

            if records:
                print(f"\nSample Prohibited Area (first):")
                sample = records[0]
                print(f"  ID: {sample.get('ntmPk')}")
                print(f"  Code: {sample.get('ntCode')}")
                print(f"  Location: {sample.get('ntAd')}")

            return data
        except json.JSONDecodeError:
            print(f"JSON parse error: {response.text[:200]}")
    return None

def fetch_sequence_list(session, series="C"):
    """Fetch NOTAM Sequence List"""
    print(f"\n{'='*60}")
    print(f"Fetching SEQUENCE LIST (Series: {series})")
    print('='*60)

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSeq.fois"
    # Correct params discovered from network capture
    params = {
        "downloadYn": "1",
        "printYn": "",
        "srchFir": "RKRR",
        "srchSeries": series,
        "srchSeq": "",
        "srchYear": datetime.now().strftime("%y"),  # 2-digit year (e.g., "26")
        "cmd": "get-records",
        "limit": "500",
        "offset": "0"
    }

    headers = get_headers(f"{BASE_URL}/sysUbikais/biz/nps/notamRecSeq")
    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            records = data.get('records', [])
            print(f"Total: {data.get('total', len(records))} records")

            if records:
                print(f"\nSample Sequence (first):")
                sample = records[0]
                print(f"  Series: {sample.get('ntSeries')}")
                print(f"  Seq: {sample.get('ntSndSeq')}")
                print(f"  Year: {sample.get('ntYear')}")
                print(f"  Status: {sample.get('ntStatus')}")
                print(f"  FIR: {sample.get('ntFir')}")
                print(f"  Location: {sample.get('ntAd')}")
                print(f"  QCode: {sample.get('ntCode')}")

            return data
        except json.JSONDecodeError:
            print(f"JSON parse error: {response.text[:200]}")
    return None

def main():
    print("=" * 70)
    print("UBIKAIS All NOTAM Types Test")
    print("Using browser session cookie")
    print("=" * 70)

    os.makedirs("./data", exist_ok=True)

    session = get_session()
    all_data = {}

    # 1. RK NOTAM (Series C - default)
    data = fetch_rk_notam(session, "C")
    if data:
        all_data['rk_notam_C'] = data

    # 2. AD NOTAM for multiple airports
    for airport in ["RKSI", "RKPU", "RKPC"]:
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

    # 5. Sequence List
    data = fetch_sequence_list(session)
    if data:
        all_data['sequence_list'] = data

    # Save all data
    output_file = f"./data/all_notam_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total_notams = 0
    for key, value in all_data.items():
        if isinstance(value, dict):
            count = value.get('total', len(value.get('records', [])))
            total_notams += count
            print(f"  {key}: {count} records")

    print(f"\nTotal NOTAMs collected: {total_notams}")
    print(f"Output saved: {output_file}")
    print("=" * 70)

if __name__ == "__main__":
    main()
