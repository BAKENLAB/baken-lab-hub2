import {attachDetailedCandidates} from './local-same-response-detail-handoff.mjs';
import {parseDetailedResultTable} from './detailed-result-cells.mjs';
import {strict as assert} from 'node:assert';
function runAdapterTests(attach, actualParser){
 const ref=n=>"https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode="+n;
 const source="https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F10%2F24&k_raceNo=11";
 const priorRace={raceDate:"2026-10-24",track:"佐賀",raceNo:11};
 const targetRace={raceDate:"2026-11-22",postTime:"2026-11-22T10:10:00Z",asOf:"2026-11-22T07:16:53Z",activeHorseNos:[1,2,3]};
 const checked="2026-11-22T07:16:41Z";
 const raw={sourceUrl:source,sourceCheckedAt:checked,knownHorseNos:[1,6],officialHorseNames:{"1":"A","6":"B"},officialFinishers:[{horseNo:1,horseName:"A",finish:2,officialHorseId:"123"},{horseNo:6,horseName:"B",finish:1,officialHorseId:"456"}]};
 const cornerPacket={source:"NAR_OFFICIAL_PAST_RACE_RESULT",source_ref:source,source_checked_at:checked,prior_race:{race_date:priorRace.raceDate,track:priorRace.track,race_no:priorRace.raceNo},future_result_included:false,market_used:false,runners:[{prior_horse_no:1,evidence_status:"OFFICIAL_CORNER_POSITIONS_VERIFIED",corner_positions:[{corner:3,position:2},{corner:4,position:2}]},{prior_horse_no:6,evidence_status:"OFFICIAL_CORNER_POSITIONS_VERIFIED",corner_positions:[{corner:3,position:1},{corner:4,position:1}]}]};
 const links=[{horseNo:1,horseName:"A",horseRef:ref(123),pastHorseNo:1,identityVerifiedBy:"OFFICIAL_HORSE_REF"},{horseNo:2,horseName:"B",horseRef:ref(456),pastHorseNo:6,identityVerifiedBy:"OFFICIAL_HORSE_REF"}];
 const table={headers:["着順","馬番","馬名","タイム","着差","上り3F"],rows:[["2","1","A","0:56.9","大差","38.6"],["1","6","B","0:55.3","","37.2"]],expectedHorseNos:[1,6],horseLinks:[{horseNo:1,horseRef:ref(123)},{horseNo:6,horseRef:ref(456)}]};
 // Optional stub for isolated contract checks; this executable suite imports the actual semantic parser.
 const parseTable=()=>({status:"CANDIDATE_ONLY",runners:[{horse_no:1,horse_name:"A",finish:2,elapsed_seconds:56.9,final3f:38.6,final3f_kind:"OFFICIAL_REPORTED",rounded_clock_gap_to_winner_s:1.6,rounded_clock_gap_to_next_finisher_s:null,margin_literal:"大差"},{horse_no:6,horse_name:"B",finish:1,elapsed_seconds:55.3,final3f:37.2,final3f_kind:"OFFICIAL_REPORTED",rounded_clock_gap_to_winner_s:0,rounded_clock_gap_to_next_finisher_s:1.6,margin_literal:null}]});
 const cfg={targetRace,priorRace,raw,cornerPacket,links,table,parseTable:actualParser??parseTable};const result=attach(cfg);
 const fails=(x,code)=>{try{attach(x);return false}catch(e){return e.message===code}};
 const tests={two_linked:result.records.length===2,zero_winner_gap:result.records[1].gap_winner===0,missing_next:result.records[0].gap_next===null,no_scoring:result.scoring_authorized===false,source_date:result.records[0].race_date==="2026-10-24",bad_time:fails({...cfg,raw:{...raw,sourceCheckedAt:"2026-11-22T11:00:00Z"}},"ASOF_VIOLATION"),bad_race:fails({...cfg,priorRace:{...priorRace,raceNo:10}},"SOURCE_BINDING"),duplicate:fails({...cfg,links:[links[0],links[0]]},"CURRENT_ROSTER_MISMATCH"),foreign_runner:fails({...cfg,links:[{...links[0],horseNo:4}]},"CURRENT_ROSTER_MISMATCH"),missing_horse:fails({...cfg,table:{...table,expectedHorseNos:[1]}},"FIELD_MISMATCH"),wrong_horse:attach({...cfg,links:[{...links[0],horseRef:ref(999)}]}).rejections.length===1,duplicate_id:fails({...cfg,table:{...table,horseLinks:[table.horseLinks[0],{horseNo:6,horseRef:ref(123)}]}},"RESULT_HORSE_LINKS"),conflicting_finish:attach({...cfg,raw:{...raw,officialFinishers:[{...raw.officialFinishers[0],finish:1},raw.officialFinishers[1]]}}).rejections.length===1,wrong_snapshot:fails({...cfg,cornerPacket:{...cornerPacket,source_checked_at:"2026-11-22T07:16:40Z"}},"SOURCE_BINDING"),target_outcome:fails({...cfg,priorRace:{...priorRace,raceDate:targetRace.raceDate}},"INVALID_CONTEXT"),market_not_forwarded:!JSON.stringify(attach({...cfg,raw:{...raw,market:{odds:2}}})).includes('"odds"')};
 const split=[10.5,10.9,11,11.2,11.7];let total=0;
 const lap={status:"VERIFIED_RACE_LEVEL_LAPS",sourceRef:source,sourceCheckedAt:checked,pastRace:priorRace,finish_time_reconciled:true,individual_horse_sectionals:false,market_used:false,target_result_used:false,distance_m:1000,winner_time_seconds:55.3,segments:split.map((seconds,i)=>{total+=Math.round(seconds*10);return{from_m:i*200,to_m:(i+1)*200,distance_m:200,seconds,cumulative_seconds:total/10}})};
 const withLap=attach({...cfg,raw:{...raw,officialRaceLaps:lap}});
 tests.lap_same_source=withLap.records.every(x=>x.lap_scope==="RACE_LEVEL_ONLY"&&x.distance===1000&&x.race_laps.length===5);
 tests.lap_bad_winner=attach({...cfg,raw:{...raw,officialRaceLaps:{...lap,winner_time_seconds:55.4}}}).records.every(x=>x.race_laps===null);
 tests.lap_wrong_source=attach({...cfg,raw:{...raw,officialRaceLaps:{...lap,sourceRef:source.replace("k_raceNo=11","k_raceNo=10")}}}).records.every(x=>x.race_laps===null);
 tests.lap_individual_forbidden=attach({...cfg,raw:{...raw,officialRaceLaps:{...lap,individual_horse_sectionals:true}}}).records.every(x=>x.race_laps===null);
 tests.lap_invalid_grid=attach({...cfg,raw:{...raw,officialRaceLaps:{...lap,segments:[{...lap.segments[0],distance_m:100},...lap.segments.slice(1)]}}}).records.every(x=>x.race_laps===null);
 return tests;
}
const checks=runAdapterTests(attachDetailedCandidates,parseDetailedResultTable); for (const [name,ok] of Object.entries(checks)) {assert.equal(ok,true,name); console.log('PASS',name)}
console.log('PASS',Object.keys(checks).length,'checks');
