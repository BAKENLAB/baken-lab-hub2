"""NAR 2026-05-21 documented ZIP/CSV reader. Private, manually supplied authorized input only."""
import csv, hashlib, io, json, re, zipfile
from datetime import datetime, date
from pathlib import Path

HORSE = {4:'draw',6:'no',7:'name',8:'sex',9:'age',11:'birth',12:'sire',13:'dam',14:'damSire',15:'jockeyName',17:'weight',19:'trainerName',23:'bodyWeight',24:'bodyWeightDelta'}
RACE = {4:'postLiteral',5:'classType',6:'name',22:'surface',23:'direction',24:'distance',25:'weather',26:'going',27:'reportedFieldSize',28:'classLiteral'}
HIST = {32:'finish',33:'clockLiteral',34:'marginLiteral',35:'final600'}
UNITS = {'draw':'ordinal','no':'ordinal','age':'years','weight':'kg','bodyWeight':'kg','bodyWeightDelta':'kg','distance':'m','reportedFieldSize':'horses','finish':'ordinal','final600':'s','clockLiteral':'NAR_MMSSd','marginLiteral':'official_literal','birth':'YYYYMMDD','postLiteral':'HHMM_JST'}

def need(x, msg):
    if not x: raise ValueError(msg)

def when(x):
    d=datetime.fromisoformat(x.replace('Z','+00:00')); need(d.tzinfo is not None,'TIMEZONE_REQUIRED'); return d

def day(x):
    need(bool(re.fullmatch(r'\d{8}',x)), 'DATE'); return datetime.strptime(x,'%Y%m%d').date()

def compact_clock(x):
    need(bool(re.fullmatch(r'\d{3,5}',x)), 'CLOCK_LITERAL')
    sec=int(x[-3:-1]); need(sec<60,'CLOCK_SECONDS'); return int(x[:-3] or '0')*60+sec+int(x[-1])/10

def key(row):
    need(bool(row[0].strip()) and bool(re.fullmatch(r'\d{1,2}',row[2])) and 1<=int(row[2])<=14,'RACE_KEY')
    return (row[0],day(row[1]).isoformat(),int(row[2]))

def rows(z, member, width, encoding, header):
    # Do not guess encoding, column offsets or header mode from data.
    with z.open(member) as raw:
        reader=csv.reader(io.TextIOWrapper(raw,encoding=encoding,errors='strict',newline=''),strict=True)
        if header:
            h=next(reader); need(len(h)==width and h[:3]==['競馬場','競走年月日','レース番号'],'HEADER')
            need((width==36 and h[5]=='馬番' and h[10]=='生年月日' and h[31]=='着順' and h[35]=='人気') or (width==66 and h[23]=='距離' and h[26]=='頭数' and h[50]=='コーナー名称1' and h[58]=='コーナー通過順1'),'HEADER_LAYOUT')
        for i,row in enumerate(reader,2 if header else 1):
            need(len(row)==width,'COLUMN_COUNT'); yield i,row

def read_bundle(path, *, expected_sha256, captured_at, cutoff, post, target, prior_events, encoding, header, permission_ref, source_url):
    need(bool(permission_ref),'PERMISSION_REFERENCE_REQUIRED') # operator receipt, not independent grant
    need(source_url=='https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=daily' or source_url.startswith('https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=monthly'), 'SOURCE_ROUTE')
    need(when(captured_at)<=when(cutoff)<when(post),'PREPOST_CAPTURE_REQUIRED')
    need(encoding in ('utf-8-sig','cp932','shift_jis') and isinstance(header,bool),'EXPLICIT_CSV_FORMAT')
    target=tuple(target); target_day=date.fromisoformat(target[1]); priors={tuple(k) for k in prior_events}
    need(all(date.fromisoformat(k[1])<target_day for k in priors),'PRIOR_DATES_ONLY')
    p=Path(path); need(p.is_file() and p.stat().st_size<=64*1024*1024,'ZIP_FILE_REQUIRED_OR_TOO_LARGE')
    data=p.read_bytes(); sha=hashlib.sha256(data).hexdigest(); need(sha==expected_sha256,'ZIP_HASH')
    events={}; horse_rows={}; missing=[]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries=z.infolist(); need(len(entries)<=8 and len({x.filename for x in entries})==len(entries),'ZIP_ENTRIES')
        members={}
        for x in entries:
            need(not x.is_dir() and re.fullmatch(r'\d{6}(?:\d{2})?_(racelist|horselist|payback)\.csv',x.filename),'UNEXPECTED_MEMBER')
            need(x.file_size<=128*1024*1024 and not x.flag_bits&1,'ZIP_MEMBER_LIMIT')
            kind=x.filename.split('_')[-1]; need(kind not in members,'DUPLICATE_MEMBER_TYPE'); members[kind]=x
        need('racelist.csv' in members and 'horselist.csv' in members,'REQUIRED_CSV')
        need(len({x.filename.split('_')[0] for x in members.values()})==1,'BUNDLE_PERIOD')
        def facts(row, cols, member, line):
            return {k:{'value':row[n-1],'unit':UNITS.get(k,'literal'),'source':source_url,'captureAt':captured_at,'zipSha256':sha,'member':member.filename,'line':line,'column':n} for n,k in cols.items() if row[n-1]!=''}
        for kind,width,cols in [('racelist.csv',66,RACE),('horselist.csv',36,HORSE)]:
            m=members[kind]
            for line,row in rows(z,m,width,encoding,header):
                k=key(row)
                if k!=target and k not in priors: continue
                # Only explicitly prior events may supply results. Popularity, payback never projected.
                f=facts(row,cols,m,line)
                if k in priors:
                    if width==36:
                        f.update(facts(row,HIST,m,line))
                        if 'clockLiteral' in f:
                            try: f['clock']={**f['clockLiteral'],'value':compact_clock(f['clockLiteral']['value']),'unit':'s','derived':'documented compact clock interpretation; verify schema against actual source'}
                            except ValueError: missing.append({'event':k,'line':line,'reason':'CLOCK_LITERAL_HELD'})
                    else:
                        f.update(facts(row,{**{n:f'lapLiteral{n-35}' for n in range(36,51)},**{n:f'cornerLabel{n-50}' for n in range(51,59)},**{n:f'cornerOrderLiteral{n-58}' for n in range(59,67)}},m,line))
                        # Race lap and corner strings preserved, never turned into individual speed or inferred ranks.
                if width==66:
                    need(k not in events,'DUPLICATE_RACE'); events[k]=f
                else:
                    need('no' in f and re.fullmatch(r'\d{1,2}',f['no']['value']) and 1<=int(f['no']['value'])<=24,'HORSE_NO')
                    n=int(f['no']['value']); rr=horse_rows.setdefault(k,{})
                    need(n not in rr,'DUPLICATE_HORSE_NO'); rr[n]={'no':n,'horseId':None,'identityStatus':'CSV_HAS_NO_NATIVE_ID','status':'UNKNOWN','facts':f}
        need(target in events and target in horse_rows,'TARGET_NOT_IN_BUNDLE')
    result=[]
    for k in sorted({target}|priors):
        rr=horse_rows.get(k,{}); context=events.get(k,{})
        reported=context.get('reportedFieldSize',{}).get('value',''); count=int(reported) if reported.isdigit() else None
        result.append({'event':k,'context':context,'roster':[rr[n] for n in sorted(rr)],'reportedCount':count,'rowCountMatches':count==len(rr),'nativeIdentityComplete':False,'fullPriorResultCertified':False,'missingReason':None if rr else 'EVENT_NOT_IN_BUNDLE'})
    return {'schema':'WORK20_NAR_AUTHORIZED_CSV_CANDIDATE_1','source':source_url,'capturedAt':captured_at,'cutoff':cutoff,'post':post,'zipSha256':sha,'permissionRef':permission_ref,'events':result,'held':missing,'formalAdmission':False,'publicationAllowed':False}

if __name__=='__main__':
    import sys
    manifest=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    packet=read_bundle(**manifest)
    print(json.dumps({'schema':packet['schema'],'zipSha256':packet['zipSha256'],'events':[{'event':e['event'],'rows':len(e['roster']),'reportedCount':e['reportedCount'],'rowCountMatches':e['rowCountMatches'],'nativeIdentityComplete':False} for e in packet['events']],'formalAdmission':False},ensure_ascii=False))
