import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classLevel,resolvePriorRaceClass,auditLockedPriorClasses}
 from "./lab-reborn-v07-verified-prior-class.mjs";
import {scoreLockedLive4Proxy}
 from "./lab-reborn-v04-live4-proxy.mjs";
import {compareVerifiedClassOverlay}
 from "./lab-reborn-v07-class-resolved-overlay.mjs";

const model=JSON.parse(readFileSync(new URL("./learned-2024-reborn-v04-coefficients.json",import.meta.url),"utf8"));
const past={race_date:"2026-05-10",track:"東京",surface:"ダート",
 distance:1600,finish:4,margin_to_winner:0.2,
 race_class:"立夏S",final3f:36.1};
const evidence={source:"JRA_LAB_ARCHIVE",horse_code:"2020102703",
 race_date:"2026-05-10",track:"東京",surface:"ダート",
 distance:1600,finish:4,race_no:12,race_name:"立夏ステークス",
 class_name:"3勝クラス"};
const ask=(overrides={})=>({target_date:"2026-10-24",horse_code:"2020102703",
 run:past,evidence:[evidence],...overrides});
const packet={
 race_date:"2026-10-24",track:"東京",race_no:10,
 saved_at:"2026-10-24T03:21:47Z",
 source_post_time:"2026-10-24T06:01:00Z",
 payload:{surface:"ダート",distance:1600,class_name:"3歳以上3勝クラス",field_size:6,
  runners:Array.from({length:6},(_,i)=>({
   horse_no:i+1,horse_name:"TEST_"+(i+1),
   horse_code:String(2020102703+i),
   history:i===0?[past]:[{...past,race_class:"3勝クラス",finish:8+i,
     margin_to_winner:1.5+i/10,horse_code:undefined}]
  }))
 }
};
test("named prior-race label must not imply class by itself",()=>{
 assert.equal(classLevel("立夏S"),null);
 assert.equal(classLevel("野路菊S"),null);
 assert.equal(classLevel("青梅特別"),null);
});
test("known class labels recognized without guessing G grade",()=>{
 assert.equal(classLevel("3勝クラス"),4);
 assert.equal(classLevel("牝2勝クラス"),3);
 assert.equal(classLevel("1勝クラス"),2);
 assert.equal(classLevel("オープン"),5);
});
test("verified JRA runner-race identity resolves a shortened title",()=>{
 const r=resolvePriorRaceClass(ask());
 assert.equal(r.status,"VERIFIED_RESOLVED");
 assert.equal(r.class_level,4);
 assert.equal(r.archive_race_no,12);
});
test("archive horse mismatch does not resolve",()=>{
 assert.equal(resolvePriorRaceClass(ask({horse_code:"2020102704"})).class_level,null);
});
test("archive distance mismatch does not resolve",()=>{
 assert.equal(resolvePriorRaceClass(ask({run:{...past,distance:1400}})).class_level,null);
});
test("archive finish mismatch does not resolve",()=>{
 assert.equal(resolvePriorRaceClass(ask({run:{...past,finish:1}})).class_level,null);
});
test("ambiguous duplicate archives reject",()=>{
 assert.equal(resolvePriorRaceClass(ask({evidence:[evidence,evidence]})).status,"AMBIGUOUS_ARCHIVE");
});
test("history on or after target date rejected",()=>{
 assert.equal(resolvePriorRaceClass(ask({target_date:"2026-05-10"})).status,"INELIGIBLE_PRIOR");
});
test("direct explicit class conflicting with archive rejects",()=>{
 assert.equal(resolvePriorRaceClass(ask({run:{...past,race_class:"1勝クラス"}})).status,"SOURCE_CLASS_CONFLICT");
});
test("unverified prior history remains unresolved",()=>{
 assert.equal(resolvePriorRaceClass(ask({evidence:[]})).status,"UNKNOWN_NO_VERIFIED_ARCHIVE");
});
test("new run is not mistaken for a finished race",()=>{
 assert.equal(resolvePriorRaceClass(ask({run:{...past,finish:null}})).status,"INELIGIBLE_PRIOR");
});
test("prestart input audit is pure and counts verified classes",()=>{
 const audit=auditLockedPriorClasses(packet,[evidence]);
 assert.equal(audit.status,"RESEARCH_CLASS_AUDIT_ONLY");
 assert.equal(audit.counts.VERIFIED_RESOLVED,1);
 assert.equal(audit.production_write,false);
});
test("never audit as prestart when snapshot saved after off",()=>{
 const a=auditLockedPriorClasses({...packet,saved_at:"2026-10-24T07:00:00Z"},[evidence]);
 assert.equal(a.status,"AUDIT_REJECTED");
});
test("overlay adds only verified CLASS_CLOSE signal, without refitting coefficients",()=>{
 const before=scoreLockedLive4Proxy(packet,model);
 const after=compareVerifiedClassOverlay(packet,model,[evidence]);
 assert.equal(after.status,"POST_HOC_CLASS_PROVENANCE_DIAGNOSTIC_ONLY");
 assert.equal(after.resolved_prior_named_runs,1);
 assert.equal(after.no_weight_retraining,true);
 assert.equal(after.production_write,false);
 const diff=after.changes.find(x=>x.horse_no===1);
 assert.ok(diff.changed_signals.includes("CLASS_CLOSE"));
 assert.ok(diff.overlay_score>diff.base_score);
 assert.deepEqual(packet.payload.runners[0].history[0],past);
 assert.equal(before.status,"LIVE4_PROXY_ONLY_NO_FROZEN_V04_PREDICTION");
});
test("changing live odds or target result does not change overlay",()=>{
 const base=compareVerifiedClassOverlay(packet,model,[evidence]);
 const withTarget=compareVerifiedClassOverlay({...packet,payload:{...packet.payload,
  target_result:{winner:1},odds:{horse_no:1,win_odds:1.1}}},model,[evidence]);
 assert.deepEqual(base.changes,withTarget.changes);
});
test("overlay must never silently choose from conflicting archives",()=>{
 const after=compareVerifiedClassOverlay(packet,model,[evidence,{...evidence,race_no:11}]);
 assert.equal(after.status,"RESEARCH_OVERLAY_REJECTED");
});
