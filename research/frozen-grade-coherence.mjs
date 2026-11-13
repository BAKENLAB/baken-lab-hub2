/**
 * RESEARCH ONLY. Read-only grade coherence inspection from PRE-RACE
 * FROZEN snapshots, with NO outcome input and no automatic relabeling.
 * A score / grade mismatch is a review flag, NOT an invalid S by itself:
 * confidence may depend on context not represented by numeric score.
 */
const stamp=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s))?Date.parse(s):NaN;
const isDay=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'));
const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
const blank=()=>({races:0,gradeCounts:{},scoreKnown:0,scoreMissing:0,rows:[],scoreInversions:0,flaggedExamples:[],flags:[]});
function summarize(b,{minimumSamples,saturationFraction}){
 const s=b.gradeCounts.S??0,a=b.gradeCounts.A??0;
 const S=b.rows.filter(x=>x.grade==='S'&&x.score!==null),
       A=b.rows.filter(x=>x.grade==='A'&&x.score!==null);
 const inverted=[];
 for(const si of S)for(const ai of A){
   if(si.score<ai.score)
     inverted.push({S:{race_no:si.race_no,track:si.track,score:si.score},
                    A:{race_no:ai.race_no,track:ai.track,score:ai.score}});
 }
 b.scoreInversions=inverted.length;b.flaggedExamples=inverted.slice(0,5);
 if(b.races>=minimumSamples&&s/b.races>=saturationFraction)b.flags.push('S_USAGE_SATURATION_REVIEW');
 if(s&&a&&inverted.length)b.flags.push('S_A_SCORE_ORDER_OVERLAP_REVIEW');
 if(b.scoreMissing)b.flags.push('SCORE_MISSING_DO_NOT_COMPUTE_SCORE_GAPS');
 if(b.races>=minimumSamples&&(!s||!a))b.flags.push('NO_S_A_CONTRAST_THIS_COHORT');
 b.S_first_share=b.races?s/b.races:null;
 delete b.rows;
 return b;
}
export function auditFrozenGradeCoherence(predictions,{minimumSamples=10,saturationFraction=0.80}={}){
 if(!Array.isArray(predictions)||!Number.isInteger(minimumSamples)||minimumSamples<5||
   typeof saturationFraction!=='number'||saturationFraction<=0||saturationFraction>1)
   throw new TypeError('GRADE_COHERENCE_ARGUMENTS_INVALID');
 const map=new Map(),excluded=[],seen=new Set();
 for(const p of predictions){
   const id=[p?.race_date,p?.circuit,p?.track,p?.race_no].join('|');
   if(p?.result!==undefined||p?.finishers!==undefined||p?.payload?.result!==undefined){
     excluded.push({id,reason:'RESULT_NOT_ALLOWED_IN_PRERACE_AUDIT'});continue;
   }
   if(!isDay(p?.race_date)||!['JRA','LOCAL'].includes(p?.circuit)||
     typeof p?.track!=='string'||!p.track||!Number.isInteger(p?.race_no)||
     p.race_no<1||p.race_no>24||p.status!=='FROZEN'||
     !Number.isFinite(stamp(p.frozen_at))||!Number.isFinite(stamp(p.post_time))||
     stamp(p.frozen_at)>=stamp(p.post_time)){
     excluded.push({id,reason:'NOT_VERIFIED_PRERACE_FROZEN'});continue;
   }
   if(seen.has(id)){excluded.push({id,reason:'DUPLICATE_RACE'});continue;}
   const top=p.payload?.top5;
   if(!Array.isArray(top)||top.length!==5||top[0]?.rank!==1||
     !['S','A','B','C','D','E','F'].includes(top[0]?.grade)){
     excluded.push({id,reason:'TOP5_INVALID'});continue;
   }
   const raw=top[0].score,score=raw===null||raw===undefined?null:Number(raw);
   if(score!==null&&!num(score)){excluded.push({id,reason:'INVALID_SCORE'});continue;}
   seen.add(id);
   const protocol=typeof p.protocol_version==='string'&&p.protocol_version ? p.protocol_version :'PROTOCOL_NOT_RECORDED';
   const key=[p.race_date,p.circuit,protocol].join('|');
   if(!map.has(key))map.set(key,blank());
   const b=map.get(key),grade=top[0].grade;
   b.races++;b.gradeCounts[grade]=(b.gradeCounts[grade]??0)+1;
   if(score===null)b.scoreMissing++;else b.scoreKnown++;
   b.rows.push({track:p.track,race_no:p.race_no,score,grade});
 }
 const cohorts={};
 for(const [key,b] of map) cohorts[key]=summarize(b,{minimumSamples,saturationFraction});
 return {mode:'PRERACE_GRADE_COHERENCE_RESEARCH_ONLY',
   cohorts,excluded,production_grade_changed:false,
   production_rank_changed:false,changed_frozen:false,
   target_result_used:false,market_used:false};
}
