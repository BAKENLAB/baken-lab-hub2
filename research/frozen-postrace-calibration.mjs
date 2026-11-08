/**
 * BAKEN LAB offline, post-result research only.
 * A pair has {prediction:{race_date,track,race_no,circuit,status,frozen_at,
 * post_time,payload:{top5,runners,eye}},result:{finishers:[...]}}.
 * Results may NOT feed a pre-race evaluator. No imports, network, database,
 * market fields, writes, or mutation of frozen snapshots.
 */
const allowedCircuit = new Set(['JRA', 'LOCAL']);
const isInt = n => Number.isInteger(n) && n >= 1 && n <= 24;
const dateOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const when = s => typeof s === 'string' && /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? Date.parse(s) : NaN;
const safeRatio = (n,d) => d ? n / d : null;
const counter = () => ({races:0,firstWins:0,firstTop3:0,winnerTop5:0,podiumTop5:0,allThreeTop5:0,eyeSelected:0,eyeWins:0,eyeTop3:0,winnerTop5PlusEye:0,allThreeTop5PlusEye:0,grades:{}});
function fail(reason, id) { return {reason, race_id:id}; }
function verify(pair) {
  const p=pair?.prediction, r=pair?.result, id=[p?.race_date,p?.track,p?.race_no].join('|');
  if(!dateOk(p?.race_date) || !allowedCircuit.has(p?.circuit) || !p.track || !isInt(p?.race_no)) return fail('RACE_KEY_INVALID',id);
  if(p.status!=='FROZEN' || !Number.isFinite(when(p.frozen_at)) || !Number.isFinite(when(p.post_time)) || when(p.frozen_at)>=when(p.post_time)) return fail('NOT_VALID_PRERACE_FROZEN',id);
  const top=p.payload?.top5, field=p.payload?.runners;
  if(!Array.isArray(top) || top.length!==5 || !Array.isArray(field) || field.length<5 || field.length>24) return fail('FIELD_OR_TOP5_INCOMPLETE',id);
  const fset=new Set();
  for(const h of field){ if(!isInt(h?.horse_no) || fset.has(h.horse_no) || !Number.isInteger(h.rank) || h.rank<1 || h.rank>field.length || typeof h.horse_name!=='string' || !h.horse_name.trim()) return fail('FIELD_IDENTITY_INVALID',id);fset.add(h.horse_no); }
  if(new Set(field.map(h=>h.rank)).size!==field.length) return fail('FIELD_RANK_DUPLICATED',id);
  const tset=new Set();
  for(let i=0;i<top.length;i++){
    const h=top[i];
    if(!isInt(h?.horse_no) || tset.has(h.horse_no) || h.rank!==i+1 || !['S','A','B','C','D','E','F'].includes(h.grade) || !field.some(f=>f.horse_no===h.horse_no&&f.horse_name===h.horse_name&&f.rank===h.rank)) return fail('TOP5_IDENTITY_INVALID',id);
    tset.add(h.horse_no);
  }
  const eye=p.payload.eye;
  if(eye!==null && eye!==undefined && (!isInt(eye.horse_no) || tset.has(eye.horse_no) || !field.some(f=>f.horse_no===eye.horse_no&&f.horse_name===eye.horse_name&&f.rank===eye.rank))) return fail('EYE_IDENTITY_INVALID',id);
  if(!Array.isArray(r?.finishers) || r.finishers.length<3) return fail('RESULT_MISSING_TOP3',id);
  const finish=r.finishers.slice(0,3);
  if(finish.some((h,i)=>h.finish!==i+1 || !isInt(h.horse_no) || !fset.has(h.horse_no)) || new Set(finish.map(h=>h.horse_no)).size!==3) return fail('RESULT_TOP3_INVALID',id);
  // Never inspect popularity, odds, or finishers beyond the top 3.
  return {p,id,top,field,eye,finish,kind:'valid'};
}
function record(g,x){
  const first=x.top[0].horse_no, actual=x.finish.map(h=>h.horse_no), top=new Set(x.top.map(h=>h.horse_no));
  const eye=x.eye?.horse_no ?? null, expanded=new Set([...top,...(eye===null?[]:[eye])]);
  g.races++;
  g.firstWins+=Number(first===actual[0]);
  g.firstTop3+=Number(actual.includes(first));
  g.winnerTop5+=Number(top.has(actual[0]));
  g.podiumTop5+=actual.filter(n=>top.has(n)).length;
  g.allThreeTop5+=Number(actual.every(n=>top.has(n)));
  g.eyeSelected+=Number(eye!==null);
  g.eyeWins+=Number(eye===actual[0]);
  g.eyeTop3+=Number(eye!==null && actual.includes(eye));
  g.winnerTop5PlusEye+=Number(expanded.has(actual[0]));
  g.allThreeTop5PlusEye+=Number(actual.every(n=>expanded.has(n)));
  const grade=x.top[0].grade, gr=g.grades[grade]??{races:0,wins:0,top3:0};
  gr.races++;gr.wins+=Number(first===actual[0]);gr.top3+=Number(actual.includes(first));g.grades[grade]=gr;
}
function present(g,minimumGradeSample){
  const grades=Object.fromEntries(Object.entries(g.grades).map(([k,v])=>[k,{...v,winRate:safeRatio(v.wins,v.races),top3Rate:safeRatio(v.top3,v.races)}]));
  const S=grades.S, A=grades.A;
  const alerts=[];
  if(S?.races>=20 && S.races/g.races>=0.7) alerts.push('S_ON_FIRST_TOO_FREQUENT_REVIEW');
  if(S?.races>=minimumGradeSample && A?.races>=minimumGradeSample && S.top3Rate<=A.top3Rate) alerts.push('S_NOT_MORE_CALIBRATED_THAN_A_REVIEW');
  return {...g,grades,firstWinRate:safeRatio(g.firstWins,g.races),firstTop3Rate:safeRatio(g.firstTop3,g.races),winnerTop5Rate:safeRatio(g.winnerTop5,g.races),eyeTop3Rate:safeRatio(g.eyeTop3,g.eyeSelected),S_firstShare:safeRatio(S?.races??0,g.races),alerts};
}
export function auditFrozenPostrace(pairs,{minimumGradeSample=20}={}){
  if(!Array.isArray(pairs) || !Number.isInteger(minimumGradeSample) || minimumGradeSample<5) throw new TypeError('AUDIT_INPUT_INVALID');
  const rejected=[],seen=new Set(),byCircuit={JRA:counter(),LOCAL:counter()},all=counter(),missed=[];
  for(const pair of pairs){
    const x=verify(pair);
    if(!x.kind){ rejected.push(x);continue; }
    if(seen.has(x.id)){rejected.push(fail('DUPLICATE_RACE_KEY',x.id));continue;}
    seen.add(x.id);
    record(byCircuit[x.p.circuit],x);record(all,x);
    const actual=x.finish.map(h=>h.horse_no), top=new Set(x.top.map(h=>h.horse_no)), eye=x.eye?.horse_no ?? null;
    const outside=actual.filter(n=>!top.has(n));
    if(outside.length) missed.push({race_id:x.id,circuit:x.p.circuit,actual_top3:actual,
      outside_top5:outside,eye,eye_caught:outside.filter(n=>n===eye),
      original_ranks:actual.map(n=>({horse_no:n,rank:x.field.find(h=>h.horse_no===n)?.rank}))});
  }
  return {mode:'POST_RESULT_RESEARCH_ONLY',production_rank_changed:false,production_score_changed:false,
    frozen_modified:false,market_used:false,target_result_used_in_prerace:false,
    accepted:seen.size,rejected,all:present(all,minimumGradeSample),
    circuits:Object.fromEntries(Object.entries(byCircuit).map(([k,v])=>[k,present(v,minimumGradeSample)])),
    missed_cases:missed};
}
