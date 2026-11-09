import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(
  new URL('../research/2026-11-09-jra-queue-security-hardening.sql',import.meta.url),'utf8'
);
const guardedFunctions=[
 'jra_save_claimed_prediction(uuid,text,jsonb)',
 'jra_finish_prediction_job(uuid,text,text,integer)',
 'jra_finish_worker_run(uuid,text,text)',
 'jra_start_worker_run(text)',
 'jra_claim_prediction_jobs(uuid,integer,integer)',
 'jra_enqueue_prediction_jobs(date)'
];

test('JRA queue tables deny API clients, keep server access and enable RLS',()=>{
 assert.match(migration,/REVOKE ALL ON TABLE\s+public\.jra_prediction_jobs,\s+public\.jra_prediction_worker_runs FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/ALTER TABLE public\.jra_prediction_jobs ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/ALTER TABLE public\.jra_prediction_worker_runs ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE\s+public\.jra_prediction_jobs,\s+public\.jra_prediction_worker_runs TO service_role/);
});

test('JRA privileged save/finalize and queue RPCs all lose anonymous execution',()=>{
 const grant=migration.match(/GRANT EXECUTE ON FUNCTION([\s\S]*?)TO service_role;/)?.[1]??'';
 const revoke=migration.match(/REVOKE EXECUTE ON FUNCTION([\s\S]*?)FROM PUBLIC,anon,authenticated;/)?.[1]??'';
 for(const sig of guardedFunctions){
  const name='public.'+sig;
  assert.ok(grant.includes(name),'service role must retain '+name);
  assert.ok(revoke.includes(name),'public role must lose '+name);
 }
});

test('hardening does not touch predictions, queue rows, result rows or any Cron',()=>{
 const statements=migration.split(';').map(x=>x.split('\n')
   .filter(line=>!line.trim().startsWith('--')).join(' ').trim()).filter(Boolean);
 for(const statement of statements)
   assert.doesNotMatch(statement,/^(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE\s+|DROP\s+TABLE|CREATE\s+POLICY)/i);
 assert.doesNotMatch(migration,/official_predictions|official_results|pg_cron|cron\.schedule/i);
});

test('functions are not replaced or shadow model adopted by security migration',()=>{
 assert.doesNotMatch(migration,/CREATE OR REPLACE FUNCTION|CREATE TRIGGER|ALTER FUNCTION|rank_effect|BET_STRATEGY/i);
});
