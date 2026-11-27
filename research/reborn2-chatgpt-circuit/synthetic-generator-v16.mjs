import {generateFixture as legacy,validateGenerated as legacyCheck,abnormalVariants} from './synthetic-generator-v15.mjs';
// Synthetic exact integer tenths. Each 200m crossing is a runner clock;
// race leader cumulative clock = minimum of all runner clocks at that distance.
// Corner snapshots are synthetic 200/400/800/1200m, not real course geometry.
// No real world speed or trajectory inference.
export function generateV16(seed=20261127){
 const c=legacy(seed);c.id='GEN16-'+seed;
 let z=(seed^0x9e3779b9)>>>0;
 const rnd=n=>{z=(Math.imul(z,1664525)+1013904223)>>>0;return (z>>>16)%n;};
 c.target.conditions.first_corner_m=200;
 for(const r of c.history){
 r.conditions.first_corner_m=200;
 const n=r.rows.length,cornerAt=new Map([[0,0],[1,1],[3,2],[5,3]]);
 let elapsed=0;
 const cp=r.rows.map(()=>[]);
 for(let j=0;j<7;j++){
 elapsed+=115+rnd(20);
 const k=cornerAt.get(j);
 const order=r.rows.slice().sort((a,b)=>j===6?a.finish-b.finish:k!=null?a.corners[k]-b.corners[k]:cp[r.rows.indexOf(a)][j-1]-cp[r.rows.indexOf(b)][j-1]);
 let offset=0;
 for(const [i,h] of order.entries()){if(i)offset+=1+rnd(3);cp[r.rows.indexOf(h)].push(elapsed+offset);}
 }
 const leader=cp[0].map((_,j)=>Math.min(...cp.map(a=>a[j])));
 r.lap_tenths=leader.map((x,j)=>x-(leader[j-1]??0));
 r.rows.forEach((h,i)=>{h.checkpoint_tenths=cp[i];h.clock_tenths=cp[i][6];h.final3f_tenths=cp[i][6]-cp[i][3];h.margin_tenths=h.finish===1?null:h.clock_tenths-leader[6];});
 }
 return c;
}
export function validateV16(c){
 const errors=[];
 try{
 const keys=(o,s)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>s.split(' ').includes(k));
 const cond=o=>keys(o,'venue course_version distance_m surface turn first_corner_m going grade layout rule_version eligibility');
 if(!keys(c,'id target history')||!keys(c.target,'id date start published conditions field_complete entrants')||!cond(c.target.conditions)||!c.target.entrants.every(x=>keys(x,'id runner draw kg status'))||!c.history.every(r=>keys(r,'id date start published conditions field_count full_result_rows lap_kind lap_segment_m lap_tenths rows')&&cond(r.conditions)&&r.rows.every(x=>keys(x,'id runner kg finish clock_tenths margin_tenths final3f_tenths corners checkpoint_tenths'))))errors.push('SCHEMA');
 errors.push(...legacyCheck(c).errors);
 const ids=c.target.entrants.map(h=>h.id);
 if(ids.length<2)errors.push('FIELD_TOO_SMALL');
 for(const r of c.history){
 const bad=k=>errors.push(r.id+':'+k);
 if(r.conditions.distance_m!==1400||r.lap_segment_m.length!==7||!r.lap_segment_m.every(x=>x===200)||r.conditions.first_corner_m!==200)bad('SEGMENT_SCOPE');
 if(r.rows.some(h=>h.finish>1&&(!Number.isInteger(h.margin_tenths)||h.margin_tenths<=0)))bad('MARGIN');
 const cp=r.rows.map(h=>h.checkpoint_tenths);
 if(cp.some(a=>!Array.isArray(a)||a.length!==7||a.some((x,j)=>!Number.isInteger(x)||x<=(a[j-1]??0)))){bad('CHECKPOINT_CLOCK');continue;}
 let sum=0;
 for(let j=0;j<7;j++){
 sum+=r.lap_tenths[j];const a=cp.map(x=>x[j]);
 if(Math.min(...a)!==sum)bad('LEADER_ENVELOPE_'+j);
 if(new Set(a).size!==a.length)bad('CHECKPOINT_TIE_'+j);
 }
 const leader800=r.lap_tenths.slice(0,4).reduce((a,b)=>a+b,0);
 for(const [i,h] of r.rows.entries()){
 if(h.clock_tenths-h.final3f_tenths<leader800)bad('FINAL600_LEADER_BOUND');
 if(h.clock_tenths!==cp[i][6]||h.final3f_tenths!==cp[i][6]-cp[i][3])bad('INDIVIDUAL_CLOCK_LINK');
 const rank=j=>1+cp.filter(a=>a[j]<cp[i][j]).length;
 if(rank(6)!==h.finish||[0,1,3,5].some((j,k)=>rank(j)!==h.corners[k]))bad('POSITION_CLOCK_LINK');
 }
 }
 }catch(e){errors.push('MALFORMED_PACKET');}
 return {valid:errors.length===0,errors,formal:false,scope:'SYNTHETIC_EXACT_TENTHS'};
}
export function toCommonV16(c){
 const v=validateV16(c);if(!v.valid)throw Error('V16_INVALID:'+v.errors.join(','));
 const p=structuredClone(c);for(const r of p.history)for(const x of r.rows)delete x.checkpoint_tenths;return p;
}
export {abnormalVariants};
