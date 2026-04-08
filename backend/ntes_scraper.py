"""
NTES Scraper v3 — Pure requests, no browser, Redis cache.
"""
import re, time, json
from datetime import datetime, timedelta
from typing import Optional

import requests
import redis as redis_lib
import uvicorn
from fastapi import FastAPI, HTTPException

try:
    redis_client = redis_lib.Redis(host='172.18.0.2', port=6379, db=2, decode_responses=True, socket_connect_timeout=2)
    redis_client.ping()
except Exception:
    try:
        redis_client = redis_lib.Redis(host='localhost', port=6379, db=2, decode_responses=True, socket_connect_timeout=2)
        redis_client.ping()
    except Exception:
        redis_client = None
CACHE_TTL = 300

app = FastAPI(title="NTES Scraper v3")

def fetch_and_parse(train_no: str, date_str: str = None) -> dict:
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
    })

    s.get('https://enquiry.indianrail.gov.in/mntes/', timeout=15)

    r2 = s.get(f'https://enquiry.indianrail.gov.in/mntes/GetCSRFToken?t={int(time.time()*1000)}', timeout=10)
    match = re.search(r"name='([^']+)'.*?value='([^']+)'", r2.text)
    if not match:
        raise Exception("CSRF token not found")
    csrf_name, csrf_value = match.group(1), match.group(2)

    s.headers.update({
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://enquiry.indianrail.gov.in/mntes/',
        'Origin': 'https://enquiry.indianrail.gov.in',
    })
    r3 = s.post('https://enquiry.indianrail.gov.in/mntes/tr', data={
        'opt': 'TrainRunning', 'subOpt': 'FindRunningInstance',
        'trainNo': train_no, 'lan': 'en', csrf_name: csrf_value,
    }, timeout=20)
    html = r3.text

    # Find right date section — prefer running instance
    import re as _re
    now = datetime.now()
    
    if date_str:
        dates_to_try = [date_str]
    else:
        # Try last 3 days to find running/current instance
        dates_to_try = [(now - timedelta(days=i)).strftime('%d-%b-%Y') for i in range(3)]

    section = None
    for d in dates_to_try:
        idx = html.find(f'Start Date : {d}')
        if idx < 0:
            continue
        chunk = html[idx:idx+25000]
        text = re.sub(r'<[^>]+>', ' ', chunk)
        text = re.sub(r'&nbsp;|&times;', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        # Prefer running instance
        if 'Departed from' in text or 'Current Position' in text:
            section = text
            break
        # Keep as fallback
        if section is None:
            section = text

    if not section:
        idx = html.find('dvMainBody')
        chunk = html[idx:idx+25000] if idx >= 0 else html[:25000]
        section = re.sub(r'<[^>]+>', ' ', chunk)
        section = re.sub(r'&nbsp;|&times;', ' ', section)
        section = re.sub(r'\s+', ' ', section).strip()

    result = {
        "train_no": train_no,
        "scraped_at": datetime.now().isoformat(),
        "source": "NTES",
        "cached": False,
    }

    name_m = re.search(rf'{train_no}\s+([A-Z ]+?)(?:Start Date)', section)
    if name_m:
        result['train_name'] = name_m.group(1).strip()

    dep_m = re.search(r"Departed from ([^(]+)\(([A-Z]+)\)[^\d]*(\d{2}:\d{2} \d{2}-\w+)", section)
    if dep_m:
        result.update({
            'last_station_name': dep_m.group(1).strip(),
            'last_station_code': dep_m.group(2),
            'last_event_time': dep_m.group(3),
            'last_event': 'departed',
            'status': 'running',
        })

    up_m = re.search(r'Upcoming Station ([^\(]+)\(([A-Z]+)\)', section)
    if up_m:
        result['next_station_name'] = up_m.group(1).strip()
        result['next_station_code'] = up_m.group(2)

    pct_m = re.search(r'(\d+)%', section)
    if pct_m:
        result['journey_pct'] = int(pct_m.group(1))

    delays = re.findall(r'(\d+) Min', section)
    result['delay_minutes'] = int(delays[-1]) if delays else 0

    upd_m = re.search(r'Last Updates? On ([\d\-A-Za-z]+ [\d:]+)', section)
    if upd_m:
        result['last_updated'] = upd_m.group(1).strip()

    if 'Yet to start' in section or 'yet to start' in section.lower():
        result['status'] = 'not_started'
        result['delay_minutes'] = 0
    elif 'Arrived at Destination' in section:
        result['status'] = 'completed'
    elif 'status' not in result:
        result['status'] = 'unknown'

    return result


@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0"}

@app.get("/train/{train_no}/status")
def get_status(train_no: str, date: Optional[str] = None):
    if not re.match(r'^\d{4,5}$', train_no):
        raise HTTPException(status_code=400, detail="Invalid train number")

    cache_key = f"ntes:{train_no}:{date or 'auto'}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                d = json.loads(cached)
                d['cached'] = True
                return d
        except Exception:
            pass

    try:
        result = fetch_and_parse(train_no, date)
        if redis_client:
            try:
                redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))
            except Exception:
                pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
