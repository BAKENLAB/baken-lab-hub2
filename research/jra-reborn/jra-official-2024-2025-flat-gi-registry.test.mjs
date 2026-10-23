import test from "node:test";
import assert from "node:assert/strict";
import {official2024to2025FlatGI, verifiedFlatGI2024_2025}
 from "./jra-official-2024-2025-flat-gi-registry.mjs";
test("48 flat GI only, 24 each year",()=>{
 assert.equal(verifiedFlatGI2024_2025.length,48);
 assert.equal(verifiedFlatGI2024_2025.filter(v=>v[0].startsWith("2024")).length,24);
 assert.equal(verifiedFlatGI2024_2025.filter(v=>v[0].startsWith("2025")).length,24);
});
test("official Oaks vs DB title aliases 2024 and 2025",()=>{
 for(const [day] of [["2024-05-19"],["2025-05-25"]]){
  assert.equal(official2024to2025FlatGI(day,"東京","オークス").level,7);
  assert.equal(official2024to2025FlatGI(day,"東京","優駿牝馬").level,7);
 }
});
test("official Derby vs DB title aliases",()=>{
 for(const day of ["2024-05-26","2025-06-01"]){
  assert.equal(official2024to2025FlatGI(day,"東京","日本ダービー").level,7);
  assert.equal(official2024to2025FlatGI(day,"東京","東京優駿").level,7);
 }
});
test("same title different physical race track/year cannot match",()=>{
 assert.equal(official2024to2025FlatGI("2024-06-23","京都","宝塚記念").level,7);
 assert.equal(official2024to2025FlatGI("2025-06-15","阪神","宝塚記念").level,7);
 assert.equal(official2024to2025FlatGI("2024-06-23","阪神","宝塚記念"),null);
 assert.equal(official2024to2025FlatGI("2025-06-15","京都","宝塚記念"),null);
});
test("unknown GII and GIII must remain UNKNOWN, never infer low grade",()=>{
 assert.equal(official2024to2025FlatGI("2025-09-14","阪神","ローズステークス"),null);
 assert.equal(official2024to2025FlatGI("2025-04-26","東京","青葉賞"),null);
});
test("2026 and title-switch mismatch do not hit 2024/25 ledger",()=>{
 assert.equal(official2024to2025FlatGI("2026-10-18","京都","秋華賞"),null);
 assert.equal(official2024to2025FlatGI("2024-10-13","京都","菊花賞"),null);
});
