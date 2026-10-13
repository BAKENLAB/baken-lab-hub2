// Transport validation only. Never selects or reorders horses.
const fail = message => { throw new Error('DATA ERROR: ' + message); };
// Explicit supported storage protocols; unknown versions never enter an adapter.
export const PROTOCOLS = Object.freeze({
  BAKEN_LAB_STANDARD_7_KEYS: Object.freeze({eyeFields:['comment'], legacy:false, top5OptionalRank:true, top5OptionalGrade:true}),
  BAKEN_LAB_WORK_TEST_V3: Object.freeze({excluded:true, eyeFields:[], legacy:false}),
  CHAPPY_DIRECT_1: Object.freeze({eyeFields:['reason','comment'], legacy:false, top5OptionalRank:true, top5OptionalGrade:true, cancelledNullRank:true}),
  'CHAPPY_LOCAL_1.1_20260926': Object.freeze({eyeFields:['reason'], legacy:false, requireEye:true}),
  'CHAPPY_LOCAL_1.2_EYE_GUARD_20260929': Object.freeze({eyeFields:['reason'], legacy:false}),
  'CHAPPY_LOCAL_1.3_EXECUTION_GUARD_20260930': Object.freeze({eyeFields:['reason'], legacy:false}),
  'CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930': Object.freeze({eyeFields:['reason'], legacy:false}),
  'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004': Object.freeze({eyeFields:['reason'], legacy:false, allowOneUnratedNoHistory:true}),
  'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013': Object.freeze({eyeFields:['reason'], legacy:false, allowOneUnratedNoHistory:true}),
  'JRA_REBUILD_0.3_FLAT_HISTORY': Object.freeze({eyeFields:['reason'], legacy:false, top5OptionalGrade:true}),
  'JRA_REBUILD_0.3_FLAT_HISTORY_20261004': Object.freeze({eyeFields:['reason'], legacy:false, top5OptionalGrade:true, runnerOptionalGrade:true}),
  'JRA_REBUILD_0.3_FLAT_HISTORY_EYE_ALLCLASS_20261004': Object.freeze({eyeFields:['concrete_upside_reason','reason'], legacy:false, top5OptionalGrade:true, runnerOptionalGrade:true}),
  // Existing API adapter for chappy_predictions, separate from official protocols.
  CHAT_PRE_RACE_LEGACY: Object.freeze({eyeFields:['reason','comment'], legacy:true})
});
export function protocolPolicy(version) {
  const policy=Object.hasOwn(PROTOCOLS,version) ? PROTOCOLS[version] : null;
  if (!policy) fail('unsupported protocol_version: '+String(version));
  return policy;
}
export function isTestPrediction(row) {
  return row?.protocol_version === 'BAKEN_LAB_WORK_TEST_V3';
}
export function eyeReason(eye, version) {
  const policy=protocolPolicy(version);
  if (policy.excluded) fail('test prediction excluded');
  if (eye === null) {
    return null;
  }
  if (!eye || typeof eye !== 'object' || Array.isArray(eye)) fail('invalid EYE');
  for (const field of policy.eyeFields) {
    const value=eye[field];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || !value.trim()) fail('invalid EYE '+field);
    return value;
  }
  fail('EYE-specific reason missing');
}
export function dataErrorPrediction(row, error) {
  return {id:row?.id,race_date:row?.race_date,track:row?.track,race_no:row?.race_no,circuit:row?.circuit,
    protocol_version:row?.protocol_version,prediction_state:'DATA_ERROR',
    data_error:String(error?.message??error),payload:null};
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function validatePayload(p, legacy = false, version = 'CHAPPY_DIRECT_1') {
  const policy=protocolPolicy(version);
  if (policy.excluded) fail('test prediction excluded');
  if (legacy !== policy.legacy) fail('protocol/storage mismatch');
  if (!p || typeof p !== 'object' || !Array.isArray(p.runners) || !Array.isArray(p.top5)) fail('runners/top5 must be arrays');
  if (!legacy && (!p.runners.length || !p.top5.length)) fail('empty runners/TOP5 in saved prediction');
  // Partial LOCAL 1.5 is a version-specific, fail-closed exception for one
  // genuinely unverified horse. Saved ability scores and top-five are immutable.
  const partial = policy.allowOneUnratedNoHistory === true && p.audit?.partial_coverage === true;
  if (partial) {
    const audit=p.audit;
    const active=p.runners.filter(r=>r?.status!=='CANCELLED'&&r?.status!=='EXCLUDED');
    const unknown=active.filter(r=>r?.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY');
    const rated=active.filter(r=>r?.evaluation_status!=='UNRATED_NO_VERIFIED_HISTORY');
    if (unknown.length!==1 || rated.length<5
      || !Array.isArray(audit.unrated_runner_nos) || audit.unrated_runner_nos.length!==1
      || audit.unrated_runner_nos[0]!==unknown[0].horse_no
      || audit.ability_coverage?.total_count!==active.length
      || audit.ability_coverage?.rated_count!==rated.length
      || typeof audit.ability_coverage?.warning!=='string'
      || !audit.ability_coverage.warning.includes('未評価')
      || audit.market_used_for_ranking!==false || audit.market_used_for_eye!==false
      || p.eye!==null
      || typeof audit.eye_abstention_reason!=='string'
      || !audit.eye_abstention_reason.includes('履歴'))
      fail('invalid partial coverage declaration');
    const missing=unknown[0].missing_items;
    const witness=Array.isArray(audit.runner_evidence_audit)
      ?audit.runner_evidence_audit.find(e=>e?.horse_no===unknown[0].horse_no):null;
    if(unknown[0].rank!==null || unknown[0].grade!==null
      || !Array.isArray(missing) || !missing.includes('verified_history')
      || typeof unknown[0].reason!=='string' || !unknown[0].reason.trim()
      || !witness || witness.recent_runs_checked!==0
      || !Array.isArray(witness.missing_items)
      || !witness.missing_items.includes('verified_history'))
      fail('invalid partial unrated runner evidence');
    const ranks=rated.map(r=>r?.rank).sort((a,b)=>a-b);
    if(ranks.some((rank,i)=>rank!==i+1)
      || rated.some(r=>r?.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY'
        || !/^[SABCDEF]$/.test(r?.grade??'') || typeof r?.reason!=='string' || !r.reason.trim()))
      fail('invalid partial rated runner');
    if(p.top5.length!==5
      || !p.top5.every(r=>rated.some(v=>v.horse_no===r.horse_no && v.rank===r.rank && v.grade===r.grade && r.rank<=5)))
      fail('partial top5 mismatch');
  }
  const row = r => {
    if (partial && r?.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY' && r?.status!=='CANCELLED' && r?.status!=='EXCLUDED') {
      if(!Number.isInteger(r.horse_no) || typeof r.horse_name!=='string' || !r.horse_name.trim() || r.rank!==null || r.grade!==null)
        fail('invalid partial unrated runner');
      return;
    }
    if (!r || typeof r !== 'object' || !Number.isInteger(r.horse_no) || typeof r.horse_name !== 'string' || !r.horse_name.trim() || (!(policy.cancelledNullRank && r.status === 'CANCELLED' && r.rank === null) && (!Number.isInteger(r.rank) || r.rank < 1)) || (!policy.runnerOptionalGrade && (typeof r.grade !== 'string' || !r.grade))) fail('invalid saved runner');
  };
  if (!legacy) {
    p.runners.forEach(row);
    p.top5.forEach(r=>{
      if (!r || typeof r !== 'object' || Array.isArray(r) || !Number.isInteger(r.horse_no) || typeof r.horse_name !== 'string' || !r.horse_name.trim()) fail('invalid saved TOP5');
      if ((!policy.top5OptionalRank || Object.hasOwn(r,'rank')) && (!Number.isInteger(r.rank) || r.rank < 1)) fail('invalid saved TOP5 rank');
      if ((!policy.top5OptionalGrade || Object.hasOwn(r,'grade')) && (typeof r.grade !== 'string' || !r.grade)) fail('invalid saved TOP5 grade');
      if (policy.top5OptionalRank && !Object.hasOwn(r,'rank') && (typeof r.mark !== 'string' || !r.mark.trim())) fail('saved TOP5 mark missing');
    });
    if (new Set(p.runners.map(r => r.horse_no)).size !== p.runners.length) fail('duplicate horse_no');
    const numbers = new Set(p.runners.map(r => r.horse_no));
    if (p.top5.some(r => !numbers.has(r.horse_no))) fail('TOP5 horse missing from runners');
  } else {
    // Historical picks may omit rank/grade; never infer either.
    p.runners.forEach(row);
    p.top5.forEach(r=>{
      if (!r || typeof r !== 'object' || Array.isArray(r) || !Number.isInteger(r.horse_no) || typeof r.horse_name !== 'string' || !r.horse_name.trim()) fail('invalid legacy TOP5');
      if (Object.hasOwn(r,'rank') && (!Number.isInteger(r.rank) || r.rank < 1)) fail('invalid legacy rank');
      if (Object.hasOwn(r,'grade') && (typeof r.grade !== 'string' || !r.grade)) fail('invalid legacy grade');
    });
  }
  if (!Object.hasOwn(p, 'eye')) fail('eye field missing');
  if (p.eye === null && policy.requireEye && p.runners.length > 5) fail('EYE missing for '+version);
  if (p.eye !== null) {
    if (!p.eye || Array.isArray(p.eye) || typeof p.eye !== 'object' || !Number.isInteger(p.eye.horse_no) || typeof p.eye.horse_name !== 'string' || !p.eye.horse_name.trim()) fail('invalid EYE');
    eyeReason(p.eye,version);
    if (!legacy && !p.runners.some(r => r.horse_no === p.eye.horse_no)) fail('EYE horse missing from runners');
  }
  return p;
}
export function predictionSnapshot(p) {
  return {
    runners: p.runners.map(r => ({horse_no:r.horse_no, horse_name:r.horse_name, rank:r.rank, grade:r.grade})),
    top5: structuredClone(p.top5),
    eye: structuredClone(p.eye)
  };
}
export function assertPredictionMatch(saved, displayed) {
  if (canonical(predictionSnapshot(saved)) !== canonical(predictionSnapshot(displayed))) fail('saved prediction differs from API/display');
}
export function validatePrediction(p) {
  if (!p || typeof p.id !== 'string' || !p.id) fail('prediction ID missing');
  if (isTestPrediction(p)) fail('test prediction excluded');
  const policy=protocolPolicy(p.protocol_version);
  validatePayload(p.payload, policy.legacy, p.protocol_version);
  if (!p.integrity || p.integrity.version !== 1 || p.integrity.prediction_id !== p.id) fail('prediction integrity evidence missing');
  if (canonical(p.integrity.saved) !== canonical(predictionSnapshot(p.payload))) fail('prediction integrity mismatch');
  return p;
}
export function raceKey(r) {
  if (!r || typeof r.race_date !== 'string' || typeof r.track !== 'string' || !r.track || !Number.isInteger(r.race_no) || !['LOCAL','JRA'].includes(r.circuit)) fail('invalid race identity');
  return [r.race_date,r.track,r.race_no,r.circuit].join('|');
}
export function reconcileToday(data, date) {
  if (!data || data.date !== date || !Array.isArray(data.races) || !Array.isArray(data.predictions)) fail('invalid list response');
  const predictions = new Map(), invalidPredictions = [];
  for (const raw of data.predictions) {
    if (isTestPrediction(raw)) continue;
    let k, p=raw;
    try {
      k=raceKey(raw);
      if (raw.race_date !== date || predictions.has(k)) fail('duplicate/wrong-date prediction');
      validatePrediction(raw);
    } catch(e) {p=dataErrorPrediction(raw,e);}
    if (k === undefined) invalidPredictions.push(p);
    else predictions.set(k,p);
  }
  const seen = new Set(), attachedInvalid = new Set();
  const races = data.races.map(r => {
    if (r?.prediction?.id) {
      for (const p of invalidPredictions) if (p.id === r.prediction.id) attachedInvalid.add(p);
    }
    try {
      const k=raceKey(r);seen.add(k);
      const p=predictions.get(k);
      if (r.race_date !== date || r.key !== k) fail('wrong-date race');
      if (r.data_error || p?.data_error) fail(r.data_error || p.data_error);
      if (r.prediction != null) {
        validatePrediction(r.prediction);
        if (raceKey(r.prediction) !== k || !p || p.id !== r.prediction.id) fail('race prediction identity mismatch');
        assertPredictionMatch(p.payload,r.prediction.payload);
      }
      if (!p && r.prediction_status === 'FROZEN') fail('FROZEN prediction missing');
      return p ? {...r,prediction:p,prediction_status:'FROZEN'} : r;
    } catch(e) {return {...r,prediction:null,prediction_status:'DATA_ERROR',data_error:String(e.message)};}
  });
  for (const [k,p] of predictions) if (!seen.has(k)) races.push({...p,key:k,prediction:p.data_error?null:p,prediction_status:p.data_error?'DATA_ERROR':'FROZEN',market_status:p.market_captured_at?'READY':'PENDING'});
  for (const p of invalidPredictions) if (!attachedInvalid.has(p)) races.push({...p,prediction:null,prediction_status:'DATA_ERROR'});
  return {races,predictions:[...predictions.values(),...invalidPredictions]};
}
export function validateResults(data, date) {
  if (!data || data.date !== date || !Array.isArray(data.results)) fail('invalid results response');
  const seen=new Set();
  return data.results.map(r=>{
    try {
      const k=raceKey(r);
      if (r.race_date !== date || seen.has(k) || !r.result || typeof r.result !== 'object' || Array.isArray(r.result)) fail('invalid result row');
      seen.add(k);
      if (r.data_error || r.prediction_state === 'DATA_ERROR') fail(r.data_error || 'invalid prediction');
      if (r.prediction == null) {
        if (r.prediction_state !== 'NOT_FOUND') fail('prediction availability unknown');
      } else {
        validatePrediction(r.prediction);
        if (raceKey(r.prediction) !== k || r.prediction_state !== 'FOUND') fail('result prediction mismatch');
      }
      return r;
    } catch(e) {return {...r,prediction:null,prediction_state:'DATA_ERROR',data_error:String(e.message)};}
  });
}
export function latestRequest() {
  let serial=0;
  return () => {const id=++serial; return () => id===serial;};
}
