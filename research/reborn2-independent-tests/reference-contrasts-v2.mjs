const referenceV2=function referenceV2(){
 const course={venue:"SYNTHETIC_OVAL_1400",surface:"DIRT",going:"GOOD",distance_m:1400,direction:"RIGHT",first_turn_m:300,straight_m:350,checkpoints_m:[200,400,600,800,1000,1200],class_label:"SYNTHETIC_SAME_CLASS",weight_g:56000,precision_ms:50};
 const specs=[["CONTEST",[[48400,84500],[47700,84800],[48600,85000],[47800,85800],[48700,86100]]],["LONE",[[48400,85000],[47400,84000],[48600,85200],[48450,85800],[48700,86100]]],["PEER",[[48200,84300],[47800,84700],[48300,84500],[48500,85400],[48800,85900]]]];
 const ranks=(v)=>v.map(x=>1+v.filter(y=>y<x).length);
 const events=specs.map(([id,rows])=>{
 const clock=rows.map(([s,f])=>[Math.round(s*.27),Math.round(s*.515),Math.round(s*.755),s,s+Math.round((f-s)/3),s+Math.round(2*(f-s)/3),f]);
 const leader=clock[0].map((_,i)=>Math.min(...clock.map(r=>r[i])));
 const laps=leader.map((v,i)=>v-(leader[i-1]??0));
 const runners=clock.map((c,i)=>({horse:"ABCDE"[i],gate:i+1,weight_g:course.weight_g,clock_ms:c,rank_at:c.map((_,j)=>ranks(clock.map(r=>r[j]))[i]),final600_ms:c[6]-c[3],finish_rank:ranks(clock.map(r=>r[6]))[i]}));
 return {id,course,leader_crossings_ms:leader,leader_laps_ms:laps,runners};
 });
 const starts=[48200,47700,48200,48500,48800], responses=[36200,36400,35500,36800,37100];
 const hypothetical=[["BASE",responses],["STRONG_PEER",responses.map((v,i)=>i===1?35500:v)]].map(([id,r])=>{const clocks=starts.map((v,i)=>v+r[i]);return {id,scope:"HYPOTHETICAL_CONDITIONAL_ONLY",starts_ms:starts,response_ms:r,finish_ms:clocks,rank:ranks(clocks)}});
 const checks={allSegmentsPlausible:events.every(e=>e.runners.every(r=>r.clock_ms.every((v,i)=>v-(r.clock_ms[i-1]??0)>=10000&&v-(r.clock_ms[i-1]??0)<=16000))),leaderCorrect:events.every(e=>e.leader_laps_ms.reduce((a,b)=>a+b,0)===Math.min(...e.runners.map(r=>r.clock_ms[6]))),rankConsistent:events.every(e=>e.runners.every(r=>r.finish_rank===r.rank_at[6])),CneverWon:events.every(e=>e.runners[2].finish_rank>1),CconditionalWin:hypothetical[0].rank[2]===1,peerEffect:hypothetical[1].rank[2]===2,observedRecovery:events[0].runners[0].rank_at[3]>1&&events[0].runners[0].finish_rank===1,observedLoneLead:events[1].runners[1].rank_at[3]===1&&events[1].runners[1].finish_rank===1};
 return {scope:"SYNTHETIC_ARITHMETIC_ONLY",events,hypothetical,checks,limitations:["Synthetic geometry, no real course claim","Interpolated individual 200m clocks, not observed data","Position deficit does not establish physical burden or isolated causality","Current conditional vectors not yet supported by source evidence","No SABC expected labels"]};
};
const r=referenceV2();console.log(JSON.stringify(r,null,2));if(Object.values(r.checks).some(v=>!v))process.exitCode=1;
