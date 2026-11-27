"""Non-network synthetic-only custody prototype, not a production verifier."""
import copy, hashlib, hmac, json, os, re, stat, subprocess, sys, tempfile
from pathlib import Path
KEY=b'PUBLIC-FICTIONAL-TEST-KEY'
LIMIT=131072
class Reject(Exception): pass
def need(ok, code):
    if not ok: raise Reject(code)
def canon(x): return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode()
def sha(b): return hashlib.sha256(b).hexdigest()
def mac(x): return hmac.new(KEY,canon(x),hashlib.sha256).hexdigest()
def signed(m): return {'manifest':m,'mac':mac(m)}
def pairs(xs):
    d={}
    for k,v in xs:
        need(k not in d,'DUPLICATE_KEY'); d[k]=v
    return d
def parse(b,charset='utf-8'):
    need(len(b)<=LIMIT,'SIZE')
    return json.loads(b.decode(charset,errors='strict'),object_pairs_hook=pairs,parse_constant=lambda _: (_ for _ in ()).throw(Reject('NONFINITE')))
def shape(x,keys): need(type(x) is dict and set(x)==set(keys.split()),'SCHEMA')
def integer(x,lo=0,hi=10**9): need(type(x) is int and lo<=x<=hi,'TYPE')
def boolean(x): need(type(x) is bool,'TYPE')
def text(x,pattern): need(type(x) is str and re.fullmatch(pattern,x) is not None,'TYPE')
def interval(x,at):
    need(type(x) is list and len(x)==2,'SCHEMA'); integer(x[0]); integer(x[1]); need(x[0]<=at<x[1],'EFFECTIVE_PERIOD')
def safe_read(root,name):
    need(type(name) is str and re.fullmatch(r'v[1-9][0-9]{0,2}\.(bin|json)',name),'PATH')
    need(not root.is_symlink() and root.is_dir(),'PATH')
    fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
        try:
            info=os.fstat(f); need(stat.S_ISREG(info.st_mode) and info.st_nlink==1,'PATH'); need(info.st_size<=LIMIT,'SIZE')
            with os.fdopen(f,'rb',closefd=False) as stream: b=stream.read(LIMIT+1)
            need(len(b)<=LIMIT,'SIZE'); return b
        finally: os.close(f)
    finally: os.close(fd)
def write_new(path,b):
    with path.open('xb') as f: f.write(b); f.flush(); os.fsync(f.fileno())
def write_version(root,m,obj=None,raw=None):
    raw=raw if raw is not None else json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('cp932')
    m=copy.deepcopy(m); m['raw_sha']=sha(raw); m['length']=len(raw)
    write_new(root/f"v{m['version']}.bin",raw); write_new(root/f"v{m['version']}.json",canon(signed(m)))
    return m
def fixture():
    roster=[{'id':'TEST:JRA:A','no':1,'status':'ACTIVE'},{'id':'TEST:JRA:B','no':2,'status':'CANCELLED'}]
    rights={k:True for k in ('capture','storage','ai','processor','private')}; rights.update(limited=False,free=False,paid=False,valid_from=0,valid_until=100,retain_until=90,revoked_at=None,deleted_at=None)
    m=dict(scope='SYNTHETIC_ONLY',issuer='TEST:JRA',event='TEST:TARGET',version=1,previous=None,start=10,end=12,seal=14,uncertainty=1,cutoff=20,post=30,published=9,event_at=30,charset='cp932',domain='RESPONSE_ENTITY_BYTES',roster=roster,count=2,course=[25,40],grade=[25,40],rights=rights,raw_name='v1.bin',correction_at=None)
    o=dict(event=m['event'],version=1,post=30,rows=[dict(x,historical=[dict(event='TEST:PRIOR',at=3,observed=5,published=4,subject=x['id'],no=7,status='FINISHED',ticks=557,course=[0,4],grade=[0,4])]) for x in roster]); return m,o
def validate(root,version,replay,output):
    integer(version,1,999); integer(replay); need(output in ('private','limited','free','paid'),'RIGHTS')
    prior=None; output_rows=[]
    for i in range(1,version+1):
        rec=parse(safe_read(root,f'v{i}.json')); shape(rec,'manifest mac'); m=rec['manifest']; text(rec['mac'],'[0-9a-f]{64}'); need(hmac.compare_digest(rec['mac'],mac(m)),'MAC')
        shape(m,'scope issuer event version previous start end seal uncertainty cutoff post published event_at charset domain roster count course grade rights raw_name correction_at raw_sha length')
        need(m['scope']=='SYNTHETIC_ONLY' and m['issuer'] in ('TEST:JRA','TEST:LOCAL'),'SCOPE'); text(m['event'],'TEST:[A-Z0-9:_-]+')
        for k in ('version','start','end','seal','uncertainty','cutoff','post','published','event_at','count','length'): integer(m[k])
        text(m['raw_sha'],'[0-9a-f]{64}'); need(m['version']==i and m['raw_name']==f'v{i}.bin','PATH'); need(m['charset']=='cp932' and m['domain']=='RESPONSE_ENTITY_BYTES','DOMAIN')
        need(m['start']<=m['end']<=m['seal'] and m['published']<=m['end'] and m['seal']+m['uncertainty']<=m['cutoff']<m['post']==m['event_at'] and replay>=m['cutoff'],'TIME')
        interval(m['course'],m['event_at']); interval(m['grade'],m['event_at'])
        if prior is None: need(m['previous'] is None and m['correction_at'] is None,'CHAIN')
        else:
            integer(m['correction_at']); need(m['previous']==sha(canon(prior)) and m['event']==prior['manifest']['event'] and m['issuer']==prior['manifest']['issuer'] and m['start']>=prior['manifest']['end'] and m['correction_at']>=prior['manifest']['published'] and m['correction_at']==m['published']<=m['end'] and m['cutoff']==prior['manifest']['cutoff'],'CHAIN')
        rights=m['rights']; shape(rights,'capture storage ai processor private limited free paid valid_from valid_until retain_until revoked_at deleted_at')
        for k in ('capture','storage','ai','processor','private','limited','free','paid'): boolean(rights[k])
        for k in ('valid_from','valid_until','retain_until'): integer(rights[k])
        for k in ('revoked_at','deleted_at'):
            if rights[k] is not None: integer(rights[k])
        need(all(rights[k] for k in ('capture','storage','ai','processor',output)) and rights['valid_from']<=m['start']<=replay<min(rights['valid_until'],rights['retain_until']) and all(rights[k] is None or replay<rights[k] for k in ('revoked_at','deleted_at')),'RIGHTS')
        raw=safe_read(root,m['raw_name']); need(sha(raw)==m['raw_sha'] and len(raw)==m['length'],'RAW')
        o=parse(raw,m['charset']); shape(o,'event version post rows'); integer(o['version']); integer(o['post']); need((o['event'],o['version'],o['post'])==(m['event'],i,m['post']),'VERSION')
        need(type(o['rows']) is list and type(m['roster']) is list and len(o['rows'])==len(m['roster'])==m['count']>0,'ROSTER')
        seen=set(); nums=set(); output_rows=[]
        for j,(row,declared) in enumerate(zip(o['rows'],m['roster'])):
            shape(row,'id no status historical'); shape(declared,'id no status'); text(row['id'],re.escape(m['issuer'])+':[A-Z0-9_-]+'); integer(row['no'],1,99); integer(declared['no'],1,99)
            need({k:row[k] for k in ('id','no','status')}==declared and row['id'] not in seen and row['no'] not in nums and row['status'] in ('ACTIVE','CANCELLED','EXCLUDED'),'ROSTER'); seen.add(row['id']); nums.add(row['no']); need(type(row['historical']) is list,'SCHEMA')
            roots=set()
            for k,h in enumerate(row['historical']):
                shape(h,'event at observed published subject no status ticks course grade'); text(h['event'],'TEST:[A-Z0-9:_-]+'); integer(h['no'],1,99)
                for field in ('at','observed','published'): integer(h[field])
                need(h['event']!=m['event'] and h['at']<m['event_at'] and h['at']<=h['published']<=h['observed']<=m['cutoff'] and h['subject']==row['id'],'HISTORY'); interval(h['course'],h['at']); interval(h['grade'],h['at'])
                need(h['event'] not in roots,'DUPLICATE_ROOT'); roots.add(h['event'])
                need(h['status'] in ('FINISHED','DNF','CANCELLED','EXCLUDED'),'HISTORY')
                if h['status']!='FINISHED': need(h['ticks'] is None,'NONPERFORMANCE'); continue
                integer(h['ticks'],1)
                if row['status']=='ACTIVE': output_rows.append({'pointer':f'/rows/{j}/historical/{k}','raw_sha':m['raw_sha'],'id':row['id'],'historical_no':h['no'],'ticks':h['ticks']})
        prior=rec
    return output_rows
def verify(root,v,replay,output):
    try: return {'status':'TEST_ONLY_PASS','rows':validate(root,v,replay,output),'formal_admissions':0,'pid':os.getpid()}
    except Reject as e: return {'status':'HELD','reason':str(e),'rows':None,'pid':os.getpid()}
    except (OSError,ValueError,TypeError,KeyError,AttributeError,RecursionError,OverflowError) as e: return {'status':'HELD','reason':'MALFORMED_OR_IO','rows':None,'pid':os.getpid()}
WORKER=None
def child(root,v=1,replay=21,output='private'):
    global WORKER
    if WORKER is None: WORKER=subprocess.Popen([sys.executable,__file__,'serve'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
    WORKER.stdin.write(json.dumps([str(root),v,replay,output])+'\n'); WORKER.stdin.flush(); d=json.loads(WORKER.stdout.readline()); need(d['pid']!=os.getpid(),'PROCESS'); return d

def run():
    results=[]
    def case(name,mut=None,rawmut=None,expected=None,action=None,output='private'):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); m,o=fixture()
            if mut: mut(m)
            if rawmut: rawmut(o)
            write_version(root,m,o)
            if action: action(root,m,o)
            got=child(root,output=output); ok=(got['status']=='HELD' and got['rows'] is None and got['reason']==expected) if expected else got['status']=='TEST_ONLY_PASS' and len(got['rows'])==1
            results.append(dict(name=name,expected=expected,actual=got.get('reason',got['status']),pass_=ok,distinct_process=got['pid']!=os.getpid()))
    def setv(k,v): return lambda m:m.__setitem__(k,v)
    def right(k,v): return lambda m:m['rights'].__setitem__(k,v)
    def row(k,v): return lambda o:o['rows'][0].__setitem__(k,v)
    def hist(k,v): return lambda o:o['rows'][0]['historical'][0].__setitem__(k,v)
    def rewrite(root,m,o,b):
        p=root/'v1.bin';p.write_bytes(b); rec=parse((root/'v1.json').read_bytes()); rec['manifest'].update(raw_sha=sha(b),length=len(b)); (root/'v1.json').write_bytes(canon(signed(rec['manifest'])))
    case('separate_process_exact_readback')
    for k,v,e in [('unexpected',1,'SCHEMA'),('start',True,'TYPE'),('cutoff',19.5,'TYPE'),('published',None,'TYPE'),('start',13,'TIME'),('seal',20,'TIME'),('post',20,'TIME'),('course',[0,30],'EFFECTIVE_PERIOD'),('grade',[0,30],'EFFECTIVE_PERIOD'),('count',3,'ROSTER'),('raw_name','../v1.bin','PATH'),('raw_name','/tmp/v1.bin','PATH'),('domain','DECODED_UTF8','DOMAIN'),('previous','fake','CHAIN'),('scope','REAL','SCOPE')]: case('manifest_'+k+'_'+str(v),setv(k,v),expected=e)
    for k,v,e in [('ai',1,'TYPE'),('ai',False,'RIGHTS'),('processor',False,'RIGHTS'),('capture',False,'RIGHTS'),('storage',False,'RIGHTS'),('revoked_at',21,'RIGHTS'),('deleted_at',21,'RIGHTS'),('retain_until',21,'RIGHTS'),('valid_until',21,'RIGHTS')]: case('rights_'+k+'_'+str(v),right(k,v),expected=e)
    for out in ('limited','free','paid'): case('deny_'+out,expected='RIGHTS',output=out); case('allow_'+out,right(out,True),output=out)
    for k,v,e in [('status','UNKNOWN','ROSTER'),('no',True,'TYPE'),('id','TEST:LOCAL:A','TYPE'),('historical',None,'SCHEMA'),('odds',1,'SCHEMA')]: case('row_'+k,rawmut=row(k,v),expected=e)
    for k,v,e in [('at',31,'HISTORY'),('observed',21,'HISTORY'),('published',6,'HISTORY'),('no',True,'TYPE'),('ticks',True,'TYPE'),('subject','TEST:JRA:B','HISTORY'),('event','TEST:TARGET','HISTORY'),('grade',[4,9],'EFFECTIVE_PERIOD'),('status','UNKNOWN','HISTORY'),('status','DNF','NONPERFORMANCE'),('popularity',1,'SCHEMA')]: case('history_'+k+'_'+str(v),rawmut=hist(k,v),expected=e)
    case('missing_row_key',rawmut=lambda o:o['rows'][0].pop('id'),expected='SCHEMA'); case('duplicate_history_root',rawmut=lambda o:o['rows'][0]['historical'].append(copy.deepcopy(o['rows'][0]['historical'][0])),expected='DUPLICATE_ROOT')
    case('duplicate_native_id',rawmut=lambda o:o['rows'][1].update(id=o['rows'][0]['id']),expected='ROSTER');case('target_result',rawmut=lambda o:o.update(target_result=1),expected='SCHEMA')
    case('raw_tamper',action=lambda r,m,o:(r/'v1.bin').write_bytes(b'bad'),expected='RAW');case('raw_deleted',action=lambda r,m,o:(r/'v1.bin').unlink(),expected='MALFORMED_OR_IO')
    case('duplicate_raw_key',action=lambda r,m,o:rewrite(r,m,o,b'{"event":1,"event":2}'),expected='DUPLICATE_KEY');case('nonfinite',action=lambda r,m,o:rewrite(r,m,o,b'{"x":NaN}'),expected='NONFINITE');case('bad_encoding',action=lambda r,m,o:rewrite(r,m,o,b'\x81'),expected='MALFORMED_OR_IO');case('raw_symlink',action=lambda r,m,o:((r/'v1.bin').rename(r/'other'),(r/'v1.bin').symlink_to(r/'other')),expected='MALFORMED_OR_IO')
    case('duplicate_manifest_key',action=lambda r,m,o:(r/'v1.json').write_bytes(b'{"manifest":{},"manifest":{}}'),expected='DUPLICATE_KEY');case('partial_receipt',action=lambda r,m,o:(r/'v1.json').write_bytes(b'{'),expected='MALFORMED_OR_IO')
    case('manifest_mac_tamper',action=lambda r,m,o:(r/'v1.json').write_bytes(canon({'manifest':parse((r/'v1.json').read_bytes())['manifest'],'mac':'0'*64})),expected='MAC')
    case('raw_hardlink',action=lambda r,m,o:os.link(r/'v1.bin',r/'copy.bin'),expected='PATH')
    case('missing_right',mut=lambda m:m['rights'].pop('ai'),expected='SCHEMA')
    case('malformed_history_entry',rawmut=lambda o:o['rows'][0]['historical'].__setitem__(0,[]),expected='SCHEMA')
    case('oversize_raw',action=lambda r,m,o:(r/'v1.bin').write_bytes(b'x'*(LIMIT+1)),expected='SIZE')
    case('duplicate_number',rawmut=lambda o:o['rows'][1].update(no=1),expected='ROSTER')
    def add(name,ok,actual): results.append(dict(name=name,expected=None,actual=actual,pass_=bool(ok),distinct_process=True))
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);m,o=fixture();v1=write_version(root,m,o);rec=parse((root/'v1.json').read_bytes());old=sha((root/'v1.bin').read_bytes());v2=copy.deepcopy(v1);v2.update(version=2,raw_name='v2.bin',previous=sha(canon(rec)),start=15,end=16,seal=17,published=15,correction_at=15);o2=copy.deepcopy(o);o2['version']=2;o2['rows'][0]['status']='EXCLUDED';v2['roster'][0]['status']='EXCLUDED';write_version(root,v2,o2)
        a=child(root,1);z=child(root,2);add('valid_correction_old_snapshot_preserved',len(a['rows'])==1 and z['rows']==[] and sha((root/'v1.bin').read_bytes())==old,z['status'])
        rec2=parse((root/'v2.json').read_bytes());bad=copy.deepcopy(rec2['manifest']);bad['previous']='0'*64;(root/'v2.json').write_bytes(canon(signed(bad)));z=child(root,2);add('broken_predecessor',z.get('reason')=='CHAIN',z.get('reason'))
        bad=copy.deepcopy(rec2['manifest']);bad.update(start=21,end=22,seal=23,published=21,correction_at=21);(root/'v2.json').write_bytes(canon(signed(bad)));z=child(root,2);add('after_cutoff_correction_no_rewrite',z.get('reason')=='TIME' and child(root,1)['status']=='TEST_ONLY_PASS',z.get('reason'))
        z=child(root,1,replay=19);add('replay_before_cutoff',z.get('reason')=='TIME',z.get('reason'))
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);m,o=fixture();o['rows'][0]['historical'][0].update(status='DNF',ticks=None);write_version(root,m,o);z=child(root);add('nonperformance_no_clock_extracted',z['status']=='TEST_ONLY_PASS' and z['rows']==[],z['status'])
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);p=[subprocess.Popen([sys.executable,__file__,'writer',str(root/'v1.bin')]) for _ in range(2)];codes=sorted(x.wait(timeout=10) for x in p);add('concurrent_exclusive_write',codes==[0,3],str(codes));z=child(root);add('orphan_raw_without_receipt',z['status']=='HELD',z.get('reason'))
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);p=subprocess.run([sys.executable,__file__,'crash',str(root/'v1.bin')]);z=child(root);add('writer_crash_partial_raw',p.returncode==9 and z['status']=='HELD',z.get('reason'))
    if WORKER is not None: WORKER.stdin.close(); WORKER.wait(timeout=10)
    print(json.dumps({'scope':'SYNTHETIC_ONLY','total':len(results),'passed':sum(x['pass_'] for x in results),'tests':results,'formal_admissions':0},indent=2)); assert all(x['pass_'] for x in results)
if __name__=='__main__':
    if len(sys.argv)>1:
        if sys.argv[1]=='serve':
            for line in sys.stdin:
                root,v,replay,output=json.loads(line); print(json.dumps(verify(Path(root),v,replay,output)),flush=True)
        elif sys.argv[1]=='verify': print(json.dumps(verify(Path(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),sys.argv[5])))
        elif sys.argv[1]=='writer':
            try: write_new(Path(sys.argv[2]),b'fictional'); sys.exit(0)
            except FileExistsError: sys.exit(3)
        elif sys.argv[1]=='crash':
            with Path(sys.argv[2]).open('xb') as f: f.write(b'partial');f.flush();os.fsync(f.fileno());os._exit(9)
    else: run()
