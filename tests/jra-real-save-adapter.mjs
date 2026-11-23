// CI-only synchronous transport to a disposable PostgreSQL17 service.
// Calls EXACT archived save/wrapper SQL. Table/auth/context dependencies are fixtures.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const quoted=value=>"'"+String(value).replaceAll("'","''")+"'";
export function saveInIsolatedPostgres(args,context){
 if(process.env.JRA_TEST_REAL_PG!=='1'||process.env.PGDATABASE!=='ledger_test'||process.env.PGHOST!=='localhost'||process.env.PGPASSWORD!=='ephemeral_ci_only')throw Error('ISOLATED_PG_REQUIRED');
 let bootstrap=readFileSync(new URL('tests/jra-real-save-postgres.sql',root),'utf8').split('CREATE FUNCTION pg_temp.assert_true')[0];
 bootstrap=bootstrap.replace(/^\\set[^\n]*\n/gm,'').replace(/^\\ir (.+)$/gm,(_,path)=>readFileSync(new URL('tests/'+path,root),'utf8'));
 const q=quoted,jid=q(args.p_job_id),payload=q(JSON.stringify(args.p_payload)),race=context.race;
 const sql=bootstrap+`
 INSERT INTO public.lab_prediction_protocols VALUES('JRA_MAIN',true,'SYNTHETIC_PROTOCOL');
 INSERT INTO public.jra_prediction_worker_runs VALUES('00000000-0000-4000-8000-000000000009','RUNNING','JRA_QUEUE_RESCUE',0);
 INSERT INTO public.jra_prediction_jobs VALUES(${jid},'CLAIMED',clock_timestamp()+interval '15 minutes','00000000-0000-4000-8000-000000000009','JRA_QUEUE_RESCUE',${q(race.race_date)},${q(race.track)},${race.race_no},'00000000-0000-4000-8000-000000000008',clock_timestamp(),NULL,clock_timestamp());
 INSERT INTO public.official_races VALUES(${q(race.race_date)},${q(race.track)},${race.race_no},'JRA',${q(race.post_time)},'PENDING',${q(JSON.stringify(race.field_payload))}::jsonb,'SYNTHETIC_ONLY');
 CREATE TEMP TABLE actual_receipt AS SELECT public.jra_save_claimed_prediction_with_shadow_v1(${jid},${q(args.p_protocol_version)},${payload}::jsonb,NULL,NULL) receipt;
 SELECT jsonb_build_object('receipt',(SELECT receipt FROM actual_receipt),'stored',(SELECT row_to_json(p) FROM public.official_predictions p),'job_done',(SELECT job_status='DONE' FROM public.jra_prediction_jobs WHERE id=${jid}));
 ROLLBACK;
 DO $$ BEGIN IF to_regclass('public.official_predictions') IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_INCOMPLETE';END IF;END $$;
 `;
 const r=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
 if(r.status!==0)throw Error('ISOLATED_SAVE_SQL_FAILED: '+String(r.stderr).slice(0,500));
 const line=r.stdout.split('\n').find(s=>s.startsWith('{'));
 const actual=JSON.parse(line??'null');if(!actual?.job_done||!actual.receipt?.ok||actual.stored?.status!=='FROZEN')throw Error('ISOLATED_SAVE_RECEIPT_INVALID');
 return actual;
}
