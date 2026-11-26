import assert from 'node:assert/strict';
import {analyzeField100} from './analyze-field-100.mjs';
import {strengthen40to42and46and53} from './strengthen-40-42-46-53.mjs';
import {common} from './common-evidence.mjs';
for(const circuit of ['JRA','LOCAL']){
 const target={circuit,race_id:'T',field_size:3,cutoff:'2026-11-22T04:00:00Z',started_at:'2026-11-22T05:00:00Z',local_date:'2026-11-22',conditions_verified:true,course_id:'C',course_version:'v',surface:'DIRT',distance:1200,going:'GOOD',class_key:'C1',layout:'L',eligibility:'E',early_segment_m:400};
 const prefix=circuit+':',evidence=[];
 const ev=(evidence_id,horse_id,race_id,runner_no,date='2026-10-02',source_id=circuit==='JRA'?'J_PROFILE':'N_PROFILE')=>{
 const e={evidence_id,horse_id,race_id,runner_no,source_id,source_url:'fixture',source_version:'1',identity_status:'VERIFIED',permission_status:'CLEARED_FOR_RESEARCH_USE',raw_sha256_or_null:'a'.repeat(64),fact_or_proxy:'FACT',published_at_or_null:date+'T01:00:00Z',observed_at:date+'T02:00:00Z',cutoff:target.cutoff};evidence.push(e);return e;};
 const roster=[1,2,3].map(n=>{const horse_id=prefix+n;return {...ev('h'+n,horse_id,'T',n),horse_no:n,source_verified:true,source_ref:'fixture',published_at:'2026-10-02T01:00:00Z'};});
 const runs=roster.map(h=>{const n=h.horse_no;return {...target,race_id:'R'+n,horse_id:h.horse_id,evidence_id:ev('r'+n,h.horse_id,'R'+n,n).evidence_id,started_at:'2026-10-01T00:00:00Z',local_date:'2026-10-01',field_size:8,finish:n===2?6:1,status:'FINISHED',positions:[{segment:1,rank_min:n===2?5:1,rank_max:n===2?5:1}],expected_segments:1,all_segments_verified:true,first_segment:1,segment_definition_verified:true,body_weight_kg:480,jockey_id:'J',actual_gate_verified:true,gate:n,early_rank:n===2?5:1};});
 const history=roster.map(h=>({horse_id:h.horse_id,evidence_id:ev('w'+h.horse_no,h.horse_id,'T',h.horse_no).evidence_id,chronology_verified:true,ordered_race_ids:['R'+h.horse_no]}));
 const gates=roster.map(h=>({horse_id:h.horse_id,evidence_id:ev('g'+h.horse_no,h.horse_id,'T',h.horse_no).evidence_id,gate:h.horse_no,actual_gate_verified:true}));
 const current=roster.map(h=>({horse_id:h.horse_id,evidence_id:ev('c'+h.horse_no,h.horse_id,'T',h.horse_no).evidence_id,body_weight_kg:485,conditions_verified:true,distance:1200,jockey_id:'J'}));
 const paceBenchmarks=runs.map(r=>({...r,horse_id:null,evidence_id:ev('b'+r.race_id,null,r.race_id,null).evidence_id,race_level_only:true,early_segment_m:400,early_seconds:24}));
 const args={baseArgs:{input:{circuit,targetDate:target.local_date,targetRaceId:'T',cutoff:target.cutoff,roster:[1,2,3],rows:[]}},oppositionArgs:{target,roster},evidence,paceMaterials:{runs,history,gates,paceBenchmarks},stateMaterials:{runs,history,current},changeMaterials:{runs,history,currentConditions:current},strengtheningMaterials:{drawHistories:runs}};
 const z=analyzeField100(args);
 assert.equal(z.audit.runners.length,3);
 assert.ok(z.audit.runners.every(h=>h.items.length===100&&h.items.every(i=>!i.release_eligible)));
 assert.equal(z.pace.runners[1].items['66'].hypotheses[0].value.pattern,'PATTERN');
 assert.equal(z.pace.runners[0].items['63'].facts[0].value.lower,2/3);
 assert.equal(z.pace.runners[0].items['69'].hypotheses[0].value.benchmark_n,3);
 assert.equal(z.state.runners[0].items['81'].facts[0].value.delta_kg,5);
 assert.equal(z.strengthening.runners[0].items['53'].facts[0].value.observations.length,1);
 assert.ok(z.changes.runners[0].items['100'].hypotheses[0].value.upstream_trace.some(x=>x.item_id==='99'));
 assert.equal(z.rank_candidate,null);
 const late={...evidence[0],observed_at:'2026-11-23T00:00:00Z'};
 assert.equal(common(target,roster,[...evidence,late]).identities.length,2);
 const market=structuredClone(args);market.odds=[1,99,3];assert.deepEqual(analyzeField100(market),z);
}
console.log('PASS positive JRA/LOCAL full-field fixture, pace, state, draw, trace, market exclusion and conflicting evidence');
