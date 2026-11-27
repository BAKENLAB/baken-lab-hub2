"""Offline synthetic custody-to-analysis bridge; no formal admission."""
import copy, json, hmac, tempfile, re
from pathlib import Path
import stage22_probe as c
KEY=b'PUBLIC-TEST-REGISTRY-KEY-DISTINCT-FROM-CUSTODY'
ITEMS=[f'RANK{i:02}' for i in range(1,101)]+[f'EYE{i:02}' for i in range(1,16)]
def need(ok,reason): c.need(ok,reason)
def sign(reg): return {'registry':reg,'mac':hmac.new(KEY,c.canon(reg),'sha256').hexdigest()}
def entry(root,n):
    rec=c.parse(c.safe_read(root,f'v{n}.json')); m=rec['manifest']
    return dict(version=n,receipt_sha=c.sha(c.canon(rec)),published=m['published'],end=m['end'],seal=m['seal'],uncertainty=m['uncertainty'])
def registry(root,versions,asof=25):
    m=c.parse(c.safe_read(root,'v1.json'))['manifest']
    return dict(scope='SYNTHETIC_ONLY',issuer=m['issuer'],event=m['event'],complete=True,sequence=7,checked_at=asof,entries=[entry(root,n) for n in versions],rights=copy.deepcopy(m['rights']))
def pin(reg): return dict(sha=c.sha(c.canon(sign(reg))),sequence=reg['sequence'],checked_at=reg['checked_at'])
def save_registry(path,reg): path.write_bytes(c.canon(sign(reg)))
def item_rows(state,reason,ids=()):
    return [dict(item=i,state=('TEST_INPUT_AVAILABLE' if i=='RANK05' and ids else state),reason=(None if i=='RANK05' and ids else reason),evidence_ids=(list(ids) if i=='RANK05' else []),analysis_consumed=False,formal_usable=False) for i in ITEMS]
def held(reason,issuer=None,event=None):
    return dict(schema='WORK22_SYNTHETIC_HANDOFF_0.1',scope='SYNTHETIC_ONLY',issuer=issuer,event=event,status='HELD',reason=reason,evidence=[],runners=[],items=item_rows('HELD',reason),formal_admissions=0,formal_eligible=False)
def bridge(root,registry_path,anchor,analysis_at,output='private',requested=None):
    issuer=event=None
    try:
        c.integer(analysis_at); need(output in ('private','limited','free','paid'),'OUTPUT_SCOPE')
        need(registry_path.is_file() and not registry_path.is_symlink(),'REGISTRY_UNAVAILABLE')
        rec=c.parse(registry_path.read_bytes()); c.shape(rec,'registry mac'); reg=rec['registry']; c.shape(reg,'scope issuer event complete sequence checked_at entries rights'); issuer,event=reg['issuer'],reg['event']
        need(hmac.compare_digest(rec['mac'],sign(reg)['mac']),'REGISTRY_MAC')
        c.shape(anchor,'sha sequence checked_at'); c.integer(anchor['sequence']); c.integer(anchor['checked_at']); c.integer(reg['sequence']); c.integer(reg['checked_at']); c.boolean(reg['complete'])
        need(reg['scope']=='SYNTHETIC_ONLY' and reg['complete'] is True and reg['entries'],'REGISTRY_INCOMPLETE')
        need(c.sha(c.canon(rec))==anchor['sha'] and reg['sequence']==anchor['sequence'] and reg['checked_at']==anchor['checked_at'],'REGISTRY_ROLLBACK_OR_UNPINNED')
        need(reg['checked_at']==analysis_at,'REGISTRY_STALE_OR_FUTURE')
        rights=reg['rights']; c.shape(rights,'capture storage ai processor private limited free paid valid_from valid_until retain_until revoked_at deleted_at')
        for k in ('capture','storage','ai','processor','private','limited','free','paid'): c.boolean(rights[k])
        for k in ('valid_from','valid_until','retain_until'): c.integer(rights[k])
        for k in ('revoked_at','deleted_at'):
            if rights[k] is not None: c.integer(rights[k])
        need(all(rights[k] for k in ('capture','storage','ai','processor',output)) and rights['valid_from']<=analysis_at<min(rights['valid_until'],rights['retain_until']) and all(rights[k] is None or analysis_at<rights[k] for k in ('revoked_at','deleted_at')),'LATEST_RIGHTS_DENIED')
        need(type(reg['entries']) is list and 0<len(reg['entries'])<=99,'REGISTRY_INCOMPLETE')
        previous=None; chosen=None; cutoff=None; selected_manifest=None; selected_raw=None
        for n,e in enumerate(reg['entries'],1):
            c.shape(e,'version receipt_sha published end seal uncertainty'); c.integer(e['version'],1,99); need(e['version']==n,'INVENTORY_GAP')
            receipt=c.parse(c.safe_read(root,f'v{n}.json')); c.shape(receipt,'manifest mac'); m=receipt['manifest']
            need(hmac.compare_digest(receipt['mac'],c.mac(m)) and c.sha(c.canon(receipt))==e['receipt_sha'],'INVENTORY_RECEIPT_MISMATCH')
            need(e==entry(root,n),'INVENTORY_METADATA_MISMATCH')
            need(m['scope']=='SYNTHETIC_ONLY' and (m['issuer'],m['event'])==(issuer,event) and m['version']==n,'INVENTORY_IDENTITY')
            for k in ('published','start','end','seal','uncertainty','cutoff','post','event_at'): c.integer(m[k])
            need(m['published']<=m['end'] and m['start']<=m['end']<=m['seal'] and m['seal']+m['uncertainty']<=analysis_at,'INVENTORY_TIME')
            if n==1: cutoff=m['cutoff']; need(m['previous'] is None and m['correction_at'] is None,'INVENTORY_CHAIN')
            else: need(m['previous']==c.sha(c.canon(previous)) and m['published']>=previous['manifest']['published'] and m['start']>=previous['manifest']['end'] and m['correction_at']==m['published'] and m['cutoff']==cutoff,'INVENTORY_CHAIN')
            need(cutoff< m['post']-m['uncertainty'] and cutoff<=analysis_at,'CUTOFF_UNCERTAIN')
            raw=c.safe_read(root,f'v{n}.bin'); need(c.sha(raw)==m['raw_sha'] and len(raw)==m['length'],'INVENTORY_RAW_MISMATCH')
            if m['published']<=cutoff:
                need(m['end']+m['uncertainty']<=cutoff and m['seal']+m['uncertainty']<=cutoff,'PRE_CUTOFF_CORRECTION_NOT_SEALED')
                chosen=n; selected_manifest=m; selected_raw=raw
            previous=receipt
        need(chosen is not None,'NO_PRESTART_VERSION'); need(requested is None or type(requested) is int and requested==chosen,'WRONG_ASOF_VERSION')
        m=selected_manifest; need(rights['valid_from']<=m['start'],'CAPTURE_RIGHTS_NOT_VALID')
        result=c.child(root,chosen,replay=analysis_at,output=output); need(result['status']=='TEST_ONLY_PASS','CUSTODY_'+str(result.get('reason','UNKNOWN')))
        obj=c.parse(selected_raw,m['charset']); evidence=[]; runners=[]
        for j,row in enumerate(obj['rows']):
            reason='NOT_ACTIVE' if row['status']!='ACTIVE' else 'NO_FINISHED_CLOCK'
            ids=[]
            for k,h in enumerate(row['historical']):
                need(h['observed']<=m['end'],'HISTORY_OUTSIDE_CAPTURE')
                if row['status']!='ACTIVE' or h['status']!='FINISHED': continue
                pointer=f'/rows/{j}/historical/{k}'
                match=[x for x in result['rows'] if x['pointer']==pointer and x['id']==row['id'] and x['historical_no']==h['no'] and x['ticks']==h['ticks'] and x['raw_sha']==m['raw_sha']]
                need(len(match)==1,'EXTRACTION_MISMATCH')
                eid='TEST:'+c.sha(c.canon([issuer,h['event'],row['id'],h['no'],'finish_clock']))
                ids.append(eid); evidence.append(dict(evidence_id=eid,root=eid,issuer=issuer,subject_id=row['id'],current_event=event,historical_event=h['event'],historical_no=h['no'],current_no=row['no'],source_version=chosen,raw_sha256=m['raw_sha'],hash_domain=m['domain'],pointer=pointer+'/ticks',field='finish_clock',value=h['ticks'],unit='0.1_second',historical_event_at=h['at'],published_at=h['published'],observed_at=h['observed'],capture_end=m['end'],seal=m['seal'],cutoff=cutoff,analysis_at=analysis_at,identity_status='SYNTHETIC_SAME_ISSUER_ONLY',permission_status='TEST_ONLY_LATEST_REGISTRY',registry_sequence=reg['sequence'],registry_sha=anchor['sha'],formal_usable=False))
            runners.append(dict(id=row['id'],no=row['no'],status=row['status'],items=item_rows('MISSING' if row['status']=='ACTIVE' else 'NOT_APPLICABLE',reason if not ids else 'REQUIRED_MATERIAL_NOT_PROVIDED',ids)))
        need(len(evidence)==len(result['rows']),'EXTRACTION_COUNT_MISMATCH')
        return dict(schema='WORK22_SYNTHETIC_HANDOFF_0.1',scope='SYNTHETIC_ONLY',issuer=issuer,event=event,status='TEST_ONLY_PACKET',selected_version=chosen,latest_inventory_version=len(reg['entries']),cutoff=cutoff,analysis_at=analysis_at,registry_sha=anchor['sha'],evidence=evidence,runners=runners,formal_admissions=0,formal_eligible=False)
    except c.Reject as e: return held(str(e),issuer,event)
    except (OSError,ValueError,TypeError,KeyError,AttributeError,RecursionError,OverflowError): return held('MALFORMED_OR_IO',issuer,event)
def fixture(root,issuer='TEST:JRA',missing=False,late=False,correction=None):
    m,o=c.fixture(); m['issuer']=issuer; m['event']=issuer+':TARGET'; o['event']=m['event']
    for i,row in enumerate(o['rows']):
        row['id']=issuer+':'+chr(65+i); m['roster'][i]['id']=row['id']; h=row['historical'][0]; h['subject']=row['id']; h['event']=issuer+':PRIOR'
    if missing: o['rows'][0]['historical']=[]
    if late: o['rows'][0]['historical'][0]['observed']=13
    m=c.write_version(root,m,o)
    if correction:
        v=copy.deepcopy(m); prev=c.parse(c.safe_read(root,'v1.json')); t={'before':15,'after':21,'unsealed':18}[correction]; v.update(version=2,raw_name='v2.bin',previous=c.sha(c.canon(prev)),start=t,end=t+1,seal=t+2,published=t,correction_at=t); o['version']=2; o['rows'][0]['status']='EXCLUDED';v['roster'][0]['status']='EXCLUDED'; c.write_version(root,v,o)
    return registry(root,[1,2] if correction else [1])
def run():
    results=[]; examples={}
    def test(name,expected,issuer='TEST:JRA',missing=False,late=False,correction=None,mut=None,after=None,requested=None,output='private',assertion=None):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); reg=fixture(root,issuer,missing,late,correction)
            if mut: mut(reg)
            anchor=pin(reg); path=root/'registry.json'; save_registry(path,reg)
            if after: after(root,path,reg)
            got=bridge(root,path,anchor,25,output,requested); actual=got.get('reason',got['status']); ok=actual==expected and got['formal_admissions']==0 and (not got['evidence'] if got['status']=='HELD' else True) and (assertion(got) if assertion else True)
            results.append(dict(name=name,expected=expected,actual=actual,pass_=ok))
            if name in ('jra_clock','local_missing','local_clock','revoked_after_capture','before_cutoff_select_latest'): examples[name]=got
    test('jra_clock','TEST_ONLY_PACKET',assertion=lambda g:len(g['evidence'])==1 and all(len(r['items'])==115 for r in g['runners']) and g['evidence'][0]['historical_no']==7 and g['evidence'][0]['current_no']==1)
    test('local_clock','TEST_ONLY_PACKET',issuer='TEST:LOCAL',assertion=lambda g:len(g['evidence'])==1 and g['evidence'][0]['issuer']=='TEST:LOCAL')
    test('local_missing','TEST_ONLY_PACKET',issuer='TEST:LOCAL',missing=True,assertion=lambda g:not g['evidence'] and all(x['state']=='MISSING' for x in g['runners'][0]['items']))
    test('before_cutoff_select_latest','TEST_ONLY_PACKET',correction='before',assertion=lambda g:g['selected_version']==2 and not g['evidence'])
    test('old_selection_rejected','WRONG_ASOF_VERSION',correction='before',requested=1)
    test('after_cutoff_not_retroactive','TEST_ONLY_PACKET',correction='after',assertion=lambda g:g['selected_version']==1 and g['latest_inventory_version']==2 and len(g['evidence'])==1)
    test('unsealed_pre_cutoff_correction','PRE_CUTOFF_CORRECTION_NOT_SEALED',correction='unsealed')
    test('observed_after_capture','HISTORY_OUTSIDE_CAPTURE',late=True)
    test('revoked_after_capture','LATEST_RIGHTS_DENIED',mut=lambda r:r['rights'].update(revoked_at=23))
    test('deleted_after_capture','LATEST_RIGHTS_DENIED',mut=lambda r:r['rights'].update(deleted_at=24))
    test('expired_at_analysis','LATEST_RIGHTS_DENIED',mut=lambda r:r['rights'].update(valid_until=25))
    test('retention_at_analysis','LATEST_RIGHTS_DENIED',mut=lambda r:r['rights'].update(retain_until=25))
    test('output_denied','LATEST_RIGHTS_DENIED',output='free')
    test('stale_registry','REGISTRY_STALE_OR_FUTURE',mut=lambda r:r.update(checked_at=24))
    test('future_registry','REGISTRY_STALE_OR_FUTURE',mut=lambda r:r.update(checked_at=26))
    test('registry_missing','REGISTRY_UNAVAILABLE',after=lambda r,p,g:p.unlink())
    test('incomplete_inventory','REGISTRY_INCOMPLETE',mut=lambda r:r.update(complete=False))
    test('rollback_resigned','REGISTRY_ROLLBACK_OR_UNPINNED',correction='before',after=lambda r,p,g:save_registry(p,dict(g,entries=g['entries'][:1],sequence=6)))
    test('inventory_gap','INVENTORY_GAP',correction='before',mut=lambda r:r['entries'].pop(0))
    test('resigned_old_receipt','INVENTORY_RECEIPT_MISMATCH',after=lambda r,p,g:(r/'v1.json').write_bytes(c.canon(c.signed(dict(c.parse((r/'v1.json').read_bytes())['manifest'],published=8)))))
    test('raw_tamper','INVENTORY_RAW_MISMATCH',after=lambda r,p,g:(r/'v1.bin').write_bytes(b'fake'))
    test('malformed_registry','MALFORMED_OR_IO',after=lambda r,p,g:p.write_bytes(b'{'))
    test('unknown_manifest_field','SCHEMA',mut=lambda r:r.update(extra=True))
    test('registry_bool_timestamp','TYPE',mut=lambda r:r.update(checked_at=True))
    test('registry_mac_mismatch','REGISTRY_MAC',after=lambda r,p,g:p.write_bytes(c.canon(dict(sign(g),mac='0'*64))))
    print(json.dumps(dict(scope='SYNTHETIC_ONLY',total=len(results),passed=sum(x['pass_'] for x in results),tests=results,examples=examples,formal_admissions=0),ensure_ascii=True,separators=(',',':')))
    assert all(x['pass_'] for x in results),results
if __name__=='__main__':
    try: run()
    finally:
        if c.WORKER is not None: c.WORKER.stdin.close(); c.WORKER.wait(timeout=10)
