#!/usr/bin/env python3
"""Real multi-session test; never execute against production. Requires local psql.
JRA_ISOLATED_TEST_APPROVED=YES, PGHOST localhost/127.0.0.1, PGDATABASE jra_shadow_test*.
No credentials printed. Uses inherited PostgreSQL credential handling.
"""
import os, subprocess, json, time, pathlib, shutil
ROOT=pathlib.Path(__file__).resolve().parents[2]
if os.environ.get('JRA_ISOLATED_TEST_APPROVED')!='YES' or os.environ.get('PGHOST') not in ('localhost','127.0.0.1') or not os.environ.get('PGDATABASE','').startswith('jra_shadow_test'):
 raise SystemExit('BLOCKED: explicitly approved isolated local PostgreSQL required')
if not shutil.which('psql'): raise SystemExit('BLOCKED: psql unavailable')
def cmd(): return ['psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1']
def run(sql):
 p=subprocess.run(cmd(),input=sql,text=True,capture_output=True,timeout=20)
 if p.returncode: raise RuntimeError('ISOLATED_SQL_FAILED (credential/error details suppressed)')
 return p.stdout.strip()
if run("SELECT current_database() LIKE 'jra_shadow_test%' AND (inet_server_addr() IS NULL OR inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet));")!='t': raise SystemExit('BLOCKED: server/database not isolated')
if run("SELECT to_regnamespace('jra_evidence_private') IS NULL AND to_regprocedure('public.jra_store_html_evidence_v1(jsonb,bytea)') IS NULL;")!='t':raise SystemExit('BLOCKED: candidate objects already exist')
f=json.loads((ROOT/'research/jra-evidence-followup/quota-fixtures.json').read_text())
a,b=f['first'],f['second'];limit=max(a['meta']['compressed_bytes'],b['meta']['compressed_bytes'])
s=(ROOT/'research/jra-evidence-security/storage-proposal.sql').read_text().split('ROLLBACK;')[0].replace('536870912',str(limit)).replace('>=100000','>=2')
# COMMIT belongs only to explicitly isolated test database, never production validation.
run(s+'COMMIT;')
def quote(x): return "'"+x.replace("'","''")+"'"
def request(f):return 'SELECT public.jra_store_html_evidence_v1('+quote(json.dumps(f['meta']))+'::jsonb,decode('+quote(f['gzip_hex'])+",'hex'));"
def pair(second,expect_second_success):
 holder=subprocess.Popen(cmd(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 holder.stdin.write('BEGIN; SELECT pg_advisory_xact_lock(47004,1); SELECT pg_sleep(3); '+request(a)+' COMMIT;');holder.stdin.close()
 deadline=time.monotonic()+2
 while run("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=47004 AND objid=1 AND granted);")!='t':
  if time.monotonic()>deadline:holder.kill();raise RuntimeError('HOLDER_NOT_OBSERVED')
  time.sleep(.05)
 start=time.monotonic()
 contender=subprocess.run(cmd(),input='BEGIN; '+request(second)+' COMMIT;',text=True,capture_output=True,timeout=15)
 holder.wait(timeout=10)
 if holder.returncode or (contender.returncode==0)!=expect_second_success or time.monotonic()-start<1:raise RuntimeError('CONCURRENT_RESULT_MISMATCH')
 if not expect_second_success and 'EVIDENCE_CAPACITY_LIMIT' not in contender.stderr:raise RuntimeError('WRONG_FAILURE')
 try_counts=run('SELECT count(*) FROM jra_evidence_private.html_blobs; SELECT count(*) FROM jra_evidence_private.html_captures;').splitlines()
 return try_counts
try:
 if pair(a,True)!=['1','1']:raise RuntimeError('SAME_HASH_DUPLICATED')
 # Another observation on same blob, and idempotent replay at event cap2.
 a2=json.loads(json.dumps(a));a2['meta'].update(fetched_at='2026-10-10T00:00:00Z',expires_at='2026-11-09T00:00:00Z')
 run(request(a2));run(request(a2))
 if run('SELECT count(*) FROM jra_evidence_private.html_captures;')!='2':raise RuntimeError('FULL_CAP_REPLAY_FAILED')
 run('TRUNCATE jra_evidence_private.html_captures,jra_evidence_private.html_blobs RESTART IDENTITY;')
 if pair(b,False)!=['1','1']:raise RuntimeError('CONCURRENT_BUDGET_EXCEEDED')
 print('PASS: same-hash concurrent replay, full-event-cap replay, concurrent byte-budget rejection')
finally:
 # Dedicated test DB only. No production cleanup path.
 run('DROP FUNCTION public.jra_store_html_evidence_v1(jsonb,bytea); DROP SCHEMA jra_evidence_private CASCADE;')
