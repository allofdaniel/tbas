#!/usr/bin/env python3
"""
UBIKAIS API Direct Test
Using session cookie from browser
"""

import requests
import json
from datetime import datetime

# SSL warning disable
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://ubikais.fois.go.kr:8030"

# Session cookie from Playwright browser (update this after fresh login)
JSESSIONID = "asyXmbvs5cCfIMnYG27YTAEtZWSPkbTOb1SEarACmQDh3gjztZ7igVG1kpqQ6uEq.amV1c19kb21haW4vdWJpa2Fpc18y"

def test_api():
    session = requests.Session()
    session.verify = False

    # Set cookies using requests.cookies.set with proper parameters
    session.cookies.set("JSESSIONID", JSESSIONID, domain="ubikais.fois.go.kr", path="/")
    session.cookies.set("SCOUTER", "x1tua7ph2435ed", domain="ubikais.fois.go.kr", path="/")

    # Common headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{BASE_URL}/sysUbikais/biz/nps/notamRecFir"
    }

    today = datetime.now().strftime("%Y-%m-%d")
    today_short = datetime.now().strftime("%y%m%d")

    print("=" * 60)
    print("Testing RK NOTAM API")
    print("=" * 60)

    # RK NOTAM API
    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecFir.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "srchAd": "RKRR",
        "srchSeries": "C",
        "srchValid": today,
        "srchValidsh": f"{today_short}2359",
        "srchValidsh2": f"{today_short}0000",
        "srchValid2": "1",
        "cmd": "get-records",
        "limit": "100",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"\nResponse type: {type(data)}")
            if isinstance(data, dict):
                print(f"Keys: {data.keys()}")
                if 'list' in data:
                    print(f"Records count: {len(data['list'])}")
                    if data['list']:
                        print("\nFirst NOTAM sample:")
                        print(json.dumps(data['list'][0], indent=2, ensure_ascii=False))
            else:
                print(f"Data: {data}")

            # Save to file
            with open("./data/rk_notam_test.json", 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("\nSaved to ./data/rk_notam_test.json")

        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Response text (first 500 chars): {response.text[:500]}")
    else:
        print(f"Request failed: {response.status_code}")
        print(f"Response: {response.text[:500]}")

    print("\n" + "=" * 60)
    print("Testing AD NOTAM API (RKSI)")
    print("=" * 60)

    # AD NOTAM API - srchFir is required!
    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecAd.fois"
    params = {
        "downloadYn": "1",
        "srchFir": "RKRR",
        "srchSeries": "C",
        "srchAd": "RKSI",
        "srchValid": today,
        "srchValidsh": f"{today_short}2359",
        "srchValidsh2": f"{today_short}0000",
        "srchValid2": "1",
        "cmd": "get-records",
        "limit": "100",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, dict) and 'list' in data:
                print(f"Records count: {len(data['list'])}")
                if data['list']:
                    print("\nFirst AD NOTAM sample:")
                    print(json.dumps(data['list'][0], indent=2, ensure_ascii=False))

            with open("./data/ad_notam_rksi_test.json", 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("\nSaved to ./data/ad_notam_rksi_test.json")

        except json.JSONDecodeError:
            print(f"JSON parse error. Response: {response.text[:500]}")

    print("\n" + "=" * 60)
    print("Testing IFR Departure API")
    print("=" * 60)

    # IFR Departure
    url = f"{BASE_URL}/sysUbikais/biz/fpl/selectDep.fois"
    params = {
        "srchAd": "RKSI",
        "cmd": "get-records",
        "limit": "100",
        "offset": "0"
    }

    response = session.get(url, params=params, headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, dict) and 'list' in data:
                print(f"IFR Departure count: {len(data['list'])}")
                if data['list']:
                    print("\nFirst IFR Departure sample:")
                    print(json.dumps(data['list'][0], indent=2, ensure_ascii=False))

            with open("./data/ifr_dep_rksi_test.json", 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("\nSaved to ./data/ifr_dep_rksi_test.json")

        except json.JSONDecodeError:
            print(f"JSON parse error. Response: {response.text[:500]}")

if __name__ == "__main__":
    import os
    os.makedirs("./data", exist_ok=True)
    test_api()
