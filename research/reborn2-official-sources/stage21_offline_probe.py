"""Offline synthetic-only evidence storage experiment; no official data or network."""
import copy, hashlib, hmac, json, tempfile
from pathlib import Path

KEY = b'FICTIONAL-TEST-KEY-NOT-A-TRUSTED-TIMESTAMP'
def canon(x): return json.dumps(x, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
def sha(x): return hashlib.sha256(x).hexdigest()
def mac(x): return hmac.new(KEY, canon(x), hashlib.sha256).hexdigest()
def write_new(path, data):
    with path.open('xb') as f: f.write(data)
def sign(m): return {'manifest': m, 'test_mac': mac(m)}
def fixture():
    return {'scope':'SYNTHETIC_ONLY','event':'FICTIONAL_RACE','version':1,'post_version':1,'start':10,'end':12,'seal':14,'uncertainty':1,'cutoff':20,'post':30,'published':9,'charset':'cp932','domain':'RESPONSE_ENTITY_BYTES','roster':[{'id':'TEST:A','no':1,'status':'ACTIVE'},{'id':'TEST:B','no':2,'status':'CANCELLED'}],'course_valid':[0,40],'class_valid':[0,40],'correction_seen':12,'rights':{'capture':True,'storage':True,'ai':True,'processor':True,'public':False,'valid_from':0,'valid_until':100,'retain_until':90,'revoked_at':None},'replay_at':21,'output':'private','raw_name':'v1.bin'}
def verify(directory, receipt):
    m=receipt['manifest']; errors=[]
    if m['scope']!='SYNTHETIC_ONLY': errors.append('SCOPE')
    if not hmac.compare_digest(receipt['test_mac'], mac(m)): errors.append('MAC')
    rights=m['rights']; rev=rights['revoked_at']
    if not all(rights[k] for k in ('capture','storage','ai','processor')) or not rights['valid_from']<=m['start']<=m['replay_at']<min(rights['valid_until'],rights['retain_until']) or (rev is not None and rev<=m['replay_at']) or (m['output']!='private' and not rights['public']): errors.append('RIGHTS')
    if not 0<=m['uncertainty'] or not m['start']<=m['end']<=m['seal'] or m['seal']+m['uncertainty']>m['cutoff'] or not m['cutoff']<m['post'] or m['published'] is None or m['published']>m['end']: errors.append('TIME')
    if m['domain']!='RESPONSE_ENTITY_BYTES' or m['charset']!='cp932': errors.append('DOMAIN')
    if m['post_version']!=m['version'] or m['correction_seen']>m['cutoff'] or any(not a<=m['cutoff']<b for a,b in (m['course_valid'],m['class_valid'])): errors.append('VERSION')
    try: raw=(directory/m['raw_name']).read_bytes()
    except OSError: return errors+['MISSING_RAW'], None
    if sha(raw)!=m['raw_sha'] or len(raw)!=m['length']: errors.append('RAW')
    try: obj=json.loads(raw.decode(m['charset'],errors='strict'))
    except (ValueError,LookupError,UnicodeError): return errors+['DECODE'], None
    if obj.get('event')!=m['event'] or obj.get('version')!=m['version'] or obj.get('post')!=m['post']: errors.append('VERSION')
    rows=obj.get('rows',[]); allow={'id','no','status','historical','label'}
    if set(obj)!={'event','version','post','rows'} or any(set(row)!=allow for row in rows): errors.append('ALLOWLIST')
    roster=[{k:row[k] for k in ('id','no','status')} for row in rows]
    if roster!=m['roster'] or len({x['id'] for x in roster})!=len(roster) or len({x['no'] for x in roster})!=len(roster) or any(x['status'] not in ('ACTIVE','CANCELLED','EXCLUDED') or not x['id'].startswith('TEST:') for x in roster): errors.append('ROSTER')
    extracted=[]
    for i,row in enumerate(rows):
        for j,h in enumerate(row['historical']):
            if set(h)!={'event','time_ticks','subject_id','historical_no','status','observed'}: errors.append('ALLOWLIST'); continue
            if h['event']==m['event'] or h['observed']>m['cutoff'] or h['subject_id']!=row['id'] or not isinstance(h['historical_no'],int) or h['historical_no']<=0: errors.append('HISTORY')
            if h['status']!='FINISHED' or not isinstance(h['time_ticks'],int) or h['time_ticks']<=0: continue
            if row['status']=='ACTIVE': extracted.append({'id':row['id'],'source_pointer':f'/rows/{i}/historical/{j}','raw_sha':sha(raw),'historical_no':h['historical_no'],'time_ticks':h['time_ticks']})
    return sorted(set(errors)), None if errors else extracted

def raw_fixture():
    m=fixture(); return {'event':m['event'],'version':1,'post':30,'rows':[dict(x,label='架空馬',historical=[{'event':'FICTIONAL_PRIOR','time_ticks':557,'subject_id':x['id'],'historical_no':7,'status':'FINISHED','observed':5}]) for x in m['roster']]}
def encode(obj): return json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('cp932')
def run():
    results=[]
    def check(name,patch=None,raw_patch=None,expected=None,mode=None):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); m=fixture(); obj=raw_fixture()
            if raw_patch: raw_patch(obj)
            raw=encode(obj); m.update(raw_sha=sha(raw),length=len(raw)); write_new(root/'v1.bin',raw)
            if patch: patch(m)
            receipt=sign(m); write_new(root/'receipt.json',canon(receipt))
            if mode=='tamper_raw': (root/'v1.bin').write_bytes(raw+b' ')
            if mode=='missing': (root/'v1.bin').unlink()
            if mode=='tamper_manifest': receipt['manifest']['cutoff']=19
            if mode=='overwrite':
                try: write_new(root/'v1.bin',b'NEW'); raise AssertionError('overwrite accepted')
                except FileExistsError: pass
            if mode=='correction':
                next_obj=copy.deepcopy(obj); next_obj['version']=2; next_obj['rows'][0]['status']='EXCLUDED'; write_new(root/'v2.bin',encode(next_obj)); assert sha((root/'v1.bin').read_bytes())==m['raw_sha'] and sha((root/'v2.bin').read_bytes())!=m['raw_sha']
            if mode!='tamper_manifest': receipt=json.loads((root/'receipt.json').read_bytes())
            errors,extracted=verify(root,receipt)
            ok=(expected in errors and extracted is None) if expected else (not errors and len(extracted)==1 and extracted[0]['historical_no']==7 and extracted[0]['time_ticks']==557)
            results.append({'name':name,'expected':expected,'errors':errors,'pass':ok})
    def setv(k,v): return lambda m:m.__setitem__(k,v)
    def right(k,v): return lambda m:m['rights'].__setitem__(k,v)
    check('exact_bytes_and_independent_readback'); check('exclusive_create',mode='overwrite'); check('append_correction_preserves_old_bytes',mode='correction')
    for name,k,v,e in [('wrong_domain','domain','DECODED_UTF8','DOMAIN'),('wrong_charset','charset','utf-8','DOMAIN'),('start_after_end','start',13,'TIME'),('late_seal','seal',21,'TIME'),('uncertain_cutoff','uncertainty',7,'TIME'),('cutoff_at_post','cutoff',30,'TIME'),('publication_missing','published',None,'TIME'),('late_publication','published',13,'TIME'),('post_version_mismatch','post_version',2,'VERSION'),('late_correction','correction_seen',21,'VERSION'),('course_expired','course_valid',[0,20],'VERSION'),('class_expired','class_valid',[0,20],'VERSION'),('public_without_right','output','public','RIGHTS'),('nonfiction_scope','scope','REAL','SCOPE'),('length_mismatch','length',1,'RAW')]: check(name,setv(k,v),expected=e)
    for k,v in [('capture',False),('storage',False),('ai',False),('processor',False),('revoked_at',20),('retain_until',21),('valid_until',21)]: check('rights_'+k,right(k,v),expected='RIGHTS')
    check('raw_changed',expected='RAW',mode='tamper_raw'); check('raw_missing',expected='MISSING_RAW',mode='missing'); check('receipt_modified',expected='MAC',mode='tamper_manifest')
    check('roster_mismatch',lambda m:m['roster'][0].update(status='UNKNOWN'),expected='ROSTER')
    check('duplicate_native_id',raw_patch=lambda o:o['rows'][1].update(id='TEST:A'),expected='ROSTER')
    check('unknown_status',raw_patch=lambda o:o['rows'][0].update(status='UNKNOWN'),expected='ROSTER')
    check('market_field',raw_patch=lambda o:o['rows'][0].update(odds=99),expected='ALLOWLIST')
    check('target_result_field',raw_patch=lambda o:o.update(target_result=1),expected='ALLOWLIST')
    check('target_event_in_history',raw_patch=lambda o:o['rows'][0]['historical'][0].update(event='FICTIONAL_RACE'),expected='HISTORY')
    check('late_history',raw_patch=lambda o:o['rows'][0]['historical'][0].update(observed=21),expected='HISTORY')
    check('wrong_subject',raw_patch=lambda o:o['rows'][0]['historical'][0].update(subject_id='TEST:B'),expected='HISTORY')
    check('nested_market',raw_patch=lambda o:o['rows'][0]['historical'][0].update(popularity=1),expected='ALLOWLIST')
    print(json.dumps({'scope':'SYNTHETIC_ONLY','tests':results,'passed':sum(x['pass'] for x in results),'total':len(results),'formal_admissions':0},indent=2))
    assert all(x['pass'] for x in results)
if __name__=='__main__': run()
