import {common} from './common-evidence.mjs';
import {analyzePace58to77} from './pace-58-77.mjs';
function testPace(common,analyze){
 const target={circuit:"LOCAL",race_id:"T",field_size:3,cutoff:"2026-11-22T04:00:00Z",started_at:"2026-11-22T05:00:00Z"};
 const ev=(id,h,r,no,date="2026-10-02")=>({evidence_id:id,horse_id:h,race_id:r,runner_no:no,source_id:"fixture",source_url:"fixture",source_version:"1",identity_status:"VERIFIED",permission_status:"CLEARED_FOR_RESEARCH_USE",raw_sha256_or_null:"a".repeat(64),fact_or_proxy:"FACT",published_at_or_null:date+"T01:00:00Z",observed_at:date+"T02:00:00Z",cutoff:target.cutoff});
 const roster=[1,2,3].map(n=>({horse_no:n,horse_id:"LOCAL:"+n,evidence_id:"h"+n}));
 const evidence=roster.flatMap(h=>[ev(h.evidence_id,h.horse_id,"T",h.horse_no),ev("r"+h.horse_no,h.horse_id,"R"+h.horse_no,h.horse_no),ev("g"+h.horse_no,h.horse_id,"T",h.horse_no),ev("w"+h.horse_no,h.horse_id,"T",h.horse_no)]);
 const runs=roster.slice(0,2).map(h=>({horse_id:h.horse_id,race_id:"R"+h.horse_no,evidence_id:"r"+h.horse_no,circuit:"LOCAL",started_at:"2026-10-01T00:00:00Z",conditions_verified:true,field_size:8,positions:[{segment:1,rank_min:h.horse_no===1?1:5,rank_max:h.horse_no===1?1:5}],expected_segments:1,all_segments_verified:true,first_segment:1,segment_definition_verified:true}));
 const history=roster.map(h=>({horse_id:h.horse_id,evidence_id:"w"+h.horse_no,chronology_verified:true,ordered_race_ids:["R"+h.horse_no]}));
 const gates=roster.map(h=>({horse_id:h.horse_id,evidence_id:"g"+h.horse_no,gate:h.horse_no,actual_gate_verified:true}));
 const z=analyze({target,roster,evidence,runs,history,gates}),i=z.runners[0].items;
 const assert=(x,n)=>{if(!x)throw Error(n)};
 assert(i["63"].facts[0].value.lower===1/3,"lower");assert(i["63"].facts[0].value.upper===2/3,"upper");
 assert(z.runners[2].items["59"].facts.length===0,"missing last");
 assert(z.runners[1].items["66"].hypotheses[0].value.pattern==="UNKNOWN","unknown neighbor");
 assert(i["69"].facts.length===0,"no pace fabrication");assert(Object.keys(i).length===20,"20");
 assert(z.coverage["63"].consumed===0,"no consumption");assert(analyze({target,roster,evidence:evidence.map(e=>({...e,permission_status:"UNKNOWN"})),runs,history,gates}).runners.every(r=>r.horse_id===null),"permission");
 return 8;
}
console.log('PASS',testPace(common,analyzePace58to77));
