import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const configured=process.env.LOCAL_QUEUE_TEST_DATABASE_URL;
const installed=spawnSync('psql',['--version'],{timeout:2000}).status===0;
const reason=!configured?'No isolated PostgreSQL configured':!installed?'psql missing':false;
if(process.env.LOCAL_QUEUE_REQUIRE_POSTGRES==='1'&&reason)throw Error('Required PostgreSQL integration unavailable');
test('real PostgreSQL 17 LOCAL queue A-N',{skip:reason},async t=>{
 const u=new URL(configured);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(u.hostname),'Only isolated loopback accepted');
 assert.match(u.pathname,/^\/local_queue_test_[a-z0-9_]+$/i);
 const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGCONNECT_TIMEOUT:'3'};
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
 const diagnostic=s=>(s||'').split('\n').find(x=>x.startsWith('ERROR:'))?.slice(0,200)||'No SQL diagnostics';
 const run=sql=>{const p=spawnSync('psql',args,{env,input:sql,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});assert.equal(p.status,0,'Isolated fixture SQL: '+diagnostic(p.stderr));return p.stdout.trim();};
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const lit=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const text=x=>"'"+String(x).replaceAll("'","''")+"'";
 assert.equal(run('SHOW server_version_num;').slice(0,2),'17','PostgreSQL 17 required');
 assert.equal(run("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"),'0','Refuse nonempty DB');
 run(read('tests/postgres/scaffold.sql'));
 run(read('review/production-queue-baseline.sql'));
 run(read('review/local-queue-execution-migration.sql'));
 run('GRANT SELECT ON public.lab_prediction_race_state TO service_role;');
 const worker='LOCAL_QUEUE_CHUBU',call=w=>`public.lab_queue_claim_next_v1('${w}')`;
 const seed=no=>`INSERT INTO public.official_races VALUES((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,'名古屋',${no},'LOCAL','fixture',clock_timestamp()+interval '30 minutes','PENDING','{}');`;
 const check=sql=>run(`BEGIN;SET ROLE service_role;${sql}ROLLBACK;`);
 const checkDo=body=>check('DO $$ DECLARE a jsonb;b jsonb;tok uuid;n integer; BEGIN '+body+' END $$;');
 const guard=(expression,code)=>`BEGIN PERFORM ${expression};RAISE EXCEPTION 'EXPECTED_REJECTION';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>${text(code)} THEN RAISE EXCEPTION 'Unexpected rejection: %',SQLERRM;END IF;END;`;
 const version='CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004',uid='11111111-1111-4111-8111-111111111111';
 const payload={runners:[{horse_no:1,rank:1}],top5:[{horse_no:1,rank:1}],eye:null,bets:[],summary:'DB fixture',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{all_runners_checked:true,market_used_for_ranking:false,field_integrity_checked:true,protocol_version:version,execution_profile:'UNIFIED_LOCAL_ABILITY_V1'}};
 const normalized=lit(payload);
 const save=(original=normalized,p=normalized,user=uid)=>`public.lab_queue_save_prediction_v1((a->>'job_id')::uuid,'${user}','${version}',${p},${original})`;
 const saveSetup=seed(9)+`INSERT INTO public.lab_prediction_protocols VALUES('LOCAL_MAIN','${version}',true,'{}');`;
 await t.test('M permissions: default grants removed, INVOKER and fixed search path',()=>{
  const rpc='public.lab_queue_save_prediction_v1(uuid,uuid,text,jsonb,jsonb)';
  for(const role of ['anon','authenticated'])assert.equal(run(`SELECT has_function_privilege('${role}','public.lab_queue_claim_next_v1(text)','EXECUTE') OR has_function_privilege('${role}','${rpc}','EXECUTE') OR has_table_privilege('${role}','public.lab_local_queue_save_receipts','SELECT') OR has_table_privilege('${role}','public.lab_local_queue_save_receipts','INSERT');`),'f');
  assert.equal(run("SELECT bool_and(NOT p.prosecdef AND 'search_path=pg_catalog'=ANY(p.proconfig)) FROM pg_proc p WHERE p.proname IN ('lab_queue_claim_next_v1','lab_queue_save_prediction_v1');"),'t');
  assert.equal(run("SELECT relrowsecurity FROM pg_class WHERE oid='public.lab_local_queue_save_receipts'::regclass;"),'t');
  assert.equal(run("SELECT has_table_privilege('service_role','public.lab_local_queue_save_receipts','SELECT') AND has_table_privilege('service_role','public.lab_local_queue_save_receipts','INSERT') AND NOT has_table_privilege('service_role','public.lab_local_queue_save_receipts','UPDATE') AND NOT has_table_privilege('service_role','public.lab_local_queue_save_receipts','DELETE') AND NOT has_table_privilege('service_role','public.lab_local_queue_save_receipts','TRUNCATE') AND NOT has_table_privilege('service_role','public.lab_local_queue_save_receipts','REFERENCES') AND NOT has_table_privilege('service_role','public.lab_local_queue_save_receipts','TRIGGER');"),'t');
  assert.equal(run("SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.proname IN ('lab_queue_claim_next_v1','lab_queue_save_prediction_v1') AND a.grantee=0;"),'0');
  for(const role of ['anon','authenticated']){
   run(`BEGIN;SET ROLE ${role};DO $$ BEGIN BEGIN PERFORM ${call(worker)};RAISE EXCEPTION 'NOT_REJECTED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN PERFORM public.lab_queue_save_prediction_v1(NULL,NULL,NULL,NULL,NULL);RAISE EXCEPTION 'NOT_REJECTED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN PERFORM 1 FROM public.lab_local_queue_save_receipts;RAISE EXCEPTION 'NOT_REJECTED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;ROLLBACK;`);
  }
  checkDo("BEGIN UPDATE public.lab_local_queue_save_receipts SET user_id=user_id;RAISE EXCEPTION 'NOT_REJECTED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN DELETE FROM public.lab_local_queue_save_receipts;RAISE EXCEPTION 'NOT_REJECTED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;");
 });
 await t.test('A normal enqueue/run/claim one',()=>check(seed(1)+`DO $$ DECLARE a jsonb;BEGIN a:=${call(worker)};IF a->>'claimed'<>'true' OR a->>'resumed'<>'false' OR (SELECT count(*) FROM public.lab_prediction_jobs WHERE job_status='CLAIMED')<>1 THEN RAISE EXCEPTION 'A';END IF;END $$;`));
 await t.test('B zero jobs closes empty run',()=>checkDo(`a:=${call(worker)};IF a->>'claimed'<>'false' OR EXISTS(SELECT 1 FROM public.lab_worker_runs WHERE status='RUNNING') THEN RAISE EXCEPTION 'B';END IF;`));
 await t.test('C/H resume same live job without token/attempt/run change',()=>check(seed(2)+`DO $$ DECLARE a jsonb;b jsonb;tok uuid;BEGIN a:=${call(worker)};SELECT claim_token INTO tok FROM public.lab_prediction_jobs WHERE id=(a->>'job_id')::uuid;b:=${call(worker)};IF b->>'resumed'<>'true' OR a->>'job_id'<>b->>'job_id' OR a->>'run_id'<>b->>'run_id' OR (SELECT attempts FROM public.lab_prediction_jobs WHERE id=(a->>'job_id')::uuid)<>1 OR NOT EXISTS(SELECT 1 FROM public.lab_prediction_jobs WHERE claim_token=tok) OR NOT EXISTS(SELECT 1 FROM public.lab_worker_runs WHERE id=(a->>'run_id')::uuid AND status='RUNNING') THEN RAISE EXCEPTION 'C/H';END IF;END $$;`));
 await t.test('D expired lease safely reclaims with new token and run',()=>check(seed(3)+`DO $$ DECLARE a jsonb;b jsonb;tok uuid;BEGIN a:=${call(worker)};SELECT claim_token INTO tok FROM public.lab_prediction_jobs WHERE id=(a->>'job_id')::uuid;UPDATE public.lab_prediction_jobs SET claimed_at=clock_timestamp()-interval '2 hours',lease_until=clock_timestamp()-interval '1 hour';b:=${call(worker)};IF b->>'resumed'<>'false' OR a->>'job_id'<>b->>'job_id' OR a->>'run_id'=b->>'run_id' OR EXISTS(SELECT 1 FROM public.lab_prediction_jobs WHERE claim_token=tok) OR (SELECT attempts FROM public.lab_prediction_jobs)<>2 THEN RAISE EXCEPTION 'D';END IF;END $$;`));
 await t.test('G old RUNNING with no live claim becomes ABANDONED, no deletion',()=>checkDo(`PERFORM public.lab_start_worker_run('${worker}','中部');a:=${call(worker)};IF EXISTS(SELECT 1 FROM public.lab_worker_runs WHERE status='RUNNING') OR NOT EXISTS(SELECT 1 FROM public.lab_worker_runs WHERE status='ABANDONED') OR (SELECT count(*) FROM public.lab_worker_runs)<>2 THEN RAISE EXCEPTION 'G';END IF;`));
 for(const [label,mutation] of [['claimed_by',"UPDATE public.lab_prediction_jobs SET claimed_by='LOCAL_QUEUE_RESCUE';"],['run_id',"UPDATE public.lab_prediction_jobs SET worker_run_id=public.lab_start_worker_run('LOCAL_QUEUE_RESCUE','RESCUE');"],['worker_id',"UPDATE public.lab_worker_runs SET worker_id='LOCAL_QUEUE_WEST';"],['region',"UPDATE public.lab_worker_runs SET region='西日本';"]]){
  await t.test('I expired ownership '+label+' rejects without cleanup/claim change',()=>check(seed(7)+`DO $$ DECLARE a jsonb;before_jobs jsonb;before_runs jsonb;BEGIN a:=${call(worker)};UPDATE public.lab_prediction_jobs SET claimed_at=clock_timestamp()-interval '2 hours',lease_until=clock_timestamp()-interval '1 hour';${mutation}SELECT jsonb_agg(to_jsonb(j) ORDER BY id) INTO before_jobs FROM public.lab_prediction_jobs j;SELECT jsonb_agg(to_jsonb(r) ORDER BY id) INTO before_runs FROM public.lab_worker_runs r;${guard(call(worker),'QUEUE_STATE_UNAVAILABLE')}IF before_jobs IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM public.lab_prediction_jobs j) OR before_runs IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.lab_worker_runs r) THEN RAISE EXCEPTION 'I mutated';END IF;END $$;`));
 }
 // A coordinator holds an EXCLUSIVE advisory gate. Two independent psql clients
 // wait on SHARED gate locks; release only after BOTH are visibly waiting.
 function connection(app){const p=spawn('psql',args,{env:{...env,PGAPPNAME:app},stdio:['pipe','pipe','pipe']});let out='',err='';const waiters=[];p.stdout.on('data',d=>{out+=d;for(const w of [...waiters])if(out.includes(w.marker)){waiters.splice(waiters.indexOf(w),1);w.resolve();}});p.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{p.kill();reject(Error('Concurrent client timeout'));},20000);p.on('error',()=>{clearTimeout(timer);reject(Error('psql unavailable'));});p.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(Error('Concurrent isolated SQL: '+diagnostic(err)));});});done.catch(()=>{});return {p,done,marker:marker=>out.includes(marker)?Promise.resolve():new Promise(resolve=>waiters.push({marker,resolve}))};}
 async function race(workers){
  const gate=connection('localqueue_gate');gate.p.stdin.write("SELECT pg_advisory_lock(72999,42);\n\\echo GATE_READY\n");
  await Promise.race([gate.marker('GATE_READY'),gate.done.then(()=>{throw Error('Gate exited');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Gate not ready')),5000))]);
  const clients=workers.map((w,i)=>{const c=connection('localqueue_worker_'+i);c.p.stdin.end(`BEGIN;SET ROLE service_role;SELECT pg_advisory_xact_lock_shared(72999,42);SELECT ${call(w)};SELECT pg_sleep(0.15);COMMIT;`);return c;});
  try{
   const deadline=Date.now()+5000;let ready=false;
   while(Date.now()<deadline){if(run("SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('localqueue_worker_0','localqueue_worker_1') AND wait_event='advisory';")==='2'){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}
   assert.ok(ready,'Both independent clients must wait at the gate');
   gate.p.stdin.end('SELECT pg_advisory_unlock(72999,42);');
   const out=await Promise.all(clients.map(c=>c.done));await gate.done;
   return out.map(s=>JSON.parse(s.split('\n').find(l=>l.startsWith('{'))));
  }finally{if(!gate.p.killed)gate.p.kill();for(const c of clients)if(!c.p.killed)c.p.kill();}
 }
 const retire=()=>run("UPDATE public.lab_prediction_jobs SET job_status='DEAD',claimed_by=NULL,claimed_at=NULL,lease_until=NULL,claim_token=NULL,worker_run_id=NULL WHERE job_status='CLAIMED';");
 await t.test('E two connections same worker: exactly one owner/token/attempt',async()=>{
  run(seed(4));run("SELECT public.lab_enqueue_prediction_jobs((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date);");
  const out=await race([worker,worker]);assert.equal(out.filter(x=>x.claimed).length,2);assert.equal(out.filter(x=>x.resumed).length,1);assert.equal(out[0].job_id,out[1].job_id);assert.equal(out[0].run_id,out[1].run_id);
  assert.equal(run("SELECT count(*)=1 AND count(DISTINCT worker_run_id)=1 AND count(DISTINCT claim_token)=1 AND max(attempts)=1 FROM public.lab_prediction_jobs WHERE job_status='CLAIMED';"),'t');retire();
 });
 await t.test('F two connections CHUBU vs RESCUE: single claim; live token not stolen',async()=>{
  run(seed(5));run("SELECT public.lab_enqueue_prediction_jobs((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date);");
  const out=await race([worker,'LOCAL_QUEUE_RESCUE']);assert.equal(out.filter(x=>x.claimed).length,1);
  assert.equal(run("SELECT count(*)=1 AND count(DISTINCT worker_run_id)=1 AND count(DISTINCT claim_token)=1 AND max(attempts)=1 FROM public.lab_prediction_jobs WHERE job_status='CLAIMED';"),'t');
  const before=run("SELECT worker_run_id::text||':'||claim_token::text FROM public.lab_prediction_jobs WHERE job_status='CLAIMED';");const loser=out[0].claimed?'LOCAL_QUEUE_RESCUE':worker;assert.equal(JSON.parse(run(`SELECT ${call(loser)};`)).claimed,false);assert.equal(run("SELECT worker_run_id::text||':'||claim_token::text FROM public.lab_prediction_jobs WHERE job_status='CLAIMED';"),before);retire();
 });
 await t.test('J receipt retry after lost response returns same FROZEN once',()=>check(saveSetup+`DO $$ DECLARE a jsonb;b jsonb;c jsonb;BEGIN a:=${call(worker)};b:=${save()};c:=${save()};IF b->>'prediction_id'<>c->>'prediction_id' OR c->>'already_saved'<>'true' OR (SELECT count(*) FROM public.official_predictions)<>1 OR (SELECT count(*) FROM public.lab_local_queue_save_receipts)<>1 THEN RAISE EXCEPTION 'J';END IF;END $$;`));
 const cases=[['object key order/whitespace',`'{ "audit": ${JSON.stringify(payload.audit)}, "bet_strategy":"SUSPENDED_FOR_ABILITY_STABILITY", "summary":"DB fixture", "bets":[], "eye":null, "top5":[{"rank":1,"horse_no":1}], "runners":[{"rank":1,"horse_no":1}] }'::jsonb`,true],['array order',`${normalized}||'{"summary":[2,1]}'::jsonb`,false],['same normalized, different original',`${normalized}||'{"summary":"raw changed"}'::jsonb`,false]];
 for(const [label,other,accepted] of cases){
  const original=label==='array order'?`${normalized}||'{"summary":[1,2]}'::jsonb`:normalized;
  await t.test('K original payload '+label,()=>check(saveSetup+`DO $$ DECLARE a jsonb;b jsonb;before_prediction jsonb;BEGIN a:=${call(worker)};b:=${save(original)};SELECT to_jsonb(p) INTO before_prediction FROM public.official_predictions p;${accepted?`b:=${save(other)};IF b->>'already_saved'<>'true' THEN RAISE EXCEPTION 'K';END IF;`:guard(save(other),'SAVE_RETRY_MISMATCH')}IF before_prediction IS DISTINCT FROM (SELECT to_jsonb(p) FROM public.official_predictions p) THEN RAISE EXCEPTION 'FROZEN changed';END IF;END $$;`));
 }
 await t.test('normalized payload mismatch and different user rejected',()=>check(saveSetup+`DO $$ DECLARE a jsonb;b jsonb;BEGIN a:=${call(worker)};b:=${save()};${guard(save(normalized,`${normalized}||'{"summary":"normalized changed"}'::jsonb`),'SAVE_RETRY_MISMATCH')}${guard(save(normalized,normalized,'22222222-2222-4222-8222-222222222222'),'SAVE_REJECTED')}END $$;`));
 await t.test('L rollback queue transaction leaves no new run/job',()=>{const before=run('SELECT count(*) FROM public.lab_worker_runs;');check(seed(10)+`SELECT ${call(worker)};`);assert.equal(run('SELECT count(*) FROM public.lab_worker_runs;'),before);assert.equal(run("SELECT count(*) FROM public.lab_prediction_jobs WHERE race_no=10;"),'0');});
 await t.test('L failed receipt INSERT rolls back nested guarded save atomically',()=>{
  run("CREATE FUNCTION public.fixture_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_RECEIPT_FAILURE';END $$;CREATE TRIGGER fixture_receipt_failure BEFORE INSERT ON public.lab_local_queue_save_receipts FOR EACH ROW EXECUTE FUNCTION public.fixture_receipt_failure();");
  try{check(saveSetup+`DO $$ DECLARE a jsonb;BEGIN a:=${call(worker)};${guard(save(),'FIXTURE_RECEIPT_FAILURE')}IF EXISTS(SELECT 1 FROM public.official_predictions) OR EXISTS(SELECT 1 FROM public.lab_local_queue_save_receipts) OR NOT EXISTS(SELECT 1 FROM public.lab_prediction_jobs WHERE id=(a->>'job_id')::uuid AND job_status='CLAIMED') OR (SELECT completed_count FROM public.lab_worker_runs WHERE id=(a->>'run_id')::uuid)<>0 THEN RAISE EXCEPTION 'L partial commit';END IF;END $$;`);}finally{run('DROP TRIGGER fixture_receipt_failure ON public.lab_local_queue_save_receipts;DROP FUNCTION public.fixture_receipt_failure();');}
 });
 await t.test('N non-LOCAL canary untouched; no JRA schema/function modifications',()=>{
  assert.doesNotMatch(read('review/local-queue-execution-migration.sql'),/public\.jra_|CREATE.*jra_/i);
  // Synthetic non-LOCAL row in THIS disposable DB; not a production JRA object.
  check("INSERT INTO public.official_races VALUES(current_date,'非LOCAL検証',12,'JRA','canary',clock_timestamp()+interval '30 minutes','PENDING','{\"marker\":true}');DO $$ DECLARE a jsonb;before_row jsonb;BEGIN SELECT to_jsonb(r) INTO before_row FROM public.official_races r WHERE circuit='JRA';a:="+call('LOCAL_QUEUE_RESCUE')+";IF before_row IS DISTINCT FROM (SELECT to_jsonb(r) FROM public.official_races r WHERE circuit='JRA') OR EXISTS(SELECT 1 FROM public.lab_prediction_jobs WHERE circuit<>'LOCAL') THEN RAISE EXCEPTION 'N';END IF;END $$;");
 });
});
