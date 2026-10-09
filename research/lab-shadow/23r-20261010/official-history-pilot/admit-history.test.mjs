import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {admitHorse} from './admit-history.mjs';
const root=new URL('./',import.meta.url);
const data=JSON.parse(await readFile(new URL('extracted-evidence.json',root),'utf8'));
const log=JSON.parse(await readFile(new URL('fetch-log.json',root),'utf8'));
const cardBytes=await readFile(new URL(data.card.path,root));
for(const entry of data.runners){
 const fetch=log.find(f=>f.horse_no===entry.raw.horse_no);
 const evidence={cardBytes,cardHash:data.card.sha256,cardCapturedAt:data.card.download_completed_at,fetch,profileBytes:await readFile(new URL(fetch.path,root))};
 test(`horse ${entry.raw.horse_no}: archived official profile admits latest five`,()=>{
  const r=admitHorse(entry,data.race,evidence);
  assert.equal(r.identity_status,'OFFICIAL_PROFILE_LINK_MATCHED');assert.equal(r.recent_runs.length,5);
  assert.equal(r.history_candidates.filter(c=>c.status==='OFFICIAL_MATCHED').length,5);
  assert.equal(r.production_dispatch_allowed,false);
  for(const h of r.recent_runs){assert.ok(h.race_date<data.race.race_date);assert.equal(h.identity_verified_by,'OFFICIAL_HORSE_REF');assert.equal(h.source_ref,fetch.url);assert.equal(h.early_pos,null);assert.equal(h.final_turn_pos,null);}
 });
 test(`horse ${entry.raw.horse_no}: RAW true flags without HTML never admit`,()=>{
  const forged=structuredClone(entry);forged.raw.identity_verified=true;forged.raw.official_verified=true;
  const r=admitHorse(forged,data.race,{});assert.equal(r.recent_runs.length,0);assert.ok(r.history_candidates.every(c=>c.status==='OFFICIAL_MATCH_INCOMPLETE'));
 });
 if(entry.raw.horse_no===1){
  for(const [name,change] of [
   ['missing profile bytes',e=>e.profileBytes=null],
   ['tampered HTML',e=>e.profileBytes=Buffer.from('forged')],
   ['non-200 response',e=>e.fetch.status=403],
   ['post-time evidence',e=>e.fetch.fetched_at=data.race.post_time],
  ])test(name,()=>{const e=structuredClone(evidence);change(e);assert.equal(admitHorse(entry,data.race,e).recent_runs.length,0);});
  for(const [name,change] of [
   ['forged profile row',e=>e.profile.rows.find(r=>r.cells[0]==='2026/09/26').cells[13]='1'],
   ['missing DOM identity link',e=>e.horse_link_evidence=null],
   ['forged current weight',e=>e.current.weight_carried=99],
  ])test(name,()=>{const e=structuredClone(entry);change(e);assert.equal(admitHorse(e,data.race,evidence).recent_runs.length,0);});
 }
}
test('pilot scope and shared frame rowspan',()=>{
 assert.deepEqual(data.runners.map(e=>e.raw.horse_no),[1,2,3,4,5,7,8,9]);
 assert.equal(data.runners.find(e=>e.raw.horse_no===9).current.draw,8);
 assert.equal(data.runners.find(e=>e.raw.horse_no===2).current.weight_carried,56);
 assert.equal(data.runners.find(e=>e.raw.horse_no===7).current.weight_carried,54);
 assert.ok(data.runners.every(e=>e.current.body_weight===null && e.current.equipment===null));
});
test('evaluation draft keeps full-field acceptance and READY disabled',async()=>{
 const out=JSON.parse(await readFile(new URL('pilot-results.json',root),'utf8'));
 assert.equal(out.draft_context.field_integrity_checked,false);
 assert.equal(out.draft_context.protocol.enforced_server_side,false);
 assert.equal(out.overall_status,'BLOCKED');assert.equal(out.ready_changed,false);
 assert.equal(out.production_dispatch_allowed,false);
 assert.equal(out.axes.B.status,'PARTIALLY_VERIFIED');
 assert.equal(out.draft_context.runners.reduce((n,r)=>n+r.recent_runs.length,0),40);
 assert.ok(out.draft_context.runners.every(r=>r.recent_runs.every(h=>h.early_pos===null&&h.final_turn_pos===null)));
});
