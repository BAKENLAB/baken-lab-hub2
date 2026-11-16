// Unapproved, pre-outcome development proposal. Never used by production/V2.
export const RUBRIC=Object.freeze([
 ['comparable_form',15],['consistency_recency',10],['early_reproduction',8],['projected_pace',8],['draw_geometry',4],['distance_stamina',10],['course_affinity',10],['class',8],['rival_followup',7],['relative_last3f',5],['sustained_effort',5],['going_weather',3],['weight_sex_age',3],['body_equipment_rest',2],['jockey_trainer',2]
].map(([id,cap])=>Object.freeze({id,cap})));
export const POLICY=Object.freeze({status:'UNAPPROVED_DEVELOPMENT_SIMULATION',missing:'INTERVAL_NO_REDISTRIBUTION',dependency_caps:[15,25,40],primary_cap:25,independent_holdout:false});
export const clamp=x=>Math.max(0,Math.min(1,x));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function placement(h){return Number.isInteger(h.finish)&&h.finish>=1&&h.field_size>1&&h.finish<=h.field_size?clamp((h.field_size-h.finish)/(h.field_size-1)):null;}
// Explicit proposal functions; not calibrated, not tuned to the 46R outcomes.
export function proposedClaims(r,facts){
 const h=facts.priors.filter(p=>p.match_status==='MATCHED'&&p.flat&&p.evaluation_eligible),latest=h[0];
 const claims=[];const put=(id,unit,atoms,why)=>claims.push({id,unit:unit==null?null:clamp(unit),atoms,why});
 const atom=(p,field)=>({id:p.archive.run_id+':'+field,root:p.archive.race_id,field});
 const same=h.filter(p=>p.baseline.surface===r.conditions.surface&&Math.abs(p.baseline.distance-r.conditions.distance)<=200);
 const comp=same[0],pos=comp&&placement(comp.baseline),margin=comp?.baseline.margin_to_winner;
 put('comparable_form',pos!=null&&typeof margin==='number'?mean([pos,clamp(1-margin/2)]):null,comp?[atom(comp,'finish'),atom(comp,'margin')]:[],'Latest comparable run; mean(field-normalized finish, clamp(1-margin_seconds/2)).');
 const other=h.filter(p=>p!==comp&&placement(p.baseline)!=null);
 put('consistency_recency',other.length>=2?mean(other.map(p=>placement(p.baseline)*(0.5+0.5*clamp(1-(Date.parse(r.race_date)-Date.parse(p.baseline.race_date))/86400000/365)))):null,other.map(p=>atom(p,'finish')),'At least two OTHER runs; finish quality * (0.5+0.5*365-day recency).');
 const early=h.filter(p=>p.positions_verified&&p.baseline.early_pos>=1&&p.baseline.early_pos<=p.baseline.field_size&&p.baseline.field_size>1);
 put('early_reproduction',early.length>=2?mean(early.map(p=>clamp(1-(p.baseline.early_pos-1)/(p.baseline.field_size-1)))):null,early.map(p=>atom(p,'early_pos')),'Mean normalized early position; >=2 confirmed flat runs. Descriptive prior ability, not projected pace.');
 put('projected_pace',null,[],'Full-field prior laps are observed; target pace effect model not established.');
 put('draw_geometry',null,[],'Draw presence alone is not a verified geometry effect.');
 const long=h.filter(p=>p.baseline.surface===r.conditions.surface&&p.baseline.distance>=r.conditions.distance&&placement(p.baseline)!=null);
 put('distance_stamina',long.length?mean(long.map(p=>placement(p.baseline))):null,long.map(p=>atom(p,'finish')),'Mean finish quality at same/longer distance; atom reuse with form/consistency suppressed.');
 const course=h.filter(p=>p.baseline.surface===r.conditions.surface&&p.baseline.track===r.track&&placement(p.baseline)!=null);
 put('course_affinity',course.length?mean(course.map(p=>placement(p.baseline))):null,course.map(p=>atom(p,'finish')),'Same-track placement proxy; shared budget with Eval. Eval is contextual audit only until coefficients/source layout validated.');
 put('class',null,[],'Verified class labels acquired; ordered cross-class scoring map not approved.');
 put('rival_followup',null,[],'Direct opponents/followup resolver requires a separately locked, pre-target cohort; not inferred from own finish.');
 const last=h.filter(p=>p.relative3f_verified&&p.archive.field_size>1);
 put('relative_last3f',last.length?mean(last.map(p=>1-(p.archive.final3f_rank-1)/(p.archive.field_size-1))):null,last.map(p=>atom(p,'final3f_rank')),'Mean verified within-field last3f rank normalization, complete timed fields only.');
 put('sustained_effort',null,[],'Final3f and position gain alone cannot prove long-spurt sustainability.');
 for(const id of ['going_weather','weight_sex_age','body_equipment_rest','jockey_trainer'])put(id,null,[],'Attribute acquisition is not an effect estimate; independently trained/reviewed effect rule missing.');
 return claims;
}
export function scoreInterval(claims,{raceCap=POLICY.primary_cap}={}){
 if(!POLICY.dependency_caps.includes(raceCap))throw Error('UNDECLARED_CAP');
 const seen=new Set(),spent=new Map(),ledger=[];let lower=0,upper=0;
 for(const item of RUBRIC){const c=claims.find(x=>x.id===item.id);let status='UNKNOWN',points=null,lo=0,hi=item.cap;
  if(c?.unit!=null){if(!Number.isFinite(c.unit)||c.unit<0||c.unit>1||!c.atoms.length)throw Error('INVALID_PROPOSED_CLAIM');
   // Fixed rubric order, shared atoms are alternatives, never extra bonuses.
   if(c.atoms.some(a=>seen.has(a.id))){status='DUPLICATE_ATOM_SUPPRESSED';points=lo=hi=0;}
   else {const roots=[...new Set(c.atoms.map(a=>a.root))];points=Math.max(0,Math.min(item.cap*c.unit,...roots.map(k=>raceCap-(spent.get(k)||0))));lo=hi=points;status=points<item.cap*c.unit?'SHARED_RACE_CAPPED':'PROPOSED_SCORED';for(const a of c.atoms)seen.add(a.id);for(const k of roots)spent.set(k,(spent.get(k)||0)+points);}
  }lower+=lo;upper+=hi;ledger.push({id:item.id,cap:item.cap,status,points,lower:lo,upper:hi,atoms:c?.atoms??[],reason:c?.why??'UNCONNECTED'});
 }return {lower,upper,coverage_budget:RUBRIC.filter(i=>ledger.find(l=>l.id===i.id).status!=='UNKNOWN').reduce((n,i)=>n+i.cap,0),definitive_score:lower===upper?lower:null,ledger,race_cap:raceCap,status:POLICY.status};
}
export function intervalRanks(rows){return rows.map(r=>{const others=rows.filter(x=>x.horse_no!==r.horse_no);const best=1+others.filter(x=>x.interval.lower>r.interval.upper).length,worst=1+others.filter(x=>x.interval.upper>=r.interval.lower).length;return {...r,rank_interval:[best,worst],rank:best===worst?best:null};});}
