import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const sql=read('sql/production-rollback-validation.sql')
const clean=sql.replace(/--[^\n]*/g,'')
test('single outer transaction starts BEGIN ends ROLLBACK; no commit',()=>{
 assert.ok(sql.startsWith('BEGIN;\n'));assert.ok(sql.trimEnd().endsWith('ROLLBACK;'))
 assert.ok(!/\bCOMMIT\b/i.test(sql));assert.equal((clean.match(/\bROLLBACK\s*;/gi)||[]).length,1)
})
test('no forbidden infrastructure or pre-existing object changes',()=>{
 assert.ok(!/\b(?:CREATE\s+EXTENSION|ALTER\s+(?:ROLE|DATABASE)|DROP\s+|CREATE\s+OR\s+REPLACE|ALTER\s+DEFAULT|cron\.)/i.test(clean))
 // A function's fixed search_path is mandatory; session settings are forbidden.
 const withoutFunctionPath=clean.replace(/SET search_path=pg_catalog/g,'')
 assert.ok(!/^\s*SET\s+(?:SESSION|search_path)\b/im.test(withoutFunctionPath))
 for(const m of clean.matchAll(/\bALTER\s+TABLE\s+([^\s;]+)/gi))assert.ok(m[1].startsWith('local_shadow.'))
 assert.ok(clean.includes('VALIDATION_OBJECTS_ALREADY_EXIST'))
})
test('all DML targets SHADOW only, including copied RPC bodies',()=>{
 const targets=[...clean.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+([a-z_][a-z_0-9.]*)(?=\s|\()/gi)]
 assert.ok(targets.length>10)
 for(const m of targets){
  // Trigger syntax has UPDATE OR DELETE; it is not DML.
  if(['OR','ON'].includes(m[1].toUpperCase()))continue
  assert.ok(m[1].startsWith('local_shadow.'),m[0])
 }
 assert.ok(!/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+public\./i.test(clean))
})
test('DDL exactly matches proposal; no hidden test relaxation',()=>{
 const proposal=read('sql/input-archive-migration-proposal.sql')
 const ddl=proposal.slice(proposal.indexOf('CREATE SCHEMA'),proposal.indexOf('\nCOMMIT;'))
 assert.ok(sql.includes(ddl));assert.equal((sql.match(/CREATE TABLE local_shadow\./g)||[]).length,3)
})
test('covers permission roles, constraints, and honest frozen-link marker',()=>{
 for(const key of ['SET LOCAL ROLE service_role','SET LOCAL ROLE anon','SET LOCAL ROLE authenticated',
 'aclexplode','a.grantee=0','relrowsecurity','HASH_CHECK_NOT_ENFORCED','CAPTURE_TIME_CHECK_NOT_ENFORCED',
 'RECEIVE_TIME_CHECK_NOT_ENFORCED','LINK_UPDATE_ALLOWED','LINK_DELETE_ALLOWED','LINK_TRUNCATE_ALLOWED',
 'FROZEN_LINK_REAL_DB_UNVERIFIED','ASSERTIONS_DISABLED'])assert.ok(sql.includes(key),key)
 assert.ok(!/INSERT INTO public\./.test(sql))
})
test('separate rollback absence check is SELECT-only and covers all overloads',()=>{
 const q=read('sql/production-rollback-postcheck.sql').replace(/--[^\n]*/g,'')
 assert.ok(q.trimStart().startsWith('SELECT'));assert.ok(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(q))
 for(const key of ['shadow_schema_absent','capture_rpc_absent','link_rpc_absent'])assert.ok(q.includes(key))
})
