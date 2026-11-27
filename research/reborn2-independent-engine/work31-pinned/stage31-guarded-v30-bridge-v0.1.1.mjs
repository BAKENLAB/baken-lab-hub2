function guardedBridge31(packet,joint,withdraw=null){
 if(packet.schema!=="WORK31_TYPED_SYNTHETIC_0.1"||packet.scope!=="SYNTHETIC_ONLY_NEVER_OFFICIAL"||packet.formal_admissions!==0||packet.scoring_authorized!==false)throw Error("SCOPE");
 const ev=packet.evidence,by=new Map(ev.map(e=>[e.evidenceId,e]));if(by.size!==ev.length)throw Error("DUPLICATE");
 const ok=(id,seen=new Set())=>{const e=by.get(id);return !!e&&id!==withdraw&&e.root!==withdraw&&!seen.has(id)&&e.dependencies.every(d=>ok(d,new Set([...seen,id])))};
 const roster=packet.runners.filter(r=>["ACTIVE","UNKNOWN"].includes(r.status)),ids=roster.map(r=>r.nativeId);
 const fields=packet.histories.map(h=>{const pairs=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i],b=ids[j],q=packet.allPairs.find(p=>p.event===h.event&&p.currentDirect&&[p.a,p.b].includes(a)&&[p.a,p.b].includes(b)),e=q&&by.get(q.ref);let order="UNKNOWN",refs=[];if(e&&ok(e.evidenceId)&&roster[i].status==="ACTIVE"&&roster[j].status==="ACTIVE"){const x=e.value.a===a?e.value.finishA:e.value.finishB,y=e.value.a===a?e.value.finishB:e.value.finishA;order=x===y?"UNKNOWN":x<y?"AHEAD":"BEHIND";refs=[e.evidenceId]}pairs.push({a,b,order,refs})}return {event:h.event,pairs,field:joint(ids,pairs),scope:"HISTORICAL_FINISH_ONLY"}});
 return {scope:"EXACT_V30_JOINT_FIELD_GUARDED_SYNTHETIC_ONLY",fields,formal:false,grade:null,prediction:false};
}
export {guardedBridge31};
