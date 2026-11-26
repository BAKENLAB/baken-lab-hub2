import { buildIntegratedAudit } from './integrated-audit.mjs';
import { compareOpponents } from './opponent-context.mjs';
import { evaluateLocalBenchmark } from './local-benchmark.mjs';
import { assessContext, judgeHistoricalContext } from './context-assessment.mjs';
import { inspectStartIncident } from '../reborn2-evidence-01-12/start-incident-09-intake.mjs';
import { compareHistory } from './trends.mjs';
import { supplyArchiveMaterials } from '../reborn2-evidence-01-12/archive-materials.mjs';
import { integrateBase0112 } from '../reborn2-evidence-01-12/base-ability-01-12-partial.mjs';

const ids=Array.from({length:32},(_,i)=>String(i+1).padStart(2,'0'));
const median=values=>{
  const a=values.slice().sort((x,y)=>x-y), m=Math.floor(a.length/2);
  return a.length ? (a[m]+a[Math.floor((a.length-1)/2)])/2 : null;
};
const positive=x=>typeof x==='number' && Number.isFinite(x) && x>0;
const cohortFields=['track','surface','distance','going','class_name','layout','weight_group'];
const sameCondition=(a,b)=>cohortFields.every(k=>a[k]!==null && a[k]!==undefined && a[k]!=='' && a[k]===b[k]);
const runKey=run=>JSON.stringify([run.race_date,run.track,run.race_no,run.prior_no,run.source_ref]);

// Compare only independently admitted, versioned benchmark samples observed before the prior start.
export function compareClock(run,samples,circuit) {
  if (!positive(run.elapsed_seconds) || !run.start_at || !Number.isFinite(Date.parse(run.start_at))) return null;
  const eligible=samples.filter(s=>s.circuit===circuit && s.verified===true && s.source_ref &&
    s.race_date<run.race_date && Date.parse(s.observed_at)<Date.parse(run.start_at) &&
    sameCondition(run,s) && positive(s.winner_seconds));
  if (new Set(eligible.map(s=>JSON.stringify([s.race_date,s.track,s.race_no]))).size!==eligible.length)
    throw Error('DUPLICATE_BENCHMARK_RACE');
  if (!eligible.length) return null;
  const baseline=median(eligible.map(s=>s.winner_seconds));
  return {n:eligible.length,median_winner_seconds:baseline,residual_seconds:run.elapsed_seconds-baseline,
    source_refs:eligible.map(s=>s.source_ref)};
}

export function analyzeField({input, profile=null, benchmarks=[],historyByHorse={},incidentWitnesses=[],verifiedContexts={},ratings=[],verifiedRoster=[],localBenchmarkByHorse={},opponentsByHorse={}}) {
  const packet=supplyArchiveMaterials(input);
  if (profile && profile.circuit!==input.circuit) throw Error('PROFILE_CIRCUIT_MISMATCH');
  const base=profile ? integrateBase0112({profile,roster:input.roster,targetDate:input.targetDate}) : null;
  const ownRuns=packet.runners.flatMap(h=>h.materials);
  const shared=new Map();
  for(const run of ownRuns){
    const key=JSON.stringify([run.source_ref,run.race_date,run.track,run.race_no]);
    if(!shared.has(key)) shared.set(key,[]);
    shared.get(key).push(run);
  }
  const runners=packet.runners.map(horse=>{
    const items=Object.fromEntries(ids.map(id=>[id,[]]));
    const add=(id,run,status,value)=>items[id].push({status,evidence_id:runKey(run),value});
    for(const run of horse.materials){
      const witness=input.circuit==='LOCAL' ? input.rows.find(r=>Number(r.current_no)===run.current_no &&
        r.prior_date===run.race_date && r.prior_track===run.track && Number(r.prior_race_no)===run.race_no) : null;
      const labels=witness?.corners?.map(c=>c.corner).sort((a,b)=>a-b);
      const validLabels=labels?.every(n=>Number.isInteger(n)&&n>0) && new Set(labels).size===labels.length;

      for(const [id,field] of [['02','finish'],['03','gap_winner'],['04','gap_next'],['05','elapsed_seconds'],['06','final3f']]){
        if(Number.isFinite(run[field])) add(id,run,'ARCHIVE_CANDIDATE',run[field]);
      }
      const clock=compareClock(run,benchmarks,input.circuit);
      if(clock) add('05',run,'BENCHMARK_COMPARISON',clock);
      if(run.race_laps?.length){
        const equal=run.distance%200===0?run.race_laps:run.race_laps.slice(1);
        if(equal.length>=3) add('19',run,'RACE_LEVEL_OBSERVATION',{
          last_600_seconds:Math.round(equal.slice(-3).reduce((a,b)=>a+b,0)*10)/10,
          individual_sectionals:false});
      }
      if(run.corners?.length && run.corners.every(n=>Number.isInteger(n)&&n>=1&&n<=24))
        add('17',run,'POSITION_OBSERVATION',{positions:run.corners,labels:validLabels?labels:null});
      if(run.race_laps?.length && run.corners?.length>=2 && positive(run.final3f)){
        const facts={positions:run.corners,final3f_seconds:run.final3f,race_lap_seconds:run.race_laps,
          individual_acceleration_measured:false};
        add('07',run,'POSITION_AND_RACE_PACE_PROXY',facts);
        if(Number.isFinite(run.gap_winner)) add('08',run,'FINISH_AND_RACE_PACE_PROXY',
          {...facts,winner_gap_seconds:run.gap_winner});
      }
      const reports=incidentWitnesses.filter(x=>x.currentNo===horse.horse_no && x.raceDate===run.race_date &&
        x.track===run.track && x.raceNo===run.race_no && x.archiveHorse?.no===run.prior_no &&
        x.archiveSourceRef===run.source_ref);
      if(reports.length===1){
        const event=inspectStartIncident({...reports[0],circuit:input.circuit});
        if(event.status!=='MISSING') add('09',run,'INCIDENT_DISCOVERY_ONLY',event);
      }
      // Local archive labels are retained. JRA unlabeled arrays cannot establish consecutive named corners.
      if(input.circuit==='LOCAL' && validLabels && labels.length===run.corners?.length && labels.length){
        const changes=run.corners.slice(1).flatMap((rank,i)=>labels[i+1]===labels[i]+1?
          [{from:labels[i],to:labels[i+1],gain:run.corners[i]-rank}]:[]);
        const recovery=changes.flatMap((loss,i)=>changes.slice(i+1).filter(gain=>
          loss.gain<0 && gain.gain>0 && loss.to===gain.from).map(gain=>({loss,gain})));
        if(recovery.length) add('21',run,'OBSERVED_RECOVERY',recovery);
        const separated=changes.some((change,i)=>change.gain>0 && changes.slice(i+2).some((gain,j)=>
          gain.gain>0 && changes.slice(i+1,i+2+j).some(mid=>mid.gain<=0) &&
          changes.slice(i,i+2+j).every((step,k)=>step.to===changes[i+k+1].from)));
        if(separated) add('10',run,'SEPARATED_POSITION_GAIN_PROXY',{individual_acceleration_measured:false,changes});
        if(changes.length) add('18',run,'POSITION_PROXY',changes);
        if(changes.some(x=>x.gain>0)) add('22',run,'POSITION_PROXY',changes.filter(x=>x.gain>0));
      }
      if(run.finish>1 && Number.isFinite(run.gap_winner)) add('28',run,'OBSERVED_DEFEAT_CONTEXT',{finish:run.finish,gap:run.gap_winner});
      if(run.finish===1) add('12',run,'HISTORICAL_WIN_OBSERVED',{opposition_strength:null,scenario_fit:null});
      if(run.finish>0){
        const rivals=shared.get(JSON.stringify([run.source_ref,run.race_date,run.track,run.race_no]))
          .filter(other=>other.current_no!==run.current_no && other.prior_no!==run.prior_no && other.finish>0);
        if(rivals.length) add('12',run,'DIRECT_HISTORICAL_MATCHUP_CANDIDATE',rivals.map(other=>({
          rival_no:other.current_no,own_finish:run.finish,rival_finish:other.finish,
          rival_evidence_id:runKey(other),opposition_strength:null,scenario_fit:null
        })));
      }
      if(run.finish===1) add('30',run,'OBSERVED_WIN_CONTEXT',{clock:run.elapsed_seconds,gap_next:run.gap_next});
    }
    const history=historyByHorse[horse.horse_no];
    if(history){
      for(const [id,findings] of Object.entries(compareHistory(history.runs,input.targetDate,history.chronologyProven)))
        items[id]=findings.map(value=>({status:'OBSERVED_COMPARISON',value}));
    }
    const identityRows=verifiedRoster.filter(h=>h.horse_no===horse.horse_no && h.verified===true &&
      typeof h.horse_id==='string' && /^\d+$/.test(h.horse_id) &&
      Date.parse(h.checked_at)<=Date.parse(input.cutoff));
    const identity=identityRows.length===1 && verifiedRoster.filter(h=>h.horse_id===identityRows[0].horse_id).length===1
      ? identityRows[0].horse_id : null;
    const benchmarkInput=input.circuit==='LOCAL'?localBenchmarkByHorse[horse.horse_no]:null;
    const localBenchmark=benchmarkInput?evaluateLocalBenchmark({...benchmarkInput,
      targetDate:input.targetDate,cutoff:input.cutoff,
      runs:benchmarkInput.runs.map(r=>({...r,identity_verified:r.identity_verified===true&&Boolean(identity)&&r.horse_id===identity}))}):null;
    if(localBenchmark){
      for(const [id,field] of [['05','elapsed_residual_seconds'],['06','individual_final3f_residual_seconds']])
        for(const finding of localBenchmark.observations.filter(x=>Number.isFinite(x[field])))
          items[id].push({evidence_id:finding.evidence_id,status:finding.status,value:finding});
      for(const finding of localBenchmark.comparisons) items['11'].push({status:'DISTANCE_COMPARISON',value:finding});
      for(const [id,findings] of Object.entries(localBenchmark.trends))
        items[id].push(...findings.map(value=>({status:'ADMITTED_HISTORICAL_COMPARISON',value})));
    }
    const item01=base?.runners.find(h=>h.horse_no===horse.horse_no)?.item01??null;
    const context=assessContext({items,targetDate:input.targetDate,cutoff:input.cutoff,ratings,
      runPairs:horse.materials.map(run=>({run:{...run,horse_id:identity},id:runKey(run),context:verifiedContexts[horse.horse_no]?.[runKey(run)]}))});
    for(const [id,findings] of Object.entries(context.findings)) items[id].push(...findings);
    const opponents=(opponentsByHorse[horse.horse_no]??[]).flatMap(w=>
      w.own?.horse_id===identity && horse.materials.some(run=>run.source_ref===w.own.result_ref)
        ? compareOpponents({...w,cutoff:input.cutoff}) : []);
    for(const value of opponents) items['12'].push({status:'VERIFIED_HISTORICAL_MATCHUP',value});
    const historicalJudgments=judgeHistoricalContext(context.units,context.findings);
    const consumed=item01?.consumed_items??[];
    const analyzed={horse_no:horse.horse_no,items,item01,historical_context:context.units,historical_judgments:historicalJudgments,ability_trace:{
      consumed_items:consumed,
      context_items_read:context.consumed,
      evidence_sources:item01?[...item01.visible_condition_evidence,...item01.other_condition_evidence].flatMap(c=>c.source_refs):[],
      final_grade:null}};
    return {...analyzed,integrated_audit:buildIntegratedAudit({horse:analyzed,materials:horse.materials})};
  });
  const coverage=Object.fromEntries(ids.map(id=>{
    const supplied=h=>id==='01'?h.ability_trace.consumed_items.length>0:h.items[id].length>0;
    const analyzed=runners.filter(supplied).length;
    const observations=runners.reduce((total,h)=>total+h.items[id].length,0);
    return [id,{target:runners.length,with_output:analyzed,observations,missing:runners.length-analyzed,
      consumed:runners.filter(h=>h.ability_trace.consumed_items.includes(id)).length,
      context_read:runners.filter(h=>h.ability_trace.context_items_read.includes(id)).length}];
  }));
  return {circuit:input.circuit,target_date:input.targetDate,runners,coverage,scoring_authorized:false};
}
