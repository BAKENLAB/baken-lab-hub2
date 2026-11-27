"""Offline Work23 raw custody compatibility, NOT the full official or Work22 validator."""
import copy, hashlib, hmac, json, os, subprocess, sys, tempfile
from pathlib import Path
import stage22_probe as c
CK=b'PUBLIC-WORK23-TEST-CUSTODY'
RK=b'PUBLIC-WORK23-TEST-REGISTRY'
PREFIX_SHA='8bc49f2d55959b4a054c19c42d6bcc0f941d0738b9ef7d503db025308fcb0a06'
def digest(obj): return c.sha(c.canon(obj))
def mac(key,obj): return hmac.new(key,c.canon(obj),hashlib.sha256).hexdigest()
def rights():
    return dict(capture=True,storage=True,ai=True,processor=True,private=True,limited=False,free=False,paid=False,valid_from=0,valid_until=1000,retain_until=900,revoked_at=None,deleted_at=None)
def verify_rights(r,t):
    c.need(all(r[k] is True for k in ('capture','storage','ai','processor','private')),'RIGHTS')
    for k in ('valid_from','valid_until','retain_until'): c.integer(r[k])
    for k in ('revoked_at','deleted_at'):
        if r[k] is not None: c.integer(r[k])
    c.need(r['valid_from']<=t<min(r['valid_until'],r['retain_until']) and all(r[k] is None or t<r[k] for k in ('revoked_at','deleted_at')),'RIGHTS')
def store(root,bundle):
    for v in bundle['versions']:
        n=v['manifest']['version']; c.integer(n,1,99)
        c.write_new(root/f'v{n}.bin',v['raw_ascii'].encode('ascii'))
        c.write_new(root/f'v{n}.json',c.canon(dict(manifest=v['manifest'],test_mac=v['test_mac'])))
    c.write_new(root/'v999.json',c.canon(bundle['registry_receipt']))
def readback(root,anchor,issuer,event,analysis_at,requested=None):
    try:
        regrec=c.parse(c.safe_read(root,'v999.json')); c.shape(regrec,'registry test_mac'); reg=regrec['registry']; c.shape(reg,'scope issuer event complete sequence checked_at entries rights')
        c.need(hmac.compare_digest(regrec['test_mac'],mac(RK,reg)) and digest(regrec)==anchor['registry_sha'] and reg['sequence']==anchor['sequence'] and reg['checked_at']==anchor['checked_at'],'REGISTRY_PIN')
        c.need(reg['scope']=='SYNTHETIC_ONLY' and reg['issuer']==issuer and reg['event']==event and issuer in ('TEST:JRA','TEST:LOCAL') and event==issuer+':TARGET' and reg['complete'] is True,'REGISTRY_SCOPE')
        c.integer(analysis_at); c.integer(reg['checked_at']); c.integer(reg['sequence']); c.need(reg['checked_at']==analysis_at,'REGISTRY_TIME'); verify_rights(reg['rights'],analysis_at)
        c.need(type(reg['entries']) is list and 0<len(reg['entries'])<=99,'INVENTORY')
        previous=None; previous_m=None; chosen=None; receipts=[]
        for n,entry in enumerate(reg['entries'],1):
            rec=c.parse(c.safe_read(root,f'v{n}.json')); c.shape(rec,'manifest test_mac'); m=rec['manifest']
            c.shape(m,'scope issuer event version previous_receipt_sha published_at capture_start capture_end seal_at uncertainty cutoff scheduled_start hash_domain charset raw_sha256 byte_length rights_at_capture')
            c.need(entry['version']==n and m['version']==n and m['scope']=='SYNTHETIC_ONLY' and (m['issuer'],m['event'])==(issuer,event),'VERSION')
            c.need(hmac.compare_digest(rec['test_mac'],mac(CK,m)) and digest(rec)==entry['receipt_sha'] and m['previous_receipt_sha']==previous,'RECEIPT')
            for k in ('version','published_at','capture_start','capture_end','seal_at','uncertainty','cutoff','scheduled_start','byte_length'): c.integer(m[k])
            c.need(m['published_at']<=m['capture_end'] and m['capture_start']<=m['capture_end']<=m['seal_at'] and m['seal_at']+m['uncertainty']<=analysis_at and m['cutoff']<m['scheduled_start']-m['uncertainty'] and m['cutoff']<=analysis_at,'TIME')
            if previous_m: c.need(m['published_at']>=previous_m['published_at'] and m['capture_start']>=previous_m['capture_end'] and m['cutoff']==previous_m['cutoff'] and m['scheduled_start']==previous_m['scheduled_start'],'CHAIN')
            verify_rights(m['rights_at_capture'],m['capture_start'])
            raw=c.safe_read(root,f'v{n}.bin'); c.need(m['hash_domain']=='RESPONSE_ENTITY_BYTES' and m['charset']=='ASCII' and c.sha(raw)==m['raw_sha256'] and len(raw)==m['byte_length'],'RAW'); obj=c.parse(raw,'ascii')
            c.need(obj['schema']=='WORK23_FICTIONAL_SOURCE_0.2' and obj['issuer']==issuer and obj['target']['id']==event,'RAW_IDENTITY')
            if m['published_at']<=m['cutoff']:
                c.need(m['capture_end']+m['uncertainty']<=m['cutoff'] and m['seal_at']+m['uncertainty']<=m['cutoff'],'PRE_CUTOFF_UNSEALED'); chosen=(m,obj)
            receipts.append(dict(version=n,raw_sha256=c.sha(raw),byte_length=len(raw),receipt_sha=digest(rec)))
            previous=digest(rec); previous_m=m
        c.need(chosen is not None and (requested is None or type(requested) is int and requested==chosen[0]['version']),'WRONG_ASOF_VERSION')
        m,obj=chosen
        # No values released: source integrity receipt only, semantic analysis stays with packet adapter.
        return dict(status='TEST_ONLY_CUSTODY_PASS',selected_version=m['version'],selected_raw_sha256=m['raw_sha256'],selected_receipt_sha=receipts[m['version']-1]['receipt_sha'],registry_sha=digest(regrec),versions=receipts,formal_admissions=0,pid=os.getpid())
    except c.Reject as e: return dict(status='HELD',reason=str(e),formal_admissions=0,pid=os.getpid())
    except (OSError,ValueError,TypeError,KeyError,AttributeError,RecursionError,OverflowError): return dict(status='HELD',reason='MALFORMED_OR_IO',formal_admissions=0,pid=os.getpid())
def condition(issuer,distance):
    return dict(venue='SYNTHETIC_J_VENUE' if issuer=='TEST:JRA' else 'SYNTHETIC_L_VENUE',surface='TURF' if issuer=='TEST:JRA' else 'DIRT',distance_m=distance,going='GOOD',direction='RIGHT',class_id='TEST:CLASS:1',class_effective=[0,100],geometry=dict(version='TEST:GEO:1',effective=[0,100],first_turn_m=300,straight_m=250,elevation_change_mm=1500,checkpoints_m=[300,distance-200]))
def fixture(issuer):
    I=lambda x:issuer+':'+x; d=1400 if issuer=='TEST:JRA' else 900; base=840 if d==1400 else 540
    def event(key,at,order,clocks):
        seg=[200]*7 if d==1400 else [100]+[200]*4; ticks=[60 if x==100 else 120 for x in seg]; ticks[-1]+=clocks[0]-sum(ticks)
        return dict(id=I(key),at=at,published=at+1,observed=at+2,conditions=condition(issuer,d),field_count=len(order),leader_laps=dict(scope='RACE_LEADER',segments=[dict(distance_m=m,ticks=t) for m,t in zip(seg,ticks)]),rows=[dict(id=I(h),no=[7,3,9][i],status='FINISHED',finish=i+1,clock_ticks=clocks[i],margin_to_winner=dict(unit='0.1_second',value=clocks[i]-clocks[0]),margin_to_next=None if i==len(order)-1 else dict(unit='0.1_second',value=clocks[i+1]-clocks[i]),final3f_ticks=360+i*2,positions=[i+1,i+1],weight_grams=55000+i*1000) for i,h in enumerate(order)])
    t=dict(id=I('TARGET'),at=70,published=49,observed=50,conditions=condition(issuer,d),registered_count=3,active_count=2,roster=[dict(id=I('A'),no=1,status='ACTIVE',weight_grams=56000),dict(id=I('B'),no=2,status='ACTIVE',weight_grams=55000),dict(id=I('C'),no=4,status='CANCELLED',weight_grams=None)])
    return dict(schema='WORK23_FICTIONAL_SOURCE_0.2',issuer=issuer,target=t,history=[event('H1',10,['X','A','B'],[base,base+3,base+7]),event('H2',20,['Y','A','X'],[base-4,base-2,base+1]),event('H3',30,['X','Y','Z'],[base-2,base+1,base+5])])
def pack(obj,version=1,prev=None,published=49,end=52,seal=54):
    raw=json.dumps(obj,separators=(',',':'),ensure_ascii=True).encode('ascii'); m=dict(scope='SYNTHETIC_ONLY',issuer=obj['issuer'],event=obj['target']['id'],version=version,previous_receipt_sha=prev,published_at=published,capture_start=end-2,capture_end=end,seal_at=seal,uncertainty=1,cutoff=60,scheduled_start=70,hash_domain='RESPONSE_ENTITY_BYTES',charset='ASCII',raw_sha256=c.sha(raw),byte_length=len(raw),rights_at_capture=rights())
    return dict(raw_ascii=raw.decode('ascii'),manifest=m,test_mac=mac(CK,m))
def build(name):
    issuer='TEST:LOCAL' if name=='local_full' else 'TEST:JRA'; obj=fixture(issuer); vs=[pack(obj)]
    if name in ('correction_before','correction_after'):
        o=copy.deepcopy(obj); p=55 if name=='correction_before' else 61; o['target']['roster'][0]['status']='EXCLUDED'; o['target']['active_count']=1; o['target']['published']=p; o['target']['observed']=p+1
        vs.append(pack(o,2,digest(dict(manifest=vs[0]['manifest'],test_mac=vs[0]['test_mac'])),p,p+1,p+2))
    reg=dict(scope='SYNTHETIC_ONLY',issuer=issuer,event=obj['target']['id'],complete=True,sequence=8,checked_at=65,entries=[dict(version=v['manifest']['version'],receipt_sha=digest(dict(manifest=v['manifest'],test_mac=v['test_mac']))) for v in vs],rights=rights())
    if name=='revoked': reg['rights']['revoked_at']=64
    rr=dict(registry=reg,test_mac=mac(RK,reg)); return dict(name=name,versions=vs,registry_receipt=rr,anchor=dict(registry_sha=digest(rr),sequence=8,checked_at=65),analysis_at=65,output='private',requested=None)
PINS={
'jra_full':(['795d945cadc5240518188e2da8ee7bfa0a923625e63f33ff08396d40f3a87303'],'62627b45ae3fe0433e858b9b3869390edd729809fb95c5d13d86d5c231c48014'),
'local_full':(['80f1a0dadc516ceef5de08c3a144a696872957458b114b5e50403c2d4420807d'],'091ffaaf1a7635dfb9c0d889cb51d8b46f2f6395c70e34eeafd5d1f03a72f3a3'),
'correction_before':(['795d945cadc5240518188e2da8ee7bfa0a923625e63f33ff08396d40f3a87303','37eb352b035bae06b680ea6d91922c05b23956f39503b5a7461b4bb8d88ed04d'],'f8c88cf2b39bf5e4131b1c646138a2bce0e6ea4bd118da988627b758f87953f0'),
'correction_after':(['795d945cadc5240518188e2da8ee7bfa0a923625e63f33ff08396d40f3a87303','de12d584b8d387c94f2f90f8c62c70dea7c85234cc999dc4052a773b51e34e3c'],'9202d663e1f6b16529f9528b02d6d99e1c09a04761b9efbdc32e02d5710dd50a'),
'revoked':(['795d945cadc5240518188e2da8ee7bfa0a923625e63f33ff08396d40f3a87303'],'4be06ca6ae4da460326107f473bf4cdcffa2094e7148a66d53b8f4b2e0ee9d1e')}
def run():
    prefix=Path(c.__file__).read_bytes().split(b'def fixture():',1)[0]; assert c.sha(prefix)==PREFIX_SHA
    results=[]; fixture_pins={}
    def case(name,base,expected,mut=None,requested=None):
        b=build(base); hashes=[v['manifest']['raw_sha256'] for v in b['versions']]; assert (hashes,b['anchor']['registry_sha'])==PINS[base]; fixture_pins[base]=dict(raw_sha256=hashes,registry_sha=b['anchor']['registry_sha'])
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);store(root,b)
            if mut: mut(root,b)
            reg=b['registry_receipt']['registry']; cmd=[sys.executable,__file__,'verify',str(root),json.dumps(b['anchor']),reg['issuer'],reg['event'],str(b['analysis_at']),json.dumps(requested)]
            got=json.loads(subprocess.check_output(cmd,text=True)); actual=got.get('reason',got['status']); ok=actual==expected and got['pid']!=os.getpid() and got['formal_admissions']==0 and (got['status']=='HELD' or got['selected_version']==(2 if base=='correction_before' else 1)); results.append(dict(name=name,expected=expected,actual=actual,pass_=ok,distinct_process=got['pid']!=os.getpid(),receipt={k:v for k,v in got.items() if k!='pid'}))
    for n in ('jra_full','local_full','correction_before','correction_after'): case(n,n,'TEST_ONLY_CUSTODY_PASS')
    case('revoked','revoked','RIGHTS'); case('wrong_asof','correction_before','WRONG_ASOF_VERSION',requested=1)
    case('raw_tamper','jra_full','RAW',lambda r,b:(r/'v1.bin').write_bytes(b'changed'))
    case('raw_missing','jra_full','MALFORMED_OR_IO',lambda r,b:(r/'v1.bin').unlink())
    case('registry_missing','jra_full','MALFORMED_OR_IO',lambda r,b:(r/'v999.json').unlink())
    case('registry_rollback','correction_before','REGISTRY_PIN',lambda r,b:(r/'v999.json').write_bytes(c.canon(build('jra_full')['registry_receipt'])))
    case('duplicate_receipt_key','jra_full','DUPLICATE_KEY',lambda r,b:(r/'v1.json').write_bytes(b'{"manifest":{},"manifest":{}}'))
    case('raw_symlink','jra_full','MALFORMED_OR_IO',lambda r,b:((r/'v1.bin').rename(r/'other'),(r/'v1.bin').symlink_to(r/'other')))
    print(json.dumps(dict(scope='SYNTHETIC_ONLY',primitive_prefix_sha256=PREFIX_SHA,fixture_pins=fixture_pins,total=len(results),passed=sum(x['pass_'] for x in results),tests=results,formal_admissions=0),indent=2)); assert all(x['pass_'] for x in results)
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='verify': print(json.dumps(readback(Path(sys.argv[2]),json.loads(sys.argv[3]),sys.argv[4],sys.argv[5],int(sys.argv[6]),json.loads(sys.argv[7]))))
    else: run()
