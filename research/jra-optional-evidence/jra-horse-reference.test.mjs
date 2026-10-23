import test from "node:test";
import assert from "node:assert/strict";
import {jraHorseCode,matchJraRunnerToArchive} from "./jra-horse-reference.mjs";
const a="/JRADB/accessU.html?CNAME=pw01dud002023105825/F4";
const b="/JRADB/accessU.html?CNAME=pw01dud102023105825/DB";
const c="/JRADB/accessU.html?CNAME=pw01dud002023106920/BC";
const row={race_date:"2025-12-14",track:"阪神",horse_ref:b,horse_name:"ギャラボーグ",finish:2};
const base={liveHorseRef:a,liveHorseName:"ギャラボーグ",
 archiveRunners:[row],raceDate:"2025-12-14",track:"阪神"};

test("different CNAME modes share the stable 10-digit horse id",()=>{
 assert.equal(jraHorseCode(a),"2023105825");
 assert.equal(jraHorseCode(b),"2023105825");
 assert.notEqual(a,b);
});
test("mode variants match with corroborating name, date and track",()=>{
 const r=matchJraRunnerToArchive(base);
 assert.equal(r.status,"VERIFIED_MATCH");
 assert.strictEqual(r.runner,row);
});
test("different horse code never matches on name alone",()=>{
 const r=matchJraRunnerToArchive({...base,liveHorseRef:c});
 assert.equal(r.status,"NOT_IN_ARCHIVED_RACE");
});
test("id same but horse name different rejects",()=>{
 const r=matchJraRunnerToArchive({...base,liveHorseName:"別の馬"});
 assert.equal(r.status,"ID_NAME_CONFLICT");
});
test("wrong date and track never match",()=>{
 assert.equal(matchJraRunnerToArchive({...base,raceDate:"2025-12-15"}).status,"NOT_IN_ARCHIVED_RACE");
 assert.equal(matchJraRunnerToArchive({...base,track:"京都"}).status,"NOT_IN_ARCHIVED_RACE");
});
test("duplicate archived identity blocks rather than selecting first",()=>{
 const r=matchJraRunnerToArchive({...base,archiveRunners:[row,{...row}]});
 assert.equal(r.status,"AMBIGUOUS_HORSE_ID");
});
test("unsupported ID format rejects",()=>{
 assert.equal(jraHorseCode("/JRADB/accessU.html?horse=someone"),null);
 assert.equal(matchJraRunnerToArchive({...base,liveHorseRef:"abc"}).status,"MISSING_VERIFIABLE_LIVE_ID");
});
test("invalid race context rejects",()=>{
 const r=matchJraRunnerToArchive({...base,raceDate:"October 2025"});
 assert.equal(r.status,"INVALID_RACE_CONTEXT");
});
test("no data is not a failure of the base model",()=>{
 const r=matchJraRunnerToArchive({...base,archiveRunners:[]});
 assert.equal(r.status,"NOT_IN_ARCHIVED_RACE");
 assert.equal(r.runner,null);
});
