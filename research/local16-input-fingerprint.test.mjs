import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {canonicalLocal16Input} from "../automation/local16-rank-reproducibility-audit.mjs";
const root=new URL("../",import.meta.url);
const index=readFileSync(new URL("supabase/functions/local-claimed-mcp/index.ts",root),"utf8");
const fixture=()=>{
 const race={race_date:"2026-11-19",track:"大井",race_no:3,
  post_time:"2026-11-19T06:00:00Z",
  conditions:{distance:1400,going:"不良",surface:"ダート",class_name:"B2"}};
 const runners=[
  {horse_no:8,horse_name:"証拠馬八",recent_runs:[
   {race_date:"2026-11-02",track:"大井",distance:1400,finish:2,
    early_pos:5,final_turn_pos:3,final3f:39.2,margin:"0.4"}]},
  {horse_no:3,horse_name:"証拠馬三",recent_runs:[
   {race_date:"2026-11-04",track:"大井",distance:1200,finish:4,
    early_pos:2,final_turn_pos:2,final3f:38.1,margin:"1.0"}]}
 ];
 return {race,runners};
};
const hash=async(x)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(x)))]
 .map(n=>n.toString(16).padStart(2,"0")).join("");
test("SHA-256 is stable across runner-array and object-key order but changes on verified factual changes",async()=>{
 const x=fixture(),c=canonicalLocal16Input(x.race,x.runners);
 const reordered=[structuredClone(x.runners[1]),structuredClone(x.runners[0])];
 const newRace={conditions:{surface:"ダート",class_name:"B2",going:"不良",distance:1400},
   post_time:x.race.post_time,race_no:3,track:"大井",race_date:"2026-11-19"};
 assert.equal(await hash(c),await hash(canonicalLocal16Input(newRace,reordered)));
 reordered[1].recent_runs[0].final3f=39.1;
 assert.notEqual(await hash(c),await hash(canonicalLocal16Input(newRace,reordered)));
 assert.equal(await hash(c),createHash("sha256").update(c,"utf8").digest("hex"));
});
test("fingerprint excludes target results, market, transient claim token and saved FROZEN",()=>{
 const x=fixture(),c=canonicalLocal16Input(x.race,x.runners);
 for(const w of ["odds","popularity","result","finishers","claim_token","frozen_at","target_result"])
  assert.ok(!c.includes('"'+w+'"'));
});
test("official MCP attaches digest in authorized live CLAIM read-only tool only",()=>{
 const from=index.indexOf('s.registerTool("lab_rank_repro_preflight"');
 const end=index.indexOf('s.registerTool("lab_relative_rank_preview"',from);
 const preflight=index.slice(from,end);
 const save=index.slice(index.indexOf('s.registerTool("lab_save_claimed_prediction"'));
 assert.ok(from>=0&&end>from);
 assert.ok(preflight.indexOf("const second=await claim(c,job_id)")<
   preflight.indexOf("canonicalLocal16Input(data.context.race,data.context.runners)"));
 assert.match(preflight,/crypto\.subtle\.digest\("SHA-256"/);
 assert.match(preflight,/source_input_sha256/);
 assert.match(preflight,/input_fingerprint_is_official_signature:false/);
 assert.match(preflight,/certified_numeric_scorer:"NOT_AVAILABLE"/);
 assert.doesNotMatch(preflight,/\.rpc\(|\.insert\(|\.upsert\(|\.update\(/);
 assert.doesNotMatch(save,/source_input_sha256/);
});
test("fingerprint does not change fixed EYE omission and official save gates",()=>{
 assert.match(index,/assertLocalSaveDuringTransition/);
 assert.match(index,/assertLocal16EvidenceHandoffForSave/);
 assert.match(index,/auditLocalEyeOmissions/);
 assert.equal((index.match(/lab_queue_save_prediction_with_shadow_v1/g)||[]).length,1);
});

test("live v38 criterion trace remains intact",()=>{
 const trace=readFileSync(new URL("supabase/functions/local-claimed-mcp/local16-criterion-trace-preflight.mjs",root),"utf8");
 assert.match(index,/auditLocal16CriterionTrace/);
 assert.match(index,/criterion_trace_status:trace\.status/);
 assert.match(trace,/LOCAL16_SCORING_TRACE_V1/);
 assert.match(trace,/score_certified:false/);
});
