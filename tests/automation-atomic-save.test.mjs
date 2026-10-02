// Real PostgreSQL integration tests, including two independent open transactions.
// No JS queue simulation. psql is the only external dependency.
import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const enabled = process.env.LAB_QUEUE_TEST_DISPOSABLE === 'YES';
// The suite creates a unique scratch database through a LOCAL PostgreSQL socket.
// A remote URL, Supabase project, or a caller-selected database is never accepted.
const socket = process.env.LAB_QUEUE_TEST_SOCKET ?? '/tmp';
if (!socket.startsWith('/') || socket.includes('..')) throw new Error('local socket path required');
const port = process.env.LAB_QUEUE_TEST_PORT ?? '5432';
if (!/^\d{1,5}$/.test(port)) throw new Error('invalid local PostgreSQL port');
const user = process.env.LAB_QUEUE_TEST_USER ?? process.env.USER ?? 'postgres';
const db = 'lab_atomic_save_test_' + randomUUID().replaceAll('-', '');
const args = database => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
  '-h', socket, '-p', port, '-U', user, '-d', database];
const env = {...process.env, PGOPTIONS: '', PGSERVICEFILE: '/dev/null',
  PGPASSFILE: '/dev/null', PGHOST: socket, PGPORT: port, PGUSER: user, PGDATABASE: db};
delete env.PGSERVICE;
function sql(query, database=db) {
  const r = spawnSync('psql', args(database), {input:query, encoding:'utf8', env, timeout:10000});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function value(q) {return JSON.parse(sql(q));}
const phase1Migration = readFileSync(new URL('../supabase/migrations/20261001131000_automation_reliability_v1.sql', import.meta.url),'utf8');
const fixture = readFileSync(new URL('./fixtures/automation-schema.sql', import.meta.url),'utf8');
const t = (name, fn) => test(name, {skip:!enabled}, fn);
function reset() {
  sql('TRUNCATE public.lab_prediction_jobs, public.lab_worker_runs, public.official_predictions, public.chappy_predictions, public.official_races;');
}
function race(track, no=1, minutes=90, status='PENDING', circuit='LOCAL') {
  // Parameters below are constants owned by this test suite.
  sql(`INSERT INTO official_races (race_date,track,race_no,circuit,post_time,prediction_status) VALUES (
    (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date,
    '${track}',${no},'${circuit}',clock_timestamp()+interval '${minutes} minutes','${status}');`);
}
function enqueue() {
  return Number(sql("SELECT lab_enqueue_prediction_jobs((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date);"));
}
function run(region='関東', worker='worker-a') {
  return sql(`SELECT lab_start_worker_run('${worker}','${region}');`);
}
function claim(runId, count=1) {
  return value(`SELECT coalesce(json_agg(j),'[]'::json) FROM lab_claim_prediction_jobs('${runId}',${count},300) j;`);
}
function finish(runId, job, outcome='RETRY', error='network timeout', max='NULL') {
  return value(`SELECT row_to_json(j) FROM lab_finish_prediction_job(
    '${runId}','${job.id}','${job.claim_token}','${outcome}','${error}',60,${max}) j;`);
}
function expire(job) {
  // Real clock expiry without sleeps or a public RPC time override.
  sql(`UPDATE lab_prediction_jobs SET claimed_at=clock_timestamp()-interval '2 minutes',
    lease_until=clock_timestamp()-interval '1 minute' WHERE id='${job.id}';`);
}
function session() {
  const child=spawn('psql',args(db),{env,stdio:['pipe','pipe','pipe']});
  let buffer='', errors='', pending=null;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  // ON_ERROR_STOP closes psql on expected competing-save failures.
  child.stdin.on('error',()=>{});
  child.stderr.on('data',d=>{errors+=d;});
  child.stdout.on('data',d=>{
    buffer+=d;
    if (pending && buffer.includes(pending.marker)) {
      const p=pending;pending=null;clearTimeout(p.timeout);
      const out=buffer.slice(0,buffer.indexOf(p.marker)).trim();
      buffer=buffer.slice(buffer.indexOf(p.marker)+p.marker.length);
      p.resolve(out);
    }
  });
  child.on('error',e=>{if(pending){clearTimeout(pending.timeout);pending.reject(e);pending=null;}});
  child.on('exit',code=>{
    if(pending){clearTimeout(pending.timeout);pending.reject(new Error(errors||'psql exited '+code));pending=null;}
  });
  return {
    query(query) {
      if(pending) throw new Error('session query already pending');
      return new Promise((resolve,reject)=>{
        const marker='marker_'+randomUUID().replaceAll('-','');
        const timeout=setTimeout(()=>{pending=null;child.kill();reject(new Error('session timed out: '+errors));},5000);
        pending={marker,resolve,reject,timeout};
        child.stdin.write(query+'\n\\echo '+marker+'\n');
      });
    },
    close(){if(!child.stdin.destroyed && !child.stdin.writableEnded)child.stdin.end('ROLLBACK;\n\\q\n');}
  };
}

const atomicMigration=readFileSync(new URL('../supabase/migrations/20261002023000_automation_reliability_phase2a_atomic_save.sql',import.meta.url),'utf8');
const extraFixture=readFileSync(new URL('./fixtures/automation-phase2a-schema.sql',import.meta.url),'utf8');
const version='LOCAL_TEST_PROTOCOL_V1';
const literal=v=>v===null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
function payload(n=6,v=version) {
  const runners=Array.from({length:n},(_,i)=>({horse_no:i+1,horse_name:'試験馬'+(i+1),rank:i+1,grade:'B',reason:'保持する根拠'+i}));
  // Deliberate saved array order: the RPC must never sort or reselect.
  if(n>=3)[runners[0],runners[2]]=[runners[2],runners[0]];
  return {
    runners,top5:runners.filter(r=>r.rank<=5),
    eye:n>=6?{horse_no:6,horse_name:'試験馬6',rank:6,grade:'B',reason:'この馬固有の上振れ根拠'}:null,
    bets:[],summary:'保存前と同じ要約',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',
    audit:{all_runners_checked:true,market_used_for_ranking:false,field_integrity_checked:true,
      protocol_version:v,execution_profile:'UNIFIED_LOCAL_ABILITY_V1',
      ...(n>=6?{outside_top5_reaudited:true,eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
        rank6_auto_selected:false,eye_audit_specificity_guard:true}:{})}
  };
}
function setup() {
  reset();sql('TRUNCATE lab_prediction_protocols;');
  sql(`INSERT INTO lab_prediction_protocols(protocol_key,version,is_active,content)
    VALUES ('LOCAL_MAIN',${literal(version)},true,'{}');`);
  race('大井');sql("UPDATE official_races SET race_name='registry race name';");
  enqueue();const r=run(),j=claim(r)[0];
  return {r,j,p:payload()};
}
function saveQuery(c,v=version) {
  return `SELECT public.lab_save_claimed_prediction(
    '${c.r}','${c.j.id}','${c.j.claim_token}',${literal(v)},${literal(JSON.stringify(c.p))}::jsonb);`;
}
function save(c,v=version){return sql(saveQuery(c,v));}
function snapshot() {
  return value(`SELECT jsonb_build_object(
    'predictions',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM official_predictions p),
    'jobs',(SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY id),'[]') FROM lab_prediction_jobs j),
    'runs',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM lab_worker_runs r),
    'races',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY race_date,track,race_no,circuit),'[]') FROM official_races r));`);
}
function reject(c,pattern,v=version) {
  const before=snapshot();assert.throws(()=>save(c,v),pattern);
  assert.deepEqual(snapshot(),before,'failed save must leave every table unchanged');
}
function injected(table, timing, body, fn) {
  sql(`CREATE FUNCTION public.phase2a_test_trigger() RETURNS trigger LANGUAGE plpgsql
    SET search_path=pg_catalog AS $$ BEGIN ${body} END $$;
    CREATE TRIGGER phase2a_test ${timing} ON public.${table}
      FOR EACH ROW EXECUTE FUNCTION public.phase2a_test_trigger();`);
  try{return fn();}finally{
    sql(`DROP TRIGGER phase2a_test ON public.${table};DROP FUNCTION public.phase2a_test_trigger();`);
  }
}

before(()=>{
  if(!enabled)return;
  assert.equal(sql("SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');",'postgres'),'0',
    'use a fresh disposable local cluster; run Phase 1 suite on its own fresh cluster');
  sql(`CREATE DATABASE ${db};`,'postgres');
  sql(fixture);sql(extraFixture);sql(phase1Migration);sql(atomicMigration);
  console.log('Disposable atomic-save database retained:',db,'socket:',socket);
});

t('normal atomic save inserts exactly one prediction, completes job and counts once',()=>{
  const c=setup(),id=save(c),state=snapshot();
  assert.match(id,/^[0-9a-f-]{36}$/);
  assert.equal(state.predictions.length,1);assert.equal(state.predictions[0].id,id);
  assert.equal(state.jobs[0].job_status,'DONE');
  for(const key of ['claimed_by','claimed_at','lease_until','claim_token','worker_run_id'])
    assert.equal(state.jobs[0][key],null);
  assert.equal(state.runs[0].claimed_count,1);assert.equal(state.runs[0].completed_count,1);
  assert.equal(state.runs[0].retry_count,0);assert.equal(state.runs[0].failed_count,0);
  const p=state.predictions[0];
  assert.equal(p.status,'FROZEN');assert.equal(p.source,'CHATGPT');
  assert.equal(p.model_label,'GPT-5.6 Sol');assert.equal(p.circuit,'LOCAL');
  assert.equal(p.race_name,'registry race name');assert.equal(p.post_time,state.races[0].post_time);
});
t('payload JSON values, runner order, TOP5 and EYE are preserved exactly',()=>{
  const c=setup();save(c);assert.deepEqual(snapshot().predictions[0].payload,c.p);
});
t('stale token is rejected without any side effects',()=>{
  const c=setup();c.j.claim_token=randomUUID();reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('expired lease is rejected without changing job to RETRY or DEAD',()=>{
  const c=setup();expire(c.j);reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('another run cannot save the current claim',()=>{
  const c=setup();c.r=run('関東','other');reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('reclaimed job rejects the old worker even with a reused worker_id',()=>{
  const c=setup();expire(c.j);const r=run(),current=claim(r)[0];
  reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
  save({...c,r,j:current});assert.equal(snapshot().predictions.length,1);
});
t('claimed_by must match the run worker_id',()=>{
  const c=setup();sql("UPDATE lab_prediction_jobs SET claimed_by='different';");
  reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('non-RUNNING run is rejected',()=>{
  const c=setup();sql("UPDATE lab_worker_runs SET status='FAILED',finished_at=clock_timestamp();");
  reject(c,/SAVE_RUN_NOT_RUNNING/);
});
t('non-CLAIMED job is rejected',()=>{
  const c=setup();finish(c.r,c.j);reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('attempts greater than max_attempts is rejected',()=>{
  const c=setup();sql('UPDATE lab_prediction_jobs SET attempts=max_attempts+1;');
  reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
});
t('last permitted attempt can save with attempts equal to max_attempts',()=>{
  const c=setup();sql('UPDATE lab_prediction_jobs SET attempts=max_attempts;');save(c);
  assert.equal(snapshot().jobs[0].job_status,'DONE');
});
t('registry identity and LOCAL circuit must match the claimed job',()=>{
  const c=setup();sql("UPDATE official_races SET circuit='JRA';");reject(c,/SAVE_RACE_MISMATCH/);
});
t('missing registry row is rejected',()=>{
  const c=setup();sql('DELETE FROM official_races;');reject(c,/SAVE_RACE_MISMATCH/);
});
t('NULL post_time is rejected',()=>{
  const c=setup();sql('UPDATE official_races SET post_time=NULL;');reject(c,/SAVE_PRE_RACE_DEADLINE/);
});
t('three-minute boundary and less than three minutes are rejected',()=>{
  for(const minutes of [3,2]) {
    const c=setup();sql(`UPDATE official_races SET post_time=clock_timestamp()+interval '${minutes} minutes';`);
    reject(c,/SAVE_PRE_RACE_DEADLINE/);
  }
});
t('already started race is rejected',()=>{
  const c=setup();sql("UPDATE official_races SET post_time=clock_timestamp()-interval '1 minute';");
  reject(c,/SAVE_PRE_RACE_DEADLINE/);
});
t('non-PENDING/RETRY prediction_status is rejected',()=>{
  for(const status of ['FROZEN','FAILED']) {
    const c=setup();sql(`UPDATE official_races SET prediction_status='${status}';`);
    reject(c,/SAVE_RACE_STATUS/);
  }
});
t('RETRY registry status can save',()=>{
  const c=setup();sql("UPDATE official_races SET prediction_status='RETRY';");save(c);
  assert.equal(snapshot().jobs[0].job_status,'DONE');
});
t('caller protocol version must match active DB version',()=>{
  const c=setup();reject(c,/SAVE_PROTOCOL_MISMATCH/,'WRONG_VERSION');
});
t('no active LOCAL_MAIN protocol fails closed',()=>{
  const c=setup();sql('UPDATE lab_prediction_protocols SET is_active=false;');
  reject(c,/SAVE_ACTIVE_PROTOCOL_NOT_UNIQUE/);
});
t('multiple active LOCAL_MAIN protocols fail closed',()=>{
  const c=setup();sql("INSERT INTO lab_prediction_protocols(protocol_key,version,is_active,content) VALUES ('LOCAL_MAIN','SECOND_ACTIVE',true,'{}');");
  reject(c,/SAVE_ACTIVE_PROTOCOL_NOT_UNIQUE/);
});
t('active version is read dynamically rather than hardcoded',()=>{
  const c=setup(),next='LOCAL_TEST_PROTOCOL_V2';
  sql(`UPDATE lab_prediction_protocols SET version=${literal(next)};`);
  c.p.audit.protocol_version=next;save(c,next);
  assert.equal(snapshot().predictions[0].protocol_version,next);
});
t('three-column duplicate guard preserves any existing prediction including other circuit',()=>{
  for(const [status,circuit] of [['FROZEN','LOCAL'],['PUBLISHED','LOCAL'],['SETTLED','JRA']]) {
    const c=setup();
    sql(`INSERT INTO official_predictions(race_date,track,race_no,circuit,status)
      SELECT race_date,track,race_no,'${circuit}','${status}' FROM official_races;
      UPDATE official_races SET prediction_status='PENDING' WHERE circuit='LOCAL';`);
    reject(c,/SAVE_PREDICTION_ALREADY_EXISTS/);
  }
});
t('saved legacy prediction is also protected',()=>{
  const c=setup();sql("INSERT INTO chappy_predictions(race_date,track,race_no) SELECT race_date,track,race_no FROM official_races;");
  reject(c,/SAVE_PREDICTION_ALREADY_EXISTS/);
});
t('two independent save connections for one claim succeed only once',async()=>{
  const c=setup(),a=session(),b=session();
  try{
    const id=await a.query('BEGIN; '+saveQuery(c));
    const competing=b.query('BEGIN; '+saveQuery(c)).then(v=>({v}),e=>({e}));
    await a.query('COMMIT;');
    const second=await competing;assert.ok(second.e);
    assert.match(second.e.message,/SAVE_STALE_OR_EXPIRED_CLAIM/);
    const state=snapshot();assert.equal(state.predictions.length,1);
    assert.equal(state.predictions[0].id,id);assert.equal(state.runs[0].completed_count,1);
  }finally{a.close();b.close();}
});
t('old and current worker runs racing after reclaim produce one saved prediction',async()=>{
  const old=setup();expire(old.j);const r=run('関東','current'),j=claim(r)[0],a=session(),b=session();
  try{
    const results=await Promise.all([
      a.query(saveQuery(old)).then(()=>true,()=>false),
      b.query(saveQuery({...old,r,j})).then(()=>true,()=>false)
    ]);
    assert.deepEqual(results,[false,true]);
    assert.equal(snapshot().predictions.length,1);
    assert.equal(sql('SELECT sum(completed_count) FROM lab_worker_runs;'),'1');
  }finally{a.close();b.close();}
});
t('existing AFTER INSERT registry trigger participates in atomic completion',()=>{
  const c=setup();save(c);const state=snapshot();
  assert.equal(state.races[0].prediction_status,'FROZEN');
  assert.equal(state.jobs[0].job_status,'DONE');assert.equal(state.runs[0].completed_count,1);
});
t('AFTER INSERT failure rolls back prediction, registry, job and run counters',()=>{
  const c=setup();
  injected('official_predictions','AFTER INSERT',"RAISE EXCEPTION 'INJECTED_INSERT_FAILURE';",()=>reject(c,/INJECTED_INSERT_FAILURE/));
});
t('job update failure after INSERT rolls back every table',()=>{
  const c=setup();
  injected('lab_prediction_jobs','BEFORE UPDATE',"RAISE EXCEPTION 'INJECTED_JOB_FAILURE';",()=>reject(c,/INJECTED_JOB_FAILURE/));
});
t('run counter update failure after job DONE rolls back every table',()=>{
  const c=setup();
  injected('lab_worker_runs','BEFORE UPDATE',"RAISE EXCEPTION 'INJECTED_RUN_FAILURE';",()=>reject(c,/INJECTED_RUN_FAILURE/));
});
t('deferred trigger failure at commit also rolls back every table',()=>{
  const c=setup(),before=snapshot();
  sql(`CREATE FUNCTION public.phase2a_deferred_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'INJECTED_DEFERRED_FAILURE'; END $$;
    CREATE CONSTRAINT TRIGGER phase2a_deferred_failure AFTER INSERT ON official_predictions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.phase2a_deferred_failure();`);
  try {
    assert.throws(()=>sql('BEGIN; '+saveQuery(c)+' COMMIT;'),/INJECTED_DEFERRED_FAILURE/);
    assert.deepEqual(snapshot(),before);
  } finally {
    sql('DROP TRIGGER phase2a_deferred_failure ON official_predictions;DROP FUNCTION public.phase2a_deferred_failure();');
  }
});
t('BEFORE INSERT trigger suppression cannot mark job DONE',()=>{
  const c=setup();injected('official_predictions','BEFORE INSERT','RETURN NULL;',()=>reject(c,/SAVE_INSERT_SUPPRESSED/));
});
t('BEFORE INSERT payload rewrite is rejected and rolled back',()=>{
  const c=setup();injected('official_predictions','BEFORE INSERT',
    `NEW.payload := jsonb_set(NEW.payload,'{summary}','"changed"'); RETURN NEW;`,
    ()=>reject(c,/SAVE_INSERT_CONTRACT_CHANGED/));
});
t('deadline is rechecked after INSERT triggers run',()=>{
  const c=setup();injected('official_predictions','AFTER INSERT',
    "UPDATE public.official_races SET post_time=clock_timestamp()+interval '2 minutes'; RETURN NEW;",
    ()=>reject(c,/SAVE_PRE_RACE_DEADLINE/));
});
t('lease is rechecked after INSERT triggers run',()=>{
  const c=setup();injected('official_predictions','AFTER INSERT',
    "UPDATE public.lab_prediction_jobs SET claimed_at=clock_timestamp()-interval '2 minutes',lease_until=clock_timestamp()-interval '1 minute'; RETURN NEW;",
    ()=>reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/));
});
t('extra top-level payload key is rejected',()=>{
  const c=setup();c.p.extra='forbidden';reject(c,/SAVE_PAYLOAD_KEYS/);
});
t('missing top-level key is rejected',()=>{
  const c=setup();delete c.p.summary;reject(c,/SAVE_PAYLOAD_KEYS/);
});
t('nonempty bets are rejected',()=>{
  const c=setup();c.p.bets=[{type:'win',horse_no:1}];reject(c,/SAVE_BETS_MUST_BE_EMPTY/);
});
t('wrong bet_strategy is rejected',()=>{
  const c=setup();c.p.bet_strategy='MARKET_SEPARATE';reject(c,/SAVE_BET_STRATEGY/);
});
t('invalid payload container types fail without writes',()=>{
  for(const p of [null,[],{...payload(),runners:{}},{...payload(),audit:null}]) {
    const c=setup();c.p=p;reject(c,/SAVE_PAYLOAD_KEYS|SAVE_PAYLOAD_SHAPE/);
  }
});
for(const key of ['all_runners_checked','market_used_for_ranking','field_integrity_checked','protocol_version','execution_profile'])
  t('required audit field cannot be missing: '+key,()=>{
    const c=setup();delete c.p.audit[key];reject(c,/SAVE_AUDIT_REQUIRED/);
  });
for(const key of ['outside_top5_reaudited','eye_reaudit_guard','rank6_auto_selected','eye_audit_specificity_guard'])
  t('six-runner audit field cannot be missing: '+key,()=>{
    const c=setup();delete c.p.audit[key];reject(c,/SAVE_SIX_RUNNER_AUDIT_REQUIRED/);
  });
t('string booleans do not satisfy typed audit requirements',()=>{
  const c=setup();c.p.audit.all_runners_checked='true';reject(c,/SAVE_AUDIT_REQUIRED/);
});
t('five-runner payload needs only the common audit fields',()=>{
  const c=setup();c.p=payload(5);save(c);
  assert.deepEqual(snapshot().predictions[0].payload,c.p);
});
t('anon/authenticated cannot execute save; service_role can',()=>{
  const c=setup(),before=snapshot();
  for(const role of ['anon','authenticated'])
    assert.throws(()=>sql('SET ROLE '+role+'; '+saveQuery(c)),/permission denied/);
  assert.deepEqual(snapshot(),before);
  sql('SET ROLE service_role; '+saveQuery(c));
  assert.equal(snapshot().jobs[0].job_status,'DONE');
});
t('failed save remains CLAIMED until caller explicitly invokes Phase 1 RETRY',()=>{
  const c=setup();reject(c,/SAVE_PROTOCOL_MISMATCH/,'WRONG');
  assert.equal(snapshot().jobs[0].job_status,'CLAIMED');
  finish(c.r,c.j,'RETRY','protocol mismatch');
  assert.equal(snapshot().jobs[0].job_status,'RETRY');
  assert.equal(snapshot().runs[0].retry_count,1);
});
t('second save after successful completion is rejected and counter is not doubled',()=>{
  const c=setup();save(c);reject(c,/SAVE_STALE_OR_EXPIRED_CLAIM/);
  assert.equal(snapshot().runs[0].completed_count,1);
});