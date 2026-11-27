import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=v=>JSON.stringify(v,Object.keys(v).sort());
const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const banned=/(odds|popularity|payout|target.?finish|target.?result|result_reference|predicted_market)/i;
const fail=c=>{throw Error(c)};

export function rawDocument({evidence_id,kind,event_id='SYN:H1',horse_id=null,observations,published_at='2026-11-28T00:05:00Z',updated_at='2026-11-28T00:06:00Z',captured_at='2026-11-28T00:10:00Z',row_pointer='rows[0]'}){
  const raw_bytes=Buffer.from(JSON.stringify({kind,event_id,horse_id,observations,published_at,updated_at}));
  return {evidence_id,kind,issuer:'SYNTHETIC',event_id,horse_id,row_pointer,format:'SYNTHETIC_JSON',published_at,updated_at,captured_at,raw_bytes,raw_sha256:sha(raw_bytes),observations};
}
export function validateDocument(d,{cutoff,targetEvent='SYN:T'}={}){
  for(const k of ['evidence_id','kind','issuer','event_id','row_pointer','published_at','updated_at','captured_at','raw_bytes','raw_sha256','observations']) if(d[k]===undefined||d[k]===null) fail('REQUIRED_'+k.toUpperCase());
  for(const k of ['published_at','updated_at','captured_at']) if(!iso.test(d[k])||!Number.isFinite(Date.parse(d[k]))) fail('INVALID_TIME');
  const t=[d.published_at,d.updated_at,d.captured_at,cutoff].filter(Boolean).map(Date.parse); for(let i=1;i<t.length;i++) if(t[i]<t[i-1]) fail('TIME_ORDER');
  if(!Buffer.isBuffer(d.raw_bytes)||sha(d.raw_bytes)!==d.raw_sha256) fail('RAW_HASH');
  if(d.kind==='HISTORICAL_RESULT'&&d.event_id===targetEvent) fail('TARGET_RESULT_LEAK');
  if(banned.test(JSON.stringify(d.observations))) fail('FORBIDDEN_FIELD');
  if(!/^rows\[\d+\](?:\.[a-z_]+)?$/.test(d.row_pointer)) fail('ROW_POINTER');
  return true;
}
export function validateRaceMath(result,laps,splits=[]){
  const rows=result.observations.rows; const finish=[...rows].sort((a,b)=>a.clock_ms-b.clock_ms).map(x=>x.horse_id);
  if(rows.some(r=>finish.indexOf(r.horse_id)+1!==r.finish)) fail('FINISH_CLOCK_ORDER');
  for(const r of rows){if(r.clock_ms-r.checkpoint_ms[1]!==r.final600_ms) fail('FINAL600_MISMATCH');}
  for(let j=0;j<3;j++){const rank=[...rows].sort((a,b)=>a.checkpoint_ms[j]-b.checkpoint_ms[j]).map(x=>x.horse_id); for(const r of rows) if(rank.indexOf(r.horse_id)+1!==r.checkpoint_ranks[j]) fail('CHECKPOINT_RANK');}
  if(laps.observations.values_ms.reduce((a,b)=>a+b,0)!==rows.find(r=>r.finish===1).clock_ms) fail('LAP_SUM');
  for(const s of splits){const r=rows.find(x=>x.horse_id===s.horse_id); if(!r||s.observations.values_ms.reduce((a,b)=>a+b,0)!==r.clock_ms) fail('SPLIT_SUM');}
  return true;
}
export function makeValidRace(id='H1',peerHorses=['SYN:H1','SYN:H2','SYN:H3','SYN:H4','SYN:H5']){
  const clocks=[85000,85300,85600,85900,86200], cp0=[12000,11600,12400,11800,12200], cp1=[47000,46600,47500,46900,47200];
  const rows=peerHorses.map((horse_id,i)=>({horse_id,horse_no:i+1,status:'FINISHED',finish:i+1,clock_ms:clocks[i],final600_ms:clocks[i]-cp1[i],checkpoint_ms:[cp0[i],cp1[i],73000+i*200]}));
  for(let j=0;j<3;j++){const order=[...rows].sort((a,b)=>a.checkpoint_ms[j]-b.checkpoint_ms[j]); for(const r of rows)(r.checkpoint_ranks??=[])[j]=order.indexOf(r)+1;}
  const result=rawDocument({evidence_id:`E:${id}`,kind:'HISTORICAL_RESULT',event_id:`SYN:${id}`,observations:{distance_m:1400,going:'GOOD',rows}});
  const laps=rawDocument({evidence_id:`E:LAPS:${id}`,kind:'RACE_LAPS',event_id:`SYN:${id}`,observations:{scope:'RACE_LEADER',boundaries_m:[0,200,800,1200,1400],values_ms:[11600,35000,25000,13400]}});
  const splitRows=rows.map(r=>rawDocument({evidence_id:`E:SPLIT:${id}:${r.horse_id}`,kind:'INDIVIDUAL_SPLITS',event_id:`SYN:${id}`,horse_id:r.horse_id,observations:{scope:'INDIVIDUAL',values_ms:[r.checkpoint_ms[0],r.checkpoint_ms[1]-r.checkpoint_ms[0],r.clock_ms-r.checkpoint_ms[1]]}}));
  return {result,laps,splits:splitRows};
}
export function malformedWork40(){const x=makeValidRace('BAD'); x.result.observations.rows[0].final600_ms=38400; x.result.observations.rows[0].finish=3; x.result.observations.rows[2].finish=1; return x;}

export const EYE_NAMES=['着順と着差のギャップ','着順と過去走内容のギャップ','道中後退からの巻き返し','強い相手との僅差敗戦','対戦相手の後続実績','前走の展開不利の解消','得意距離・条件への復帰','コース変更による適性向上','先行馬占有率による恩恵','逃げハサミによる恩恵','同型馬の減少','想定隊列による位置取り改善','着順に表れていない能力上昇','転入・クラス変更による相手弱化','複数の条件好転の組み合わせ'];
export function makeEye15(){return EYE_NAMES.map((name,i)=>{const id=String(i+1).padStart(2,'0'); const facts={category:`EYE-${id}`,name,horse_id:'SYN:H1',support:{event_id:`SYN:E${id}A`,fact:`${name}を支持する観測事実`,metrics:{position_before:8,position_after:3,margin_ms:300+i*10}},counter:{event_id:`SYN:E${id}B`,fact:`${name}に反する観測事実`,metrics:{position_before:3,position_after:8,margin_ms:900+i*10}},irrelevant:{event_id:`SYN:E${id}C`,fact:'別馬の別条件で当該馬の判定根拠にならない'},duplicate_of:i===14?'EYE-07':null}; return rawDocument({evidence_id:`E:EYE:${id}`,kind:'INCIDENT_REPORT',event_id:facts.support.event_id,horse_id:'SYN:H1',observations:facts});});}

function deepAudit(v,path='analysis',out=[]){if(Array.isArray(v)){v.forEach((x,i)=>deepAudit(x,`${path}[${i}]`,out));return out;} if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(banned.test(k))out.push(`${path}.${k}`);deepAudit(x,`${path}.${k}`,out);} return out;}
export function buildAnalysis({target,documents,cutoff,roster}){
  if(Date.parse(cutoff)>Date.parse(target.scheduled_post)) fail('CUTOFF_AFTER_POST');
  const ids=new Set; for(const d of documents){validateDocument(d,{cutoff,targetEvent:target.event_id}); if(ids.has(d.evidence_id))fail('DUPLICATE_EVIDENCE'); ids.add(d.evidence_id);}
  const analysis={schema:'REBORN2_ANALYSIS_ENVELOPE_0.2',target,cutoff,roster,documents:documents.map(d=>({evidence_id:d.evidence_id,kind:d.kind,event_id:d.event_id,horse_id:d.horse_id,row_pointer:d.row_pointer,raw_sha256:d.raw_sha256,observations:d.observations})),formal:false,scoring_authorized:false};
  const leaks=deepAudit(analysis); if(leaks.length)fail('ANALYSIS_LEAK');
  const bytes=Buffer.from(JSON.stringify(analysis)); return {analysis,analysis_bytes:bytes,analysis_sha256:sha(bytes)};
}
export function sealResults({target_event_id,documents}){const artifact={schema:'REBORN2_RESULT_SEAL_0.2',target_event_id,documents}; const bytes=Buffer.from(JSON.stringify(artifact)); return {artifact,result_bytes:bytes,result_sha256:sha(bytes)};}
export function deterministicAdapter(envelope){return {analysis_sha256:envelope.analysis_sha256,roster_sha256:sha(Buffer.from(JSON.stringify(envelope.analysis.roster))),evidence_count:envelope.analysis.documents.length,eye_categories:envelope.analysis.documents.filter(d=>d.kind==='INCIDENT_REPORT').map(d=>d.observations.category).sort()};}
export function compareHistoricalPeers(a,b){return {target_roster_fixed:JSON.stringify(a.targetRoster)===JSON.stringify(b.targetRoster),historical_peer_changed:JSON.stringify(a.historicalPeers)!==JSON.stringify(b.historicalPeers)};}
