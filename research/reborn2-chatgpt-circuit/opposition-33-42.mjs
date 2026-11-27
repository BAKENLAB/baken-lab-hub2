import {assertFictionalTarget,fictionalTime,fixtureHorse,localAdmission,historyKnown,gateKnown} from './fictional-research-context.mjs';
// Research-only normalized evidence contract. No acquisition, grading or production I/O.
export function analyzeOpposition33to42(args){return analyzeOpposition33to42Core(args,false);}
export function analyzeOpposition33to42Fixture(args){return analyzeOpposition33to42Core(args,true);}
function analyzeOpposition33to42Core({target, roster, races=[], histories=[], rules=[], ratings=[], transfers=[]},fictional){
 if(fictional)assertFictionalTarget(target,roster);
  const timestamp=x=>fictional?fictionalTime(x):typeof x==="string"&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
  const cutoff=timestamp(target.cutoff), start=timestamp(target.started_at);
  const str=x=>typeof x==="string"&&x.trim().length>0;
  const circuit=x=>fictional?x==="FIXTURE":["JRA","LOCAL"].includes(x);
  const horse=x=>fictional?fixtureHorse(x):typeof x==="string"&&/^(JRA|LOCAL):\d+$/.test(x);
 const scoped=(x,c)=>horse(x)&&(fictional?c==="FIXTURE":x.startsWith(c+":"));
  const admission=e=>fictional?localAdmission(target,e):e?.identity_status==="VERIFIED"&&e?.source_verified===true&&str(e.evidence_id)&&str(e.source_ref)&&str(e.source_version)&&timestamp(e.published_at)<=timestamp(e.observed_at)&&timestamp(e.observed_at)<=cutoff;
  const unique=(list,key)=>{const counts=new Map();for(const x of list){const k=key(x);counts.set(k,(counts.get(k)||0)+1);}return list.filter(x=>counts.get(key(x))===1);};
  if(!Number.isFinite(cutoff)||!Number.isFinite(start)||cutoff>=start||!circuit(target.circuit)||!str(target.race_id))throw Error("INVALID_TARGET");
  if(!Array.isArray(roster)||!Number.isInteger(target.field_size)||roster.length!==target.field_size||target.field_size<1||roster.some(x=>!Number.isInteger(x.horse_no)||x.horse_no<1)||unique(roster,x=>x.horse_no).length!==roster.length)throw Error("ROSTER_COUNT_OR_NUMBER_CONFLICT");
  const identities=unique(roster.filter(x=>scoped(x.horse_id,target.circuit)&&admission(x)&&x.race_id===target.race_id),x=>x.horse_id);
  const ids=identities.map(x=>x.horse_id);
  const validResult=(r,c)=>scoped(r.horse_id,c)&&((Number.isInteger(r.finish)&&r.finish>0&&r.status==="FINISHED")||(r.finish===null&&["DNF","DQ","DNS"].includes(r.status)));
  const validRace=r=>admission(r)&&circuit(r.circuit)&&str(r.race_id)&&r.race_id!==target.race_id&&timestamp(r.started_at)<timestamp(r.published_at)&&timestamp(r.started_at)<start&&Number.isInteger(r.field_size)&&r.field_size>0&&Array.isArray(r.results)&&r.results.length===r.field_size&&r.results.every(x=>validResult(x,r.circuit)&& (x.finish===null||x.finish<=r.field_size))&&unique(r.results,x=>x.horse_id).length===r.field_size;
  const accepted=unique(races.filter(validRace),r=>r.circuit+":"+r.race_id);
  const racesFor=h=>accepted.filter(r=>r.results.some(x=>x.horse_id===h));
  const result=(r,h)=>r.results.find(x=>x.horse_id===h);
  const conditionKeys=["track","surface","distance","going","layout","class_key","rule_version","eligibility"];
  const comparable=(a,b)=>conditionKeys.every(k=>a?.[k]!==null&&a?.[k]!==undefined&&a?.[k]!==""&&a[k]===b?.[k])&&a.circuit===b.circuit;
  const summary=xs=>({n:xs.length,wins:xs.filter(x=>x.finish===1).length,top3:xs.filter(x=>Number.isInteger(x.finish)&&x.finish<=3).length,nonfinish:xs.filter(x=>x.finish===null).length});
  const order=(a,b)=>a?.finish==null||b?.finish==null?"UNDETERMINED":a.finish<b.finish?"AHEAD":a.finish>b.finish?"BEHIND":"SAME_FINISH";
  const profile=(h,before)=>racesFor(h).filter(r=>timestamp(r.started_at)<before&&(fictional?timestamp(r.published_at)<before:timestamp(r.observed_at)<before)).map(r=>({race_id:r.race_id,finish:result(r,h).finish,status:result(r,h).status,class_key:r.class_key??null,conditions:Object.fromEntries(conditionKeys.map(k=>[k,r[k]??null])),evidence_id:r.evidence_id}));
  const fieldProfile=(field,subject,before)=>{const peers=field.filter(h=>h!==subject).map(h=>({horse_id:h,runs:profile(h,before)}));return {denominator:peers.length,covered:peers.filter(p=>p.runs.length).length,profiles:peers.map(p=>({...p,distribution:summary(p.runs)}))};};
  const historyFor=h=>unique(histories.filter(x=>admission(x)&&x.horse_id===h&&x.target_race_id===target.race_id&&historyKnown(target,x)),x=>x.horse_id)[0];
  const ruleFor=(a,b)=>unique(rules.filter(r=>admission(r)&&r.circuit===a.circuit&&r.circuit===b.circuit&&r.from_key===a.class_key&&r.to_key===b.class_key&&r.from_version===a.rule_version&&r.to_version===b.rule_version&&timestamp(r.effective_from)<=timestamp(a.started_at)&&timestamp(r.effective_from)<=timestamp(b.started_at)&&timestamp(a.started_at)<timestamp(r.effective_until)&&timestamp(b.started_at)<timestamp(r.effective_until)&&["PROMOTION","DEMOTION","SAME_CLASS","SYSTEM_CHANGE"].includes(r.transition)),r=>r.from_key+"|"+r.to_key)[0];
  const shared=new Map();
  const rowRefs=new Map(accepted.filter(r=>Array.isArray(r.row_evidence_ids)).map(r=>[r.evidence_id,r.row_evidence_ids]));
  const runners=roster.map(entry=>{
    const items=Object.fromEntries(Array.from({length:10},(_,i)=>[String(i+33),{facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:"NO_RECORDED_USE"}]));
    const emit=(n,value,refs)=>items[n].facts.push({value,evidence_ids:[...new Set([...refs,...refs.flatMap(e=>rowRefs.get(e)??[])])]});
    const unknown=(n,reason)=>items[n].unknowns.push(reason);
    const h=identities.find(x=>x.horse_no===entry.horse_no)?.horse_id;
    if(!h){for(const n in items)unknown(n,"CURRENT_IDENTITY_UNVERIFIED_OR_CONFLICT");return {horse_no:entry.horse_no,horse_id:null,items};}
    const ownRaces=racesFor(h).filter(r=>r.circuit===target.circuit).sort((a,b)=>timestamp(b.started_at)-timestamp(a.started_at));
    for(const r of ownRaces){
      const own=result(r,h), peerIds=r.results.map(x=>x.horse_id).filter(x=>x!==h);
      const ref=[r.evidence_id,entry.evidence_id];
      if(r.class_verified===true&&str(r.class_key)&&str(r.rule_version)&&str(r.eligibility)&&str(r.class_rule_ref))emit(33,{class_key:r.class_key,eligibility:r.eligibility,rule_version:r.rule_version,rule_ref:r.class_rule_ref,empirical_level_evidence:null},ref);
      else unknown(33,"CLASS_RULE_OR_ELIGIBILITY_MISSING:"+r.race_id);
      const past=fieldProfile(peerIds,h,timestamp(r.started_at));
      emit(34,{prior_race_id:r.race_id,...past},[...ref,...past.profiles.flatMap(p=>p.runs.map(q=>q.evidence_id))]);
      if(past.covered<past.denominator)unknown(34,"PEER_HISTORY_INCOMPLETE:"+r.race_id);
      for(const peer of r.results.filter(x=>x.horse_id!==h)){
        if(ids.includes(peer.horse_id)){
          emit(35,{pair_ids:[h,peer.horse_id],shared_race:r.race_id,outcome:order(own,peer),own_finish:own.finish,peer_finish:peer.finish,comparable_conditions:comparable(r,target)},ref);
        }
        const later=racesFor(peer.horse_id).filter(l=>l.circuit===r.circuit&&timestamp(l.started_at)>timestamp(r.started_at));
        if(!later.length)unknown(37,"PEER_FOLLOWUP_MISSING:"+r.race_id+":"+peer.horse_id);
        for(const l of later){
          const k=peer.horse_id+"|"+l.circuit+"|"+l.race_id;
          const p=result(l,peer.horse_id);shared.set(k,{peer_id:peer.horse_id,later_result_id:l.race_id,finish:p.finish,status:p.status,evidence_id:l.evidence_id});
          emit(37,{prior_race_id:r.race_id,subject_id:h,peer_id:peer.horse_id,own_finish:own.finish,peer_prior_finish:peer.finish,peer_finish:p.finish,shared_followup_key:k,source_availability:fictional?"FICTIONAL_LOCAL_PUBLICATION_ONLY":"VERIFIED_PRESTART"},[...ref,l.evidence_id]);
        }
        const rs=unique(ratings.filter(q=>admission(q)&&q.peer_id===peer.horse_id&&q.performance_ref===r.race_id&&q.crosswalk_status==="VERIFIED"&&q.edition_pinned===true&&timestamp(q.published_at)>timestamp(r.started_at)&&["JRA","NAR","IFHA"].includes(q.authority)&&str(q.scope)&&str(q.edition)&&Number.isFinite(q.rating)&&q.rating>0),q=>q.peer_id+"|"+q.performance_ref+"|"+q.scope);
        for(const q of rs)emit(38,{peer_id:q.peer_id,performance_ref:q.performance_ref,rating:q.rating,scope:q.scope,edition:q.edition,published_at:q.published_at},[...ref,q.evidence_id]);
        if(!rs.length)unknown(38,"NO_UNIQUE_OFFICIAL_RACE_RATING:"+r.race_id+":"+peer.horse_id);
        for(const other of ids.filter(x=>x!==h&&x!==peer.horse_id)){
          for(const alt of racesFor(other).filter(a=>a.race_id!==r.race_id&&a.circuit===r.circuit&&a.results.some(x=>x.horse_id===peer.horse_id))){
            const rel=[order(own,peer),order(result(alt,other),result(alt,peer.horse_id))];
            emit(36,{other_id:other,common_peer_id:peer.horse_id,race_links:[r.race_id,alt.race_id],relative_observations:rel,comparability:comparable(r,alt)?"CONDITIONS_MATCH_STATE_UNRESOLVED":"CONDITIONS_DIFFER_OR_UNKNOWN",transitive_conclusion:null},[...ref,alt.evidence_id]);
          }
        }
      }
      const cur=fieldProfile(ids,h,cutoff);
      const previous=fieldProfile(peerIds,h,timestamp(r.started_at));
      emit(40,{prior_race_id:r.race_id,current_field_profile:{...cur,denominator:target.field_size-1},prior_field_profile:previous,comparative_direction:null,conditions_match:comparable(r,target)},[...ref,...cur.profiles.flatMap(p=>p.runs.map(q=>q.evidence_id)),...previous.profiles.flatMap(p=>p.runs.map(q=>q.evidence_id))]);
      unknown(40,"FIELD_STRENGTH_COMPARISON_POLICY_UNAPPROVED");
      const upper=target.class_verified===true&&r.class_verified===true?ruleFor(target,r):null;
      if(upper?.transition==="PROMOTION")emit(41,{demonstrated_higher_class:{race_id:r.race_id,finish:own.finish,status:own.status},conditions_match:comparable(r,target),transferable_evidence:null},[...ref,upper.evidence_id]);
    }
    const chronological=historyFor(h);
    const last=ownRaces.find(r=>r.race_id===chronological?.immediate_prior_race_id);
    if(last&&last===ownRaces[0]&&target.class_verified===true&&last.class_verified===true){
      const rule=ruleFor(last,target);if(rule)emit(39,{prior_class_key:last.class_key,target_class_key:target.class_key,transition:rule.transition,rule_ref:rule.source_ref,effective_date:rule.effective_from},[last.evidence_id,rule.evidence_id,chronological.evidence_id]);
    }
    const ts=unique(transfers.filter(t=>admission(t)&&t.current_horse_id===h&&horse(t.previous_horse_id)&&t.crosswalk_status==="VERIFIED"&&t.previous_horse_id.split(":")[0]!==h.split(":")[0]&&timestamp(t.effective_at)<cutoff),t=>t.previous_horse_id+"|"+t.effective_at);
    for(const t of ts){
      const before=racesFor(t.previous_horse_id).filter(r=>timestamp(r.started_at)<timestamp(t.effective_at));
      const after=ownRaces.filter(r=>timestamp(r.started_at)>timestamp(t.effective_at));
      emit(42,{crosswalk_status:t.crosswalk_status,transition_direction:t.previous_horse_id.split(":")[0]+"_TO_"+target.circuit,before:before.map(r=>({race_id:r.race_id,finish:result(r,t.previous_horse_id).finish,class_key:r.class_key??null})),after:after.map(r=>({race_id:r.race_id,finish:result(r,h).finish,class_key:r.class_key??null})),comparability:null},[t.evidence_id,...before.map(r=>r.evidence_id),...after.map(r=>r.evidence_id)]);
    }
    for(const n in items)if(!items[n].facts.length)unknown(n,"NO_ADMITTED_ANALYSIS_FACT");
    return {horse_no:entry.horse_no,horse_id:h,items};
  });
  const coverage=Object.fromEntries(Array.from({length:10},(_,i)=>{const n=String(i+33);return [n,{target:roster.length,with_output:runners.filter(h=>h.items[n].facts.length).length,observations:runners.reduce((s,h)=>s+h.items[n].facts.length,0),consumed:0}];}));
  return {runners,coverage,shared_followups:[...shared.values()],accepted_races:accepted.length,excluded_races:races.length-accepted.length,scoring_authorized:false,final_grade:null};
}
