import { analyzeConditions43to57 } from './conditions-43-57.mjs';
function conditionTests(analyze){
 const eq=(a,b,n)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(n);};
 const e=id=>({source_verified:true,identity_status:"VERIFIED",source_ref:"fixture:"+id,source_version:"v1",evidence_id:id,published_at:"2026-01-01T00:00:00Z",observed_at:"2026-01-01T00:00:00Z"});
 const h="JRA:1",target={circuit:"JRA",race_id:"T",field_size:2,started_at:"2026-11-22T05:00:00Z",cutoff:"2026-11-22T04:00:00Z",conditions_verified:true,distance:1800};
 const roster=[{...e("h"),horse_id:h,horse_no:1,race_id:"T"},{horse_no:2}];
 const r=(id,date,distance,course_id,finish)=>({...e(id),horse_id:h,circuit:"JRA",race_id:id,started_at:date+"T01:00:00Z",published_at:date+"T02:00:00Z",observed_at:date+"T03:00:00Z",local_date:date,field_size:8,finish,status:"FINISHED",conditions_verified:true,distance,course_id,surface:"DIRT",going:"GOOD",track:"venue",weight_kg:55});
 const a=r("a","2026-10-01",1200,"A",1),b=r("b","2026-10-20",1600,"B",7),late=r("late","2026-11-23",1800,"B",1);
 const witness={...e("chron"),horse_id:h,target_race_id:"T",chronology_verified:true,ordered_race_ids:["a","b"]};
 const args={target,roster,runs:[a,b,late],historyWitnesses:[witness]};
 const z=analyze(args),i=z.runners[0].items;
 eq(z.accepted_runs,2,"future exclusion");
 eq(z.runners.length,2,"all roster retained");
 eq(i["43"].facts[0].value.profiles.length,2,"distance groups");
 eq(i["44"].facts[0].value.delta_m,400,"distance delta");
 eq(i["44"].facts[1].value.delta_m,200,"current distance delta");
 eq(i["46"].facts[0].value.cohort_validation,null,"no correlation claim");
 eq(i["55"].facts.length,0,"no sand inference");
 eq(i["56"].facts.length,0,"no traffic inference");
 eq(i["57"].facts[0].value.season_effect,null,"no season claim");
 eq(analyze({...args,historyWitnesses:[]}).runners[0].items["44"].facts.length,0,"missing chronology");
 eq(analyze({...args,runs:[a,a,b]}).accepted_runs,1,"duplicate reject");
 eq(analyze({...args,runs:[{...a,published_at:null}]}).accepted_runs,0,"missing time");
 eq(z.runners[1].horse_id,null,"missing identity retained");
 eq(z.coverage["43"].consumed,0,"no grade");
 return {assertions:14,passed:14};
}
console.log(conditionTests(analyzeConditions43to57));
