import {common} from './common-evidence.mjs';
import {analyzeState78to92} from './state-78-92.mjs';
function testState(common,analyze){
 const target={circuit:"JRA",race_id:"T",field_size:1,cutoff:"2026-11-22T04:00:00Z",started_at:"2026-11-22T05:00:00Z",local_date:"2026-11-22"};
 const id="JRA:1",ev=(eid,race_id,date="2026-11-21")=>({evidence_id:eid,horse_id:id,race_id,runner_no:1,source_id:"fixture",source_url:"fixture",source_version:"1",identity_status:"VERIFIED",permission_status:"CLEARED_FOR_RESEARCH_USE",raw_sha256_or_null:"a".repeat(64),fact_or_proxy:"FACT",published_at_or_null:date+"T01:00:00Z",observed_at:date+"T02:00:00Z",cutoff:target.cutoff});
 const evidence=[ev("h","T"),ev("r","R"),ev("w","T"),ev("c","T")],roster=[{horse_no:1,horse_id:id,evidence_id:"h"}],runs=[{horse_id:id,evidence_id:"r",race_id:"R",circuit:"JRA",conditions_verified:true,started_at:"2026-11-01T05:00:00Z",local_date:"2026-11-01",body_weight_kg:480,jockey_id:"A",finish:5,field_size:10}],history=[{horse_id:id,evidence_id:"w",chronology_verified:true,ordered_race_ids:["R"]}],current=[{horse_id:id,evidence_id:"c",body_weight_kg:485,reported_weight_delta:4,jockey_id:"B"}];
 const args={target,roster,evidence,runs,history,current},z=analyze(args).runners[0].items;
 const a=(x,n)=>{if(!x)throw Error(n)};
 a(z["78"].facts[0].value.days_since_last_start===21,"days");a(z["80"].hypotheses[0].value.starts_since_break===null,"threshold not set");a(z["81"].facts[0].value.delta_kg===null,"conflict");a(z["83"].facts.length===0,"not no training");a(z["88"].facts[0].value.rider_transition==="CHANGED_PRIOR_PAIR_UNKNOWN","rider change");a(z["92"].facts.length===0,"no travel invention");a(analyze({...args,history:[]}).runners[0].items["78"].facts.length===0,"no last substitute");a(Object.keys(z).length===15,"coverage");return 8;
}
console.log('PASS',testState(common,analyzeState78to92));
