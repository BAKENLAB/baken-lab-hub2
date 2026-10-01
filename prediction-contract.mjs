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
  'JRA_REBUILD_0.3_FLAT_HISTORY': Object.freeze({eyeFields:['reason'], legacy:false, top5OptionalGrade:true}),
  // Existing API adapter for chappy_predictions, separate from official protocols.
  CHAT_PRE_RACE_LEGACY: Object.freeze({eyeFields:['reason','comment'], legacy:true})
});
export function protocolPolicy(version) {
  const policy=Object.hasOwn(PROTOCOLS,version) ? PROTOCOLS[version] : null;
  if (!policy) fail('unsupported protocol_version: '+String(version));
  return policy;
}
export function isTestPrediction(row) {
  return PROTOCOLS[row?.protocol_version]?.excluded === true || row?.is_test === true || [row?.protocol_version,row?.source].some(v=>/(^|[_-])(TEST|SMOKE|FIXTURE)([_-]|$)/i.test(String(v??'')));
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
  const row = r => {
    if (!r || typeof r !== 'object' || !Number.isInteger(r.horse_no) || typeof r.horse_name !== 'string' || !r.horse_name.trim() || (!(policy.cancelledNullRank && r.status === 'CANCELLED' && r.rank === null) && (!Number.isInteger(r.rank) || r.rank < 1)) || typeof r.grade !== 'string' || !r.grade) fail('invalid saved runner');
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
  const predictions = new Map();
  for (const raw of data.predictions) {
    if (isTestPrediction(raw)) continue;
    const k=raceKey(raw);
    let p=raw;
    try {
      if (raw.race_date !== date || predictions.has(k)) fail('duplicate/wrong-date prediction');
      validatePrediction(raw);
    } catch(e) {p=dataErrorPrediction(raw,e);}
    predictions.set(k,p);
  }
  const seen = new Set();
  const races = data.races.map(r => {
    const k=raceKey(r);seen.add(k);
    const p=predictions.get(k);
    try {
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
  return {races,predictions:[...predictions.values()]};
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
