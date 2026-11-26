import {common} from './common-evidence.mjs';
import {analyzeChanges93to100} from './changes-93-100.mjs';
function testChanges(common,analyze){
 const target={circuit:"LOCAL",race_id:"T",field_size:1,cutoff:"2026-11-22T04:00:00Z",started_at:"2026-11-22T05:00:00Z"};
 const id="LOCAL:1",ev=(eid,race_id)=>({evidence_id:eid,horse_id:id,race_id,runner_no:1,source_id:"fixture",source_url:"fixture",source_version:"1",identity_status:"VERIFIED",permission_status:"CLEARED_FOR_RESEARCH_USE",raw_sha256_or_null:"a".repeat(64),fact_or_proxy:"FACT",published_at_or_null:"2026-11-21T01:00:00Z",observed_at:"2026-11-21T02:00:00Z",cutoff:target.cutoff});
 const evidence=[ev("h","T"),ev("r","R"),ev("w","T"),ev("c","T")],roster=[{horse_no:1,horse_id:id,evidence_id:"h"}],runs=[{horse_id:id,evidence_id:"r",race_id:"R",circuit:"LOCAL",conditions_verified:true,started_at:"2026-11-01T05:00:00Z",distance:1400,finish:5,field_size:10}],history=[{horse_id:id,evidence_id:"w",chronology_verified:true,ordered_race_ids:["R"]}],currentConditions=[{horse_id:id,evidence_id:"c",conditions_verified:true,distance:1200}],upstream=[{horse_id:id,item_id:"44",source_cutoff:target.cutoff,evidence_ids:["r"],analysis_status:"CANDIDATE"}];
 const m={horse_id:id,race_id:"T",source_cutoff:target.cutoff,mechanism_id:"A",direction:"SUPPORT",upstream_item_ids:["44"],evidence_ids:["r"],scenario_id:"P",current_relevance_verified:true};
 const args={target,roster,evidence,runs,history,currentConditions,upstream,mechanisms:[m,{...m,mechanism_id:"B",direction:"COUNTER"}]},z=analyze(args).runners[0].items;
 const a=(x,n)=>{if(!x)throw Error(n)};
 a(z["93"].hypotheses[0].value.condition_delta.length===1,"delta");
 a(z["93"].hypotheses[0].value.confirmed_effect===null,"no causal claim");
 a(z["94"].hypotheses[0].value.direction_candidates.length===1,"counter");
 a(z["97"].hypotheses[0].value.linked_mechanism_groups.length===1,"shared root");
 a(z["100"].hypotheses[0].value.rank_candidate===null,"no rank");
 a(analyze({...args,history:[]}).runners[0].items["93"].hypotheses.length===0,"no last substitute");
 a(analyze({...args,mechanisms:[{...m,upstream_item_ids:["100"]}]}).runners[0].items["97"].hypotheses.length===0,"cycle rejected");
 a(Object.keys(z).length===8,"8 IDs");return 8;
}
console.log('PASS',testChanges(common,analyzeChanges93to100));
