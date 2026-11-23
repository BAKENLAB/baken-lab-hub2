// NEW, UNAPPROVED aggregation proposal, NOT a recovered official scoring engine.
// Reuses recovered diagnostic weights; does not create five-axis inputs from raw facts.
import {recoveredDiagnosis,AXES} from './recovered-diagnosis.mjs';
export function proposedAggregate(row){
 if(AXES.some(k=>typeof row.axes?.[k]!=='string'||!/^\d+(?:\.\d+)?$/.test(row.axes[k])||Number(row.axes[k])>100))throw Error('FIVE_COMPLETE_BOUNDED_AXES_REQUIRED');
 const d=recoveredDiagnosis(row);let n=BigInt(d.exact.numerator),den=BigInt(d.exact.denominator);
 n=n<0n?0n:n>100n*den?100n*den:n;
 const rounded=Number((2n*n+den)/(2n*den));
 return {schema:'UNAPPROVED_DIAGNOSTIC_AGGREGATE_V1',score:rounded,raw:d.exact,ledger:d.ledger,penalty:d.penalty,
  approval_status:'PENDING',input_provenance_verified:false,formal_score:null,production_allowed:false};
}
export function proposedOrder(rows){
 if(!Array.isArray(rows)||!rows.length||new Set(rows.map(r=>r.horse_no)).size!==rows.length||rows.some(r=>!Number.isInteger(r.horse_no)||r.horse_no<1||r.horse_no>24))throw Error('RESEARCH_FIELD_INVALID');
 const order=rows.map(r=>({horse_no:r.horse_no,...proposedAggregate(r)})).sort((a,b)=>{
  const raw=BigInt(b.raw.numerator)*BigInt(a.raw.denominator)-BigInt(a.raw.numerator)*BigInt(b.raw.denominator);
  return b.score-a.score||(raw>0n?1:raw<0n?-1:0)||a.horse_no-b.horse_no;
 });
 return order.map((r,i)=>({...r,research_rank:i+1,rounded_score_tie:order.some(x=>x.horse_no!==r.horse_no&&x.score===r.score),formal_rank:null}));
}
