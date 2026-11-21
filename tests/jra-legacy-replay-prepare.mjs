// Creates scripts for an ephemeral PostgreSQL service; never opens a connection.
import fs from 'node:fs';import {legacyReadonlyQuery,validateLegacyReplayInput} from '../automation/jra-score-ledger/legacy-readonly-replay.mjs';
const root='research/jra-scoring-integrity-20261121/final-connection/';
const query=legacyReadonlyQuery(fs.readFileSync(root+'source/refresh_jra_live_rank_beta.sql','utf8'));
const files=fs.readdirSync(root+'batches').filter(f=>/^input-\d+\.json$/.test(f)).sort();
for(const file of files){
 const input=JSON.parse(fs.readFileSync(root+'batches/'+file)),n=file.match(/\d+/)[0];validateLegacyReplayInput(input);
 const races=new Set(input.rows.map(x=>x.live_race_id));if(races.size>5)throw Error('BATCH_EXCEEDS_FIVE_RACES');
 fs.writeFileSync('/tmp/jra-replay-'+n+'.csv','"'+JSON.stringify(input).replaceAll('"','""')+'"\n');
 const ddl=`\\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_database()<>'ledger_test' THEN RAISE EXCEPTION 'EPHEMERAL_DATABASE_ONLY'; END IF; END $$;
CREATE TEMP TABLE packet(doc jsonb);
\\copy packet FROM '/tmp/jra-replay-${n}.csv' WITH (FORMAT csv)
CREATE TEMP TABLE jra_live_races(id uuid,race_date date,track text,race_no int,surface text,distance int,going text,race_type text);
CREATE TEMP TABLE jra_live_runners(id uuid,live_race_id uuid,horse_no int,horse_name text,horse_ref text,jockey text,past_runs jsonb);
CREATE TEMP TABLE jra_transition_daily_stats(race_date date,prev_track text,prev_surface text,prev_distance int,prev_going text,track text,surface text,distance int,going text,runners int,wins int,top3s int);
CREATE TEMP TABLE jra_jockey_daily_stats(race_date date,track text,jockey text,runners int,wins int,top3s int);
INSERT INTO jra_live_races SELECT DISTINCT (r->>'live_race_id')::uuid,(r->>'race_date')::date,r->>'track',(r->>'race_no')::int,r->'conditions'->>'surface',(r->'conditions'->>'distance')::int,r->'conditions'->>'going',r->'conditions'->>'race_type' FROM packet CROSS JOIN LATERAL jsonb_array_elements(doc->'rows') r;
INSERT INTO jra_live_runners SELECT (r->>'live_runner_id')::uuid,(r->>'live_race_id')::uuid,(r->>'horse_no')::int,r->>'horse_name',r->>'live_horse_ref',r->>'jockey',r->'past_runs' FROM packet CROSS JOIN LATERAL jsonb_array_elements(doc->'rows') r;
\\o /tmp/jra-replay-output-${n}.json
SELECT jsonb_agg(to_jsonb(q) ORDER BY race_date,track,race_no,horse_no) FROM (${query}) q;
\\o /tmp/jra-replay-output-${n}-repeat.json
SELECT jsonb_agg(to_jsonb(q) ORDER BY race_date,track,race_no,horse_no) FROM (${query}) q;
\\o
ROLLBACK;
DO $$ BEGIN IF to_regclass('pg_temp.jra_live_runners') IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF; END $$;
`;
 fs.writeFileSync('/tmp/jra-replay-'+n+'.sql',ddl);
}
console.log('Prepared isolated readonly SELECT replay batches:',files.length);
