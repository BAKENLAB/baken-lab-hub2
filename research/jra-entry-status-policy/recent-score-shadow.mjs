// SHADOW ONLY. Mirrors the existing SQL run_quality and recent-score component.
// Does not generate an official prediction or write to a database.
import {classifyPastRun} from './past-run-classification.mjs';
export function recentScoreShadow(pastRuns) {
  if (!Array.isArray(pastRuns)) return {state:'HOLD',reason:'MISSING_HISTORY'};
  const starts=[];
  for (const run of pastRuns) {
    const kind=classifyPastRun(run);
    if (kind.kind==='UNKNOWN') return {state:'HOLD',reason:'UNKNOWN_HISTORY_EVENT'};
    if (!kind.countAsStart) continue;
    starts.push(run);
  }
  const qualities=starts.slice(0,4).map(run=>{
    const n=Number(run.field_size),f=Number(run.finish);
    if (!Number.isInteger(f) || f<1 || !Number.isInteger(n) || n<=1) return null;
    const place=100*(n-f)/(n-1);
    const margin=run.margin_to_winner == null ? null : Number(run.margin_to_winner);
    const marginPart=margin!=null && Number.isFinite(margin)
      ? Math.max(0,Math.min(100,100*(1-Math.min(margin/6,1))))*0.25
      : place*0.25;
    return place*0.75+marginPart;
  }).filter(x=>x!==null);
  return {state:'CALCULATED',actualStarts:starts.length,scoredLastFour:qualities.length,
    recentScore:qualities.length?qualities.reduce((a,b)=>a+b,0)/qualities.length:null};
}
