import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convertRace,convertDay,validateDraftStructure} from './compact-v1-adapter.mjs';
const raw=JSON.parse(await readFile(new URL('../2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(raw.races[0]);

for (const race of raw.races) test(`${race.track}${race.race_no}R offline conversion keeps ACTIVE field, false flags and independent quality status`,()=>{
  const result=convertRace(race),context=result.draft_context;
  assert.equal(validateDraftStructure(context).ok,true);
  assert.deepEqual(context.runners.map(r=>r.horse_no),race.runners.filter(r=>r.status==='ACTIVE').map(r=>r.horse_no));
  assert.equal(context.field_integrity_checked,false);assert.equal(context.protocol.enforced_server_side,false);
  assert.equal(result.axes.A.status,'DRAFT_STRUCTURE_MATCH');assert.equal(result.axes.A.production_contract_accepted,false);
  assert.equal(result.axes.B.status,'UNVERIFIED');assert.equal(result.axes.C.status,'NOT_MET');
  assert.equal(result.overall_status,'BLOCKED');assert.equal(result.production_dispatch_allowed,false);
  assert.ok(context.runners.every(r=>r.recent_runs.length===0 && r.history_source_refs.length===0 && r.jockey===null && r.weight_carried===null));
  assert.ok(result.unverified_history_candidates.every(r=>r.latest_max_five.length<=5 && r.latest_max_five.every(h=>h.verification_status==='UNVERIFIED')));
});
test('day aggregate: 23 drafts, 230 ACTIVE, zero verified admission, no READY',()=>{
  const r=convertDay(raw);assert.equal(r.summary.races,23);assert.equal(r.summary.active_runners,230);
  assert.equal(r.summary.structure_matches,23);assert.equal(r.summary.production_accepted,0);
  assert.equal(r.summary.official_verified,0);assert.equal(r.summary.admitted_verified_history_rows,0);
  assert.equal(r.summary.unverified_history_candidates,1132);assert.equal(r.summary.ready,0);assert.equal(r.summary.blocked,23);
});
test('recorded LOCAL date and HH:mm become JST timestamp, without proving official timing',()=>{
  const result=convertRace(fresh());
  assert.equal(result.draft_context.race.post_time,'2026-10-10T15:35:00+09:00');
  assert.equal(result.axes.B.status,'UNVERIFIED');
  for(const clock of ['24:00','15:99','15:3','unknown']){const race=fresh();race.scheduled_start=clock;assert.throws(()=>convertRace(race));}
});
test('input JSON remains byte-equivalent after conversion',()=>{
  const input=structuredClone(raw),before=JSON.stringify(input);convertDay(input);assert.equal(JSON.stringify(input),before);
});
test('renames factual fields but keeps unknown positions and body weight null',()=>{
  const race=fresh(),result=convertRace(race);const before=race.runners.find(r=>r.status==='ACTIVE').recent_card_slots[0];
  const after=result.unverified_history_candidates[0].latest_max_five.find(x=>x.slot_index===0).fields;
  assert.equal(after.distance,before.distance_m);assert.equal(after.time_raw,before.time);assert.equal(after.weight_carried,before.weight_kg);
  assert.equal(after.finish,before.finish);assert.equal(after.final3f,before.final3f);assert.equal(after.margin,before.margin);
  assert.equal(after.early_pos,null);assert.equal(after.final_turn_pos,null);assert.equal(after.body_weight,null);
});
test('JRA race numbers and detail URLs stay null; observed venue prefix is normalized only',()=>{
  const r=convertDay(raw).races.flatMap(r=>r.unverified_history_candidates).flatMap(r=>r.latest_max_five);
  const central=r.filter(x=>['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'].includes(x.fields.track));
  assert.equal(central.length,124);assert.ok(central.every(x=>x.fields.race_no===null && x.claimed_detail_url===null && x.verification_status==='UNVERIFIED'));
});
test('past jockey/weight and caller-added current attributes never become verified current fields',()=>{
  const race=fresh();for(const r of race.runners){r.jockey='unverified caller';r.weight_carried=57;r.sex_age='牡3';}
  const context=convertRace(race).draft_context;
  assert.ok(context.runners.every(r=>r.jockey===null && r.weight_carried===null && r.sex_age===null && r.missing_items.includes('jockey')));
});
test('source claims and injected positions do not promote verification or derive style',()=>{
  const race=fresh();race.field_integrity_checked=true;
  for(const r of race.runners) for(const h of r.recent_card_slots){h.verified=true;h.identity_verified_by='OFFICIAL_HORSE_REF';h.early_pos=1;h.final_turn_pos=2;}
  const result=convertRace(race);assert.equal(result.axes.B.status,'UNVERIFIED');assert.equal(result.draft_context.field_integrity_checked,false);
  assert.ok(result.draft_context.runners.every(r=>r.recent_runs.length===0 && JSON.stringify(r.running_style_reference)==='["?"]'));
  assert.ok(result.unverified_history_candidates.flatMap(r=>r.latest_max_five).every(h=>h.fields.early_pos===null && h.fields.final_turn_pos===null));
});
test('non-completed dated history is retained as a candidate, not replaced by an invented older completion',()=>{
  const race=raw.races.find(r=>r.track==='高知'&&r.race_no===5),result=convertRace(race);
  const runner=result.unverified_history_candidates.find(r=>r.horse_no===4);
  assert.equal(runner.latest_max_five.length,5);assert.equal(runner.latest_max_five.filter(x=>x.fields.finish===null).length,1);
  assert.equal(result.axes.A.status,'DRAFT_STRUCTURE_MATCH');assert.equal(result.axes.C.status,'NOT_MET');
});
test('short career is not labeled production-ineligible just because fewer than five candidates exist',()=>{
  const result=convertRace(raw.races.find(r=>r.track==='佐賀'&&r.race_no===1));
  assert.equal(result.axes.A.status,'DRAFT_STRUCTURE_MATCH');assert.equal(result.axes.B.status,'UNVERIFIED');
  assert.equal(result.unverified_history_candidates.find(r=>r.horse_no===7).latest_max_five.length,1);
  assert.ok(result.draft_context.runners.every(r=>r.missing_items.includes('recent_runs:0/5')));
});
test('latest max five sorts before trimming; hypothetical synthetic sixth run is never persisted',()=>{
  const race=fresh(),runner=race.runners.find(r=>r.status==='ACTIVE');
  const synthetic=structuredClone(runner.recent_card_slots[0]);synthetic.race_date='2026-09-30';synthetic.race_no=12;
  runner.recent_card_slots.push(synthetic);runner.recent_card_slots.reverse();
  const result=convertRace(race).unverified_history_candidates.find(r=>r.horse_no===runner.horse_no);
  assert.equal(result.latest_max_five.length,5);assert.equal(result.latest_max_five[0].fields.race_date,'2026-09-30');
  assert.ok(result.excluded.some(x=>x.reason==='OUTSIDE_LATEST_MAX_FIVE'));
});
test('target-day histories and empty slots stay out of candidate list',()=>{
  const race=fresh(),runner=race.runners.find(r=>r.status==='ACTIVE');runner.recent_card_slots[0].race_date=race.race_date;
  runner.recent_card_slots[1]={};const result=convertRace(race).unverified_history_candidates.find(r=>r.horse_no===runner.horse_no);
  assert.ok(result.excluded.some(x=>x.reason==='NOT_PROVEN_PRIOR'));assert.ok(result.excluded.some(x=>x.reason==='EMPTY_OR_UNDATED_SLOT'));
});
test('duplicate and conflicting histories never silently overwrite facts',()=>{
  const race=fresh(),runner=race.runners.find(r=>r.status==='ACTIVE');runner.recent_card_slots[1]=structuredClone(runner.recent_card_slots[0]);
  assert.ok(convertRace(race).unverified_history_candidates[0].excluded.some(x=>x.reason==='DUPLICATE_HISTORY'));
  runner.recent_card_slots[1].time='9:59.9';const result=convertRace(race);
  assert.equal(result.unverified_history_candidates[0].latest_max_five[0].verification_status,'CONFLICT');
  assert.equal(result.draft_context.runners[0].recent_runs.length,0);
});
test('quality can be MET on a hypothetical complete fixture while official verification remains false',()=>{
  const race=structuredClone(raw.races.find(r=>r.track==='高知'&&r.race_no===3));race.conditions.weather='晴';race.conditions.going='良';
  const result=convertRace(race);assert.equal(result.axes.C.status,'MET');assert.equal(result.axes.B.status,'UNVERIFIED');
  assert.equal(result.overall_status,'BLOCKED');assert.equal(result.production_dispatch_allowed,false);
});
test('market, results, scores, raw HTML and secrets are never projected into context or history candidates',()=>{
  const race=fresh();race.api_key='SENTINEL_SECRET';race.target_result={winner:1};race.html='SENTINEL_HTML';
  for(const r of race.runners){r.odds=1.2;for(const h of r.recent_card_slots){h.lab_score=99;h.popularity=1;h.api_key='SENTINEL_SECRET';}}
  const result=JSON.stringify(convertRace(race));for(const token of ['SENTINEL_SECRET','SENTINEL_HTML','"lab_score"','"popularity"','"odds"','"target_result"'])assert.ok(!result.includes(token));
});
const invalid=[
  ['unknown status',r=>r.runners[0].status='UNKNOWN'],
  ['duplicate horse number',r=>r.runners[1].horse_no=r.runners[0].horse_no],
  ['empty ACTIVE',r=>r.runners.forEach(x=>x.status='CANCELLED')],
  ['wrong post date',r=>r.scheduled_start='2026-10-11T20:00:00+09:00'],
  ['banei',r=>r.track='帯広ば'],
  ['malformed history',r=>r.runners[0].recent_card_slots=[null]],
];
for(const [name,change] of invalid)test(`malformed RAW fails closed: ${name}`,()=>{const r=fresh();change(r);assert.throws(()=>convertRace(r));});
test('day rejects duplicate races even with 23 rows',()=>{const d=structuredClone(raw);d.races[1]=structuredClone(d.races[0]);assert.throws(()=>convertDay(d));});
test('draft validator rejects accidental true flags, history admission and malformed containers',()=>{
  for(const change of [c=>c.field_integrity_checked=true,c=>c.protocol.enforced_server_side=true,c=>c.runners[0].recent_runs=[{}],c=>c.runners={}]){
    const c=convertRace(fresh()).draft_context;change(c);assert.equal(validateDraftStructure(c).ok,false);
  }
});
