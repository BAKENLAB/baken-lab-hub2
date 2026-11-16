import {readFileSync} from 'node:fs';import {mean,num,age} from './features.mjs';
const freeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return Object.freeze(o);};export const POLICY=freeze(JSON.parse(readFileSync(new URL('policy.json',import.meta.url))));const clamp=x=>Math.max(0,Math.min(1,x));
const place=p=>p.baseline.field_size>1?(p.baseline.field_size-p.baseline.finish)/(p.baseline.field_size-1):null;
const good=p=>p.baseline.finish<=3||(num(p.baseline.margin_to_winner)!==null&&p.baseline.margin_to_winner<=0.6);
const atom=(p,field)=>({id:p.archive.run_id+':'+field,root:p.archive.race_id,field});
const laps=p=>{const raw=p.archive.halon_times;if(typeof raw!=='string'||p.archive.distance%200!==0)return null;const x=raw.split(/\s*-\s*/).map(Number);return x.length===p.archive.distance/200&&x.length>=6&&x.every(n=>n>=8&&n<=20)?x:null;};
export function scoreClaims(r,f,field){const h=f.scoring_priors,a=f.attrs,claims=[],put=(id,unit,atoms,reason,extra={})=>claims.push({id,unit:unit==null?null:clamp(unit),atoms,reason,...extra});
 const same=h.filter(p=>p.baseline.surface===r.conditions.surface&&Math.abs(p.baseline.distance-r.conditions.distance)<=POLICY.near_distance_metres),form=same[0]??h[0];
 const quality=form?place(form):null,margin=form?num(form.baseline.margin_to_winner):null;
 put('comparable_form',quality===null?null:margin===null?quality:mean([quality,clamp(1-margin/POLICY.margin_seconds_scale)]),form?[atom(form,'finish'),...(margin===null?[]:[atom(form,'margin')])]:[],'Latest verified comparable run, otherwise explicit broad-history proxy; normalized finish and known margin only.',{proxy:!!form&&!same.length});
 const rest=h.filter(p=>p!==form);put('consistency_recency',rest.length>=2?mean(rest.map(p=>place(p)*(0.5+0.5*clamp(1-age(r,p.baseline)/POLICY.recency_days_scale)))):null,rest.map(p=>atom(p,'finish')),'Mean other-runs normalized finish × declared recency; no target outcome.');
 const e=h.filter(p=>p.positions_verified&&p.baseline.field_size>1);put('early_reproduction',e.length>=2?mean(e.map(p=>1-(p.baseline.early_pos-1)/(p.baseline.field_size-1))):null,e.map(p=>atom(p,'early_pos')),'At least two verified historical early positions, field-normalized.');
 const pace=h.filter(p=>laps(p)&&p.positions_verified&&p.baseline.field_size>1),fast=field.frontShare.lower>=POLICY.pace_front_share,slow=field.frontShare.upper<POLICY.pace_front_share;
 const applicable=pace.filter(p=>{const l=laps(p),early=l.slice(0,3).reduce((a,b)=>a+b),late=l.slice(-3).reduce((a,b)=>a+b);return fast?early<late:slow?early>=late:false;});
 put('projected_pace',applicable.length?mean(applicable.map(p=>clamp(.5+(p.baseline.early_pos-p.baseline.final_turn_pos)/p.baseline.field_size))):null,applicable.flatMap(p=>[atom(p,'pace_laps'),atom(p,'corner_progress')]),'Declared front-share bounds choose pressure scenario only when unambiguous; past observed corner progress under matching lap scenario is a research proxy.',{scenario:fast?'PRESSURE':slow?'LOW_PRESSURE':'UNKNOWN',proxy:true});
 put('draw_geometry',null,[],'Official draw alone does not establish first-turn or start-surface effect.');
 const distance=h.filter(p=>p.baseline.surface===r.conditions.surface&&p.baseline.distance>=r.conditions.distance);put('distance_stamina',distance.length?mean(distance.map(place)):null,distance.map(p=>atom(p,'finish')),'Same/longer distance finish quality; shared finish atoms cannot score twice.');
 const track=h.filter(p=>p.baseline.surface===r.conditions.surface&&p.baseline.track===r.track),own=track.length?mean(track.map(place)):null;
 const ev=f.eval.matches.filter(m=>m.finish<=3||num(m.margin)!==null&&m.margin<=0.6),eu=ev.length?Math.max(...ev.map(m=>POLICY.eval_units[m.grade])):null;
 // Course-fit evidence gets ONE common budget. Eval may contribute at most2/10.
 const cu=own===null?(eu===null?null:eu*POLICY.course_eval_max_points/10):own*(1-POLICY.course_eval_max_points/10)+(eu??0)*POLICY.course_eval_max_points/10;
 put('course_affinity',cu,[...track.map(p=>atom(p,'finish')),...ev.map(m=>({id:m.run_id+':eval_course_context',root:m.race_id,field:'eval_course_context'}))],'Shared course budget: up to8 own-track points plus up to2 Eval contextual points; no second independent EYE factor from same performance.',{components:[{cap:8,unit:own,atoms:track.map(p=>atom(p,'finish'))},{cap:2,unit:eu,atoms:ev.map(m=>({id:m.run_id+':eval_course_context',root:m.race_id,field:'eval_course_context'}))}],proxy:eu!==null});
 const target=POLICY.class_levels[r.conditions.class_name],classes=h.filter(p=>POLICY.class_levels[p.archive.class_name]!==undefined);put('class',target!==undefined&&classes.length?mean(classes.map(p=>clamp(.5+(POLICY.class_levels[p.archive.class_name]-target)/4))):null,classes.map(p=>atom(p,'class_name')),'Declared ordinal class exposure relative to target; NOT proof of class-level success.',{proxy:true});
 const rivals=f.rivals??[],unique=[...new Map(rivals.map(o=>[o.opponent_id,o])).values()].filter(o=>Number.isInteger(o.followup.finish)&&o.followup.finish>=1&&o.followup.field_size>1&&o.followup.finish<=o.followup.field_size);
 put('rival_followup',unique.length>=POLICY.rival_min_observed_opponents?mean(unique.map(o=>(o.followup.field_size-o.followup.finish)/(o.followup.field_size-1))):null,unique.map(o=>({id:o.followup.run_id+':opponent_finish',root:o.prior_race_id,field:'opponent_followup'})),'Direct-opponent first pre-target flat followup quality; at least3 unique observed opponents. Exposure proxy, no causal ability claim.',{proxy:true,opponents:unique.length});
 const last=h.filter(p=>p.relative3f_verified&&p.archive.field_size>1);put('relative_last3f',last.length?mean(last.map(p=>1-(p.archive.final3f_rank-1)/(p.archive.field_size-1))):null,last.map(p=>atom(p,'final3f_rank')),'Complete timed-field last3f rank normalization.');
 const sustained=h.filter(p=>p.positions_verified&&p.baseline.corner_positions.length>=4&&p.baseline.distance>=1800&&laps(p));put('sustained_effort',sustained.length?mean(sustained.map(p=>clamp(.5+(p.baseline.corner_positions[1]-p.baseline.final_turn_pos)/p.baseline.field_size))):null,sustained.flatMap(p=>[atom(p,'corner_progress'),atom(p,'pace_laps')]),'Middle-to-final-corner progress with complete laps is ONLY a sustained-position proxy, not verified long-spurt physiology.',{proxy:true});
 const going=h.filter(p=>a.going&&p.archive.going===a.going);put('going_weather',going.length?mean(going.map(place)):null,going.map(p=>atom(p,'finish')),'Observed finish quality on same going; weather alone has no preference bonus.');
 const weight=h.filter(p=>good(p)&&num(p.archive.weight_carried)!==null);put('weight_sex_age',weight.length&&num(a.weight_carried)!==null?mean(weight.map(p=>clamp(.5+(Number(p.archive.weight_carried)-Number(a.weight_carried))/POLICY.weight_delta_scale_kg))):null,weight.map(p=>atom(p,'carried_weight')),'Current weight versus actual previous good-run carried weight; no automatic age/sex benefit.',{proxy:true});
 const latest=h[0],body=h.map(p=>num(p.archive.body_weight)).filter(x=>x!==null),bodyUnit=num(a.body_weight)!==null&&body.length?clamp(1-Math.abs(Number(a.body_weight)-mean(body))/Math.max(1,mean(body)*.1)):null,restUnit=latest&&!f.priors.some(p=>p.baseline.race_date>latest.baseline.race_date)?Math.exp(-Math.pow((age(r,latest.baseline)-POLICY.rest_centre_days)/POLICY.rest_scale_days,2)):null;
 put('body_equipment_rest',bodyUnit!==null&&restUnit!==null?mean([bodyUnit,restUnit]):null,latest?[atom(latest,'body_rest_observation')]:[],'Own body-weight deviation and declared rest-spacing hypothesis. No inferred health/training/equipment advantage.',{proxy:true,unknown_equipment_effect:true});
 put('jockey_trainer',null,[],'Names acquired but no identity-anchored pre-target performance estimator; no name preference or invented coefficient.');
 return claims;
}
export function allocate(claims){
 const used=new Set(),spent=new Map(),ledger=[];let lower=0,upper=0;
 for(const [id,cap] of Object.entries(POLICY.weights)){
  const c=claims.find(c=>c.id===id),components=c?.components??[{cap,unit:c?.unit??null,atoms:c?.atoms??[]}];
  if(components.reduce((s,x)=>s+x.cap,0)!==cap)throw Error('COMPONENT_BUDGET');
  const detail=[];for(const part of components){let lo=0,hi=part.cap,status='UNKNOWN';
   if(part.unit!==null&&part.unit!==undefined){if(!Number.isFinite(part.unit)||part.unit<0||part.unit>1||!part.atoms.length)throw Error('CLAIM');
    if(part.atoms.some(a=>used.has(a.id))){lo=hi=0;status='DUPLICATE_ATOM_SUPPRESSED';}
    else {const roots=[...new Set(part.atoms.map(a=>a.root))];lo=Math.max(0,Math.min(part.cap*part.unit,...roots.map(root=>POLICY.shared_prior_race_cap-(spent.get(root)||0))));hi=lo;status=lo<part.cap*part.unit?'SHARED_RACE_CAPPED':'SUPPORTED_RESEARCH_PROPOSAL';for(const a of part.atoms)used.add(a.id);for(const root of roots)spent.set(root,(spent.get(root)||0)+lo);}
   }detail.push({...part,status,lower:lo,upper:hi,points:status==='UNKNOWN'?null:lo});
  }
  const lo=detail.reduce((s,x)=>s+x.lower,0),hi=detail.reduce((s,x)=>s+x.upper,0),status=detail.every(x=>x.status==='UNKNOWN')?'UNKNOWN':detail.some(x=>x.status==='UNKNOWN')?'PARTIALLY_SUPPORTED':'SUPPORTED_RESEARCH_PROPOSAL';lower+=lo;upper+=hi;ledger.push({...c,id,cap,status,points:status==='UNKNOWN'?null:lo,lower:lo,upper:hi,components:detail});
 }
 return {decision_score:lower,lower,upper,ability_score:lower===upper?lower:null,ledger,missing_budget:ledger.reduce((s,x)=>s+x.upper-x.lower,0)};
}
