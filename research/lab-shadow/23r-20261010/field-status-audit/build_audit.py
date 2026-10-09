"""Produce NEW audit output from unchanged RAW and previously saved HTML."""
import json,pathlib,datetime,hashlib
from field_status import parse_card
ROOT=pathlib.Path(__file__).resolve().parent; BASE=ROOT.parent
raw_path=BASE/'2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json';raw=json.loads(raw_path.read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat(); output=[]
for race in raw['races']:
    horses=[{'horse_no':h['horse_no'],'horse_name':h['horse_name'],'raw_status':h['status'],'current_status':None,'verification':'UNVERIFIED','reason':'FRESH_OFFICIAL_FETCH_UNAVAILABLE'} for h in race['runners']]
    record={'track':race['track'],'race_no':race['race_no'],'official_url':race['official_url'],'latest_verification':'UNVERIFIED','official_latest_count':None,'raw_listed_count':len(horses),'raw_active_nos':[h['horse_no'] for h in race['runners'] if h['status']=='ACTIVE'],'raw_cancelled_nos':[h['horse_no'] for h in race['runners'] if h['status']=='CANCELLED'],'raw_excluded_nos':[h['horse_no'] for h in race['runners'] if h['status']=='EXCLUDED'],'corrected_latest_active_nos':None,'horses':horses}
    if race['track']=='高知' and race['race_no']==3:
        path=BASE/'official-history-pilot/evidence/kochi3-card.html';meta=json.loads((BASE/'official-history-pilot/card-fetch.json').read_text())
        if hashlib.sha256(path.read_bytes()).hexdigest()!=meta['sha256']:raise ValueError('ARCHIVED_HTML_HASH_MISMATCH')
        rows=parse_card(path.read_text(),race)
        record['archived_comparison']={'captured_at':meta['download_completed_at'],'html_path':'../official-history-pilot/evidence/kochi3-card.html','sha256':meta['sha256'],'official_listed_count':len(rows),'active_nos':[h['horse_no'] for h in rows if h['archive_status']=='ACTIVE'],'cancelled_nos':[h['horse_no'] for h in rows if h['archive_status']=='CANCELLED'],'horses':rows,'difference_from_raw':[{'horse_no':r['horse_no'],'raw_status':h['status'],'archive_status':r['archive_status']} for r in rows for h in race['runners'] if r['horse_no']==h['horse_no'] and r['archive_status']!=h['status']]}
    output.append(record)
result={'audited_at':now,'source_commit':'d801233e5dee49bb5db37367b05ba047de6ecb21','raw_sha256':hashlib.sha256(raw_path.read_bytes()).hexdigest(),'network_attempt':{'url':next(r['official_url'] for r in raw['races'] if r['track']=='高知' and r['race_no']==3),'curl_exit':7,'http_status':0,'error':'Failed to connect to proxy port 8080','attempted_requests':1,'remaining_requests':'NOT_ATTEMPTED_SHARED_CONNECTION_FAILURE'},'latest_verified_races':0,'corrected_latest_active_total':None,'ready_changed':False,'races':output}
with (ROOT/'audit-results.json').open('x') as f:json.dump(result,f,ensure_ascii=False,indent=2);f.write('\n')
print('23 latest race states UNVERIFIED; archived Kochi3 comparison saved separately.')
