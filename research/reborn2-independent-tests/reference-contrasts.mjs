const independentReference=function independentReference(){
 const events=[
 {id:"HIST_CONTEST",distance:1400,rows:[["A",40000,84500],["B",39200,84800],["C",40050,85000],["D",39300,85800],["E",40200,86100]],note:"A wins despite deficit; B and D are early competitors"},
 {id:"HIST_LONE",distance:1400,rows:[["A",40000,85000],["B",39000,84000],["C",40100,85200],["D",40000,85800],["E",40200,86100]],note:"B wins after separated lead"},
 {id:"HIST_WEAK_PEER",distance:1400,rows:[["A",39900,84300],["B",39500,84700],["C",40000,84500],["D",40050,85400],["E",40200,85900]],note:"C never won in historical examples"},
 ];
 // Future vectors are conditional hypothetical intervals, not observations or results.
 const branches=[
 {id:"C_CONDITIONAL",start:[["A",39900],["B",39500],["C",39800],["D",40050],["E",40200]],response:[["A",44500],["B",45300],["C",44300],["D",45400],["E",45700]]},
 {id:"STRONGER_PEER",start:[["A",39900],["B",39500],["C",39800],["D",40050],["E",40200]],response:[["A",44500],["B",44300],["C",44300],["D",45400],["E",45700]]}
 ];
 const ranks=(rows)=>rows.map(([h,s,f])=>({horse:h,startRank:1+rows.filter(q=>q[1]<s).length,finishRank:1+rows.filter(q=>q[2]<f).length,remaining:f-s}));
 const comparisons=events.map(e=>({id:e.id,rows:ranks(e.rows)}));
 const vectors=branches.map(b=>({id:b.id,rows:ranks(b.start.map(([h,s])=>[h,s,s+b.response.find(q=>q[0]===h)[1]]))}));
 const bounds=(own,others)=>[1+others.filter(r=>r[1]<own[0]).length,1+others.filter(r=>r[0]<=own[1]).length];
 const missing={complete:bounds([84100,84100],[[84400,84400],[84800,84800],[85450,85450],[85900,85900]]),boundedIrrelevant:bounds([84100,84100],[[84400,84400],[84800,84800],[85450,85450],[85000,90000]]),decisive:bounds([84100,84100],[[84400,84400],[84800,84800],[85450,85450],[83000,90000]])};
 const roots=[{id:"x1",issuer:"SYNTHETIC",event:"HIST_CONTEST",horse:"A",row:0,field:"finish",version:1},{id:"x2",issuer:"SYNTHETIC",event:"HIST_CONTEST",horse:"A",row:0,field:"finish",version:1}];
 const rootCount=new Set(roots.map(({id,...r})=>JSON.stringify(r))).size;
 const cHistory=comparisons.map(e=>e.rows.find(r=>r.horse==="C").finishRank),cNow=vectors.map(v=>v.rows.find(r=>r.horse==="C").finishRank);
 const checks={monotonic:events.every(e=>e.rows.every(r=>r[1]>0&&r[2]>r[1])),nonwinner:cHistory.every(r=>r>1)&&cNow[0]===1,peerEffect:cNow[1]>cNow[0],recovery:comparisons[0].rows.find(r=>r.horse==="A").startRank>1&&comparisons[0].rows.find(r=>r.horse==="A").finishRank===1,retention:comparisons[1].rows.find(r=>r.horse==="B").startRank===1&&comparisons[1].rows.find(r=>r.horse==="B").finishRank===1,missing:missing.complete[1]===missing.boundedIrrelevant[1]&&missing.decisive[1]>missing.complete[1],duplicate:rootCount===1};
 return {scope:"INDEPENDENT_SYNTHETIC_ARITHMETIC_ORACLE_NOT_ENGINE_EXECUTION",events,branches,comparisons,vectors,missing,roots,rootCount,checks,limitations:["800m and finish clocks only; no complete official-style source","burden causality not established by early deficit alone","conditional vectors supplied as hypothetical; current applicability not proven","no SABC labels fixed"]};
};
const r=independentReference();
console.log(JSON.stringify(r,null,2));
if(Object.values(r.checks).some(x=>!x)) process.exitCode=1;
