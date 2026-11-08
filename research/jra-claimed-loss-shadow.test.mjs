import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraClaimedLossShadow} from './jra-claimed-loss-shadow.mjs';
const now=()=>Date.parse('2026-11-08T09:43:00+09:00');
const base=()=>{
 const proof={verified:true,html_sha256:'f'.repeat(64),
  verified_at:'2026-11-08T09:30:00+09:00'};
 return {
  stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',
  race:{race_date:'2026-11-08',track:'福島',race_no:3,
   post_time:'2026-11-08T10:45:00+09:00',
   field_payload:{
    race:{surface:'ダート',distance:1700,class_name:'1勝クラス'},
    source_checked_at:'2026-11-08T09:31:00+09:00',
    official_status_verification:proof,
    runners:[{horse_no:2,horse_name:'ルージュボニート',status:'ACTIVE'},
      {horse_no:11,horse_name:'ギンケイ',status:'ACTIVE'}]
   }
  },
  runner_history:[
   {horse_no:2,horse_name:'ルージュボニート',past_runs:[
    {race_date:'2026-08-30',track:'札幌',surface:'ダート',distance:1700,
     finish:2,margin_to_winner:0.3,early_pos:1}
   ]},
   {horse_no:11,horse_name:'ギンケイ',past_runs:[
    {race_date:'2026-07-04',track:'函館',surface:'ダート',distance:1700,
     finish:1,margin_to_winner:0.1,early_pos:11}
   ]}
  ]
 };
};
test('JRA official claimed guard feeds full runner loss evidence without scores',()=>{
 const got=buildJraClaimedLossShadow(base(),{clock:now});
 assert.equal(got.status,'EVIDENCE_ONLY');
 assert.equal(got.rank_effect,false);
 assert.equal(got.save_gate_effect,false);
 assert.equal(got.audit.verified_runner_count,2);
 assert.equal(got.audit.runners[0].close_finish_count,1);
 assert.equal(got.audit.runners[0].records[0].true_loss_cause,'UNPROVEN');
 assert.equal(got.audit.runners[0].records[0].lap_evidence.status,'LAPS_UNAVAILABLE');
});
test('JRA roster mismatch quarantines optional loss evidence',()=>{
 const context=base();context.runner_history[0].horse_name='異なる馬';
 assert.equal(buildJraClaimedLossShadow(context,{clock:now}).status,'UNVERIFIED_RUNNER_LINKAGE');
});
test('context without official source hash or full comparison is not accepted',()=>{
 const a=base();a.race.field_payload.official_status_verification.html_sha256='not_digest';
 assert.equal(buildJraClaimedLossShadow(a,{clock:now}).status,'UNVERIFIED_CONTEXT');
 const b=base();b.stage='NOT_CLAIMED';
 assert.equal(buildJraClaimedLossShadow(b,{clock:now}).status,'UNVERIFIED_CONTEXT');
});
test('after post-time the loss audit returns no evidence',()=>{
 const got=buildJraClaimedLossShadow(base(),{
  clock:()=>Date.parse('2026-11-08T10:45:00+09:00')});
 assert.equal(got.status,'UNVERIFIED_EVIDENCE');
});
