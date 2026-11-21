/* LAB HUB: reason-first, evidence-grounded explanations. DISPLAY ONLY.
   This file never scores, writes a prediction, invents prior race evidence
   or changes the pre-race FROZEN order. */
(function(window){'use strict';
const venues=/(船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館)/;
function rawText(r){
 return String(r?.reason||r?.comment||r?.short_reason||'').trim();
}
function compact(s,limit=125){
 const x=String(s||'').replace(/\s+/g,' ').replace(/^[、。・\s]+|[、。・\s]+$/g,'').trim();
 return x.length>limit?x.slice(0,limit-1)+'…':x;
}
function plain(s){
 return compact(s,210)
  .replace(/同場同距離/g,'同じ競馬場・距離')
  .replace(/同距離同組/g,'同じ距離・クラス')
  .replace(/現級/g,'今回と同じクラス')
  .replace(/連対/g,'2着以内')
  .replace(/入着/g,'上位入線')
  .replace(/実走/g,'実績')
  .replace(/別条件材料/g,'別条件での実績')
  .replace(/未実証/g,'未確認')
  .replace(/級差推定/g,'クラス差の推測')
  .replace(/鮮度/g,'最近の実績')
  .replace(/反証/g,'不安材料')
  .replace(/^(?:ただし|一方で|しかし)[、，\s]*/,'');
}
function getRuns(r){
 const src=rawText(r);
 // Check the entire saved note, not just its first sentence. JRA also uses MM-DD.
 const dated=[...src.matchAll(/(?<![A-Za-z0-9])(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}(?!\d)/g)].slice(0,16);
 let previousVenue='',previousDistance=null;
 return dated.map((m,i)=>{
  const next=dated[i+1];
  const original=src.slice(m.index+m[0].length,next?.index??src.length);
  let part=original.split('。')[0],finish=part.match(/(\d{1,2})着|勝ち|(?<!未)勝利/);
  // The two dates explicitly share a finish in "9/23と8/26の園田...でともに3着".
  if(!finish&&next&&/^\s*と\s*$/.test(part)){
   const following=src.slice(next.index+next[0].length,dated[i+2]?.index??src.length).split('。')[0];
   if(/ともに\s*\d{1,2}着/.test(following)){
    part=following;finish=following.match(/(\d{1,2})着/);
   }
  }
  if(!finish)return null;
  const parsedDate=m[0].match(/(?:20\d{2}[-/])?(\d{1,2})[-/](\d{1,2})$/);
  if(!parsedDate)return null;
  const place=part.match(venues);
  const track=place?.[1]||(/^\s*(?:同|の)/.test(part)?previousVenue:'');
  if(place)previousVenue=place[1];
  const dm=part.match(/(\d{3,4})\s*m/);
  const distance=dm?Number(dm[1]):(/^\s*同/.test(part)?previousDistance:null);
  if(dm)previousDistance=Number(dm[1]);
  return {date:Number(parsedDate[1])+'/'+Number(parsedDate[2]),year:/^20\d{2}/.test(m[0])?Number(m[0].slice(0,4)):null,track,distance,
    finish:finish[1]?Number(finish[1]):1,raw:part};
 }).filter(Boolean);
}
function formatRun(r){
 return r.date+(r.track||'')+(r.distance?r.distance+'m':'')+
  '・'+r.finish+'着';
}
function evidence(r){
 const runs=getRuns(r);
 const podium=runs.filter(x=>x.finish<=3);
 const selected=(podium.length?podium:runs).slice(0,2);
 if(selected.length)return selected.map(formatRun).join('、');
 // No extracted date is not proof of no past performance.
 const raw=rawText(r);
 return raw?'保存コメントには具体的なレース結果の記載なし':'保存理由が未登録';
}
function dissect(r){
 const saved=rawText(r),runs=getRuns(r),strengths=[],risks=[];
 const dateAtStart=/^\s*(?:(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2})(?!\d)/;
 const riskWords=/反証|未実証|未検証|未確認|未知|不安|大敗|低調|苦戦|不振|失速|不足|休養|空白|初挑戦|初戦|実績なし|根拠は限定的|現在性が低い|過信しない|減点しすぎ|3着内なし|検証できない|確認できない|不明|順位は低い|リスク|課題/;
 const positiveWords=/評価|重視|好走|勝利|勝ち|連対|実績|証拠|材料|通用|強み|接近|安定|再浮上|巻き返し|上積み|適性|実走|末脚|先行力|水準|上位入線|入着|素地|優位|近接/;
 for(const sentence of saved.split('。').map(x=>x.trim()).filter(Boolean)){
  const cautionIntro=/^(?:ただし|一方で|一方|しかし)/.test(sentence);
  if(/^TOP5外\d+位$/.test(sentence))continue;
  // Date-led results are evidence, not an inferred interpretation of why a horse ranked.
  // Crucially, they must remain available as the fallback when no narrative follows.
  if(dateAtStart.test(sentence)){
   const riskOnly=sentence.split(/(?:だが|しかし|ものの|ただし)/)[0];
   const fields=riskOnly.split(/[、，]/);
   const firstBad=fields.find(x=>/(?:[4-9]|1[0-9])着/.test(x))||fields.find(x=>riskWords.test(x));
   if(riskWords.test(riskOnly)&&firstBad)risks.push(compact(firstBad));
   continue;
  }
  for(const clause of sentence.split(/(?:(?:は|を)(?:評価|重視)するが|ただし|一方で|一方|しかし|ものの|だが|したが|けれども)/g)){
   const text=compact(clause.replace(/^(?:そして|なお)[、，\s]*/,''));
   if(!text||(/^過去走は複数/.test(text)&&!/\d{1,2}着/.test(text)))continue;
   if(cautionIntro){risks.push(text);continue;}
   // Split at a true risk clause, not at every comma between race records.
   let pair=text.match(/^(.+?)[、，]\s*(.+(?:反証|未検証|未実証|未確認|未知|不安|大敗|低調|不足|課題).*)$/);
   if(pair&&!riskWords.test(pair[1])&&!/^\s*\d{1,2}[-/]\d{1,2}/.test(pair[1])){
    if(positiveWords.test(pair[1]))strengths.push(compact(pair[1]));
    risks.push(compact(pair[2]));continue;
   }
   if(riskWords.test(text))risks.push(text);
   else if(positiveWords.test(text))strengths.push(text);
  }
 }
 const podium=runs.filter(x=>x.finish<=3);
 let reason=strengths.find(x=>/評価|重視|証拠|実績|好走|連対|通用|勝利|勝ち|上積み/.test(x))||strengths[0]||'';
 if(!reason&&podium.length){
  reason=podium.slice(0,2).map(formatRun).join('、')+'の好走記録を根拠として確認';
 }
 if(!reason&&runs.length){
  reason=runs.slice(0,2).map(formatRun).join('、')+'の出走記録を参照（上位好走の証明は限定的）';
 }
 return {reason:plain(reason),risk:plain(risks[0]||'')};
}
// EYE must use the saved selection decision, not a fresh inference from finish positions.
function isSelectedEye(r,p){
 return !!p?.eye&&Number(p.eye.horse_no)===Number(r.horse_no)&&
  !(p?.top5||[]).some(x=>Number(x.horse_no)===Number(r.horse_no));
}
function eyeSelection(r,p){
 if(!isSelectedEye(r,p))return null;
 const n=Number(r.horse_no),a=p?.audit||{};
 const candidate=(Array.isArray(a.eye_candidate_audit)?a.eye_candidate_audit:[])
  .find(x=>Number(x.horse_no)===n&&x.eye_case===true);
 const group=(Array.isArray(a.eye_positive_factor_audit)?a.eye_positive_factor_audit:[])
  .find(x=>Number(x.horse_no)===n);
 const factors=[...new Set((Array.isArray(group?.positive_factors)?group.positive_factors:[])
  .filter(x=>x?.current_relevance===true&&typeof x.reason==='string'&&x.reason.trim())
  .map(x=>compact(x.reason,400)))];
 const saved=rawText(p.eye);
 if(factors.length){
  const lines=['【EYEに選んだ理由】'+factors.join('。')+'。'];
  if(candidate?.hidden_evidence)lines.push('【根拠となる過去走・材料】'+compact(candidate.hidden_evidence,400)+'。');
  if(candidate?.finish_path)lines.push('【今回の好走条件】'+compact(candidate.finish_path,350)+'。');
  if(candidate?.risk)lines.push('【不安・未確認】'+compact(candidate.risk,350)+'。');
  if(saved&&!candidate)lines.push('【保存された補足・原文】'+saved);
  return {head:factors.join('。'),detail:lines.join('\n')};
 }
 // Older payloads may contain only a separate saved EYE reason. Preserve it;
 // a date-leading class or weight change is not a mere historical result.
 const rr=(Array.isArray(p.runners)?p.runners:[]).find(x=>Number(x.horse_no)===n);
 const independent=saved&&rr&&saved!==rawText(rr);
 if(independent){
  const parts=saved.split('。').map(x=>x.trim()).filter(Boolean);
  const condition=parts.filter(x=>/(?:組替わり|組み替わり|相手緩和|条件好転|斤量軽減|kg(?:へ|に)?(?:\s*\d+kg)?軽減|kg減少|距離短縮|距離延長)/.test(x)&&
   !/未確認|未検証|根拠不足|不安|不明|逆効果|効果は限定|可能性なし/.test(x));
  const head=condition.length?condition.join('。'):'監査済みの肯定材料を表示できません。保存された選出理由の原文を確認';
  const lines=['【EYEに選んだ理由】'+head+'。'];
  const rest=parts.filter(x=>!condition.includes(x));
  if(rest.length)lines.push('【保存された補足・原文】'+rest.join('。')+'。');
  return {head,detail:lines.join('\n')};
 }
 // Legacy combined notes: retain the existing explicit rationale only. A
 // generic list of poor finishes is never a positive EYE selection reason.
 const legacy=saved?{...r,reason:saved}:r;
 const finding=dissect(legacy),runs=getRuns(legacy);
 if(!finding.reason||/出走記録を参照/.test(finding.reason)){
  const head='保存された肯定材料を判別できません。選出理由の原文を確認';
  const lines=['【EYEに選んだ理由】'+head+'。'];
  if(saved)lines.push('【保存理由の原文】'+saved);
  if(runs.length)lines.push('【参考過去走】'+runs.slice(0,2).map(formatRun).join('、')+'。');
  return {head,detail:lines.join('\n')};
 }
 return null; // existing narrative parser is retained for older explicit evidence notes
}


// Current whole-field audit notes have a stable, separately stored technical suffix.
// Never turn a race result or a missing-data notice into a selection rationale.
function modernSource(r,p){
 const full=(p?.runners||[]).find(x=>Number(x.horse_no)===Number(r.horse_no))||r;
 return rawText(full);
}
function modernAudit(raw){
 return /(?:個別不利・全ラップ|通過順・個別不利・全ラップ|全ラップ・対戦相手後続実績)/.test(raw);
}
function human(s){
 return String(s||'').trim().replace(/前走(\d+(?:\.\d+)?)kgから(\d+(?:\.\d+)?)kgへ(?:\d+(?:\.\d+)?kg)?軽減/g,'前走より斤量が軽くなる（$1→$2kg）')
 .replace(/(\d+(?:\.\d+)?)kgから(\d+(?:\.\d+)?)kgへ軽減/g,'斤量が軽くなる（$1→$2kg）')
 .replace(/同場/g,'同じ競馬場').replace(/現級/g,'今回と同じクラス').replace(/当地/g,'今回の競馬場')
 .replace(/湿馬場/g,'水分の多い馬場').replace(/再現性/g,'同じ走りができるか')
 .replace(/留保/g,'慎重に判断したい').replace(/反証/g,'不安材料')
 .replace(/組替わり/g,'組の変更').replace(/組強化/g,'相手強化')
 .replace(/(?:。|、|・|\s)+$/,'');
}
function sentence(s){return human(s).replace(/[。]+$/,'')+'。';}

/* The selected EYE's full runner note and its own audit are distinct sources.
   Never infer a positive past performance from a negative finish. */
function eyeHistory(r,p,candidate){
 const n=Number(r.horse_no);
 const runner=(Array.isArray(p?.runners)?p.runners:[]).find(x=>Number(x.horse_no)===n);
 const hidden=typeof candidate?.hidden_evidence==='string'?candidate.hidden_evidence.trim():'';
 const raw=rawText(runner);
 const past=raw.split(/(?:通過順・)?個別不利・全ラップ/)[0]
   .split('。').flatMap(s=>s.split(/、(?=(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}(?!\d))/))
   .map(s=>s.trim()).filter(s=>/^(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}(?!\d)/.test(s)&&/(?:\d{1,2}着|(?<!未)勝利|勝ち)/.test(s));
 // Explicit hidden evidence, when supplied, is the saved reason. Otherwise show
 // recorded history as reference only, without asserting that it justifies EYE.
 const match=hidden.match(/(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}(?!\d)/);
 if(match){
   const date=match[0].replace(/^20\d{2}[-/]/,'').replace(/-/g,'/');
   const witness=past.find(s=>s.replace(/^20\d{2}[-/]/,'').replace(/-/g,'/').startsWith(date)&&/(?:\d{1,2}着|(?<!未)勝利|勝ち)/.test(s));
   if(witness)return '根拠となる過去走：'+sentence(witness);
 }
 if(hidden&&match&&/(?:\d{1,2}着|(?<!未)勝利|勝ち|先着|上がり|通過順)/.test(hidden))return '根拠となる過去走：'+sentence(hidden);
 if(past.length)return '参考過去走：'+sentence(past.slice(0,2).join('、'))+'（選出との結び付きは未記載）';
 return '過去走の具体的な根拠は保存理由から確認できません。';
}
function auditedEyeNote(r,p){
 if(!isSelectedEye(r,p))return null;
 const a=p?.audit||{},n=Number(r.horse_no);
 const candidate=(Array.isArray(a.eye_candidate_audit)?a.eye_candidate_audit:[]).find(x=>Number(x.horse_no)===n&&x.eye_case===true);
 const group=(Array.isArray(a.eye_positive_factor_audit)?a.eye_positive_factor_audit:[]).find(x=>Number(x.horse_no)===n);
 const factors=(Array.isArray(group?.positive_factors)?group.positive_factors:[]).filter(x=>x?.current_relevance===true&&typeof x.reason==='string'&&x.reason.trim());
 const saved=rawText(p.eye),rr=(Array.isArray(p.runners)?p.runners:[]).find(x=>Number(x.horse_no)===n);
 if(!factors.length&&!(rr&&saved&&saved!==rawText(rr)))return null;
 // With absent audit, preserve the actual saved EYE text instead of re-parsing
 // a date-leading condition change into a finish or "summary failed."
 if(!modernAudit(rawText(rr)))return null;
 const head=factors.length?[...new Set(factors.map(x=>human(x.reason)))].join('。')+'。':saved;
 const lines=[head,eyeHistory(r,p,candidate)];
 if(candidate?.finish_path)lines.push('期待する走り：'+sentence(candidate.finish_path));
 if(candidate?.risk)lines.push('注意：'+sentence(candidate.risk));
 // A pair of condition changes is not proof of ability.
 if(factors.length&&factors.every(x=>['class_change','weight_change','jockey_change','going_change','track_change','distance_change','draw','layoff_preparation'].includes(x.category)))lines.push('条件の変化を評価した選出。能力の裏付けとは別に判断が必要。');
 return {head,detail:lines.join('\n')};
}

function modernNote(r,p){
 const raw=modernSource(r,p);
 if(!modernAudit(raw))return null;
 if(isSelectedEye(r,p)){
  const n=Number(r.horse_no),a=p?.audit||{};
  const cand=(a.eye_candidate_audit||[]).find(x=>Number(x.horse_no)===n&&x.eye_case===true);
  const group=(a.eye_positive_factor_audit||[]).find(x=>Number(x.horse_no)===n);
  const factors=(group?.positive_factors||[]).filter(x=>x?.current_relevance===true&&typeof x.reason==='string'&&x.reason.trim());
  if(!factors.length)return null;
  const texts=[...new Set(factors.map(x=>human(x.reason)))];
  const head=texts.map(x=>x.replace(/[。]+$/,'')).join('。')+'。';
  const lines=[head];
  if(cand?.finish_path)lines.push('期待する走り：'+sentence(cand.finish_path));
  if(cand?.risk)lines.push('注意：'+sentence(cand.risk));
  return {head,detail:lines.join('\n')};
 }
 // Keep only the original assessment before the common audit suffix.
 const body=raw.split(/(?:通過順・)?個別不利・全ラップ/)[0].trim();
 const clauses=body.split('。').map(x=>x.trim()).filter(Boolean);
 const last=clauses[clauses.length-1]||'';
 const riskPattern=/未確認|未取得|未経験|未検証|課題|不安|信頼度を抑|慎重|留保|根拠不足|根拠には不足|に注意|に懸念|に乏|実績なし|履歴なし|履歴がない/;
 const evaluation=/を(?:最上位に)?評価|を重視|を上位視|を最重要視|を優先|安定性|同距離安定|近況上昇|連勝|条件緩和|組の変更|組替わり|距離戻り/;
 const boundaries=last.split(/(?:するが|だが|も(?=[^、。]*(?:課題|不安|未確認|留保))|ただし|一方で|[、，])/).map(x=>x.trim()).filter(Boolean);
 // Prefer the author's explicit judgment. A result by itself is not a verdict.
 let reason=boundaries.filter(x=>evaluation.test(x)&&!riskPattern.test(x)&&!/^\d{1,2}[-/]\d{1,2}/.test(x)).pop()||'';
 if(!reason){
  reason=clauses.slice().reverse().find(x=>!/^(\d{1,2}[-/]\d{1,2})/.test(x)&&evaluation.test(x)&&!riskPattern.test(x))||'';
 }
 const risks=boundaries.filter(x=>riskPattern.test(x)&&!/^個別不利|^コース遷移/.test(x));
 const risk=risks.length?risks.join('、'):'';
 // If the author has not written a clear judgment, expose that fact instead of
 // manufacturing an upbeat explanation from a win or finish position.
 const head=reason?sentence(reason):'評価の決め手は原文で確認';
 let lines=[head];
 if(reason){
  const proof=body.replace(last,'').trim();
  const first=proof.split('。')[0]||'';
  // Copy at most two complete evidence clauses; no re-parsing of finish ranks.
  const evidence=first.split(/、(?=(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}(?!\d))/).slice(0,2).join('、').replace(/。$/,'');
  if(evidence&&evidence!==reason)lines.push('根拠：'+sentence(evidence));
  if(risk)lines.push('注意：'+sentence(risk));
 }else{
  lines.push('保存された評価理由：'+body);
 }
 return {head,detail:lines.join('\n')};
}


/*
 * LOCAL1.6 verified-comment presentation only.  The live FROZEN reason may
 * contain an evidence-led assessment followed by an identical run recap and
 * an unhelpful "no proof of a top-two" disclaimer.  Neither the displayed
 * rank nor the signed FROZEN payload is changed here.
 */
function verifiedLocalNote(r,p){
 if(isSelectedEye(r,p))return null;
 const source=modernSource(r,p);
 if(!/次走歴|次歴/.test(source))return null;
 const firstPart=source.split(/。(?=(?:直近公式実走|直近公式歴|直近)[\s:：])/)[0];
 if(firstPart===source)return null;
 const clauses=firstPart.split('。').map(x=>x.trim()).filter(Boolean);
 if(!clauses.length)return null;
 const isGenericNoProof=s=>/(?:連対|2着以内|上位3着内|3着内)(?:の)?(?:裏付け|実証|証拠)(?:は|が)?(?:ない|不足|未確認|未実証)|(?:3着内まだなし|上位好走の実証なし)/.test(s);
 const fact=human(clauses[0]);
 const judgment=clauses.slice(1)
  .map(s=>s.split(/(?:だが|するが|ただし|一方で|しかし|けれども)/)[0].trim())
  .find(s=>s.length>=12&&/(?:強み|を評価|を重視|を上位視|実績を評価|近況上昇|複数好走)/.test(s)
    &&!/未確認|未実証|不明|不安/.test(s))||'';
 const head=human(judgment||fact);
 const details=['【'+(Number(r.rank)>=1&&Number(r.rank)<=5?'この順位にした理由':'評価した理由')+'】'+sentence(head)];
 if(head!==fact)details.push('【根拠となる過去走】'+sentence(fact));
 const cautions=[];
 for(const clause of clauses.slice(1)){
  if(isGenericNoProof(clause))continue;
  const segments=clause.split(/(?:だが|するが|ただし|一方で|しかし|けれども)/);
  const risk=segments.length>1?segments.slice(1).join('、').trim():clause.trim();
  if(!/(?:不明|未検証|未確認|反証|懸念|課題|大敗|休養|不安|上位実績なし)/.test(risk))continue;
  if(isGenericNoProof(risk))continue;
  // No vague filler; keep an identifiable event, condition or concrete risk.
  if(!/(?:\d{1,2}[-/]\d{1,2}|\d+着|大井|金沢|中央|距離|馬場|相手|クラス|現級|休養|転入|斤量|上がり)/.test(risk))continue;
  const nice=human(risk);
  if(nice&&nice!==head&&!cautions.includes(nice))cautions.push(nice);
 }
 if(cautions.length)details.push('【注意点】'+sentence(cautions[0]));
 return {head,detail:details.join('\n')};
}


/* Display-only decision view for verified recent FROZEN. No re-scoring. */

/*
 * 2026-11-21: natural Japanese prose on the visible RANK card.
 * Strictly a display transformation of existing pre-race FROZEN evidence.
 * Never present a score gap or a historical finish as proof of factor weights.
 */

/*
 * Prose for all JRA evidence formats (turf AND dirt, maiden through feature).
 * Read-only view of the official pre-race FROZEN; never re-score the payload.
 * In particular a point gap is not evidence of individual factor contribution.
 */
function jraEvidenceProse(r,p,race){
 if(isSelectedEye(r,p))return null;
 const rank=Number(r?.rank),src=modernSource(r,p);
 if(!Number.isInteger(rank)||rank<1||!src)return null;
 if(p?.audit?.official_past_content_audit?.status==='VERIFIED_WHOLE_FIELD_FACTS')return null;
 const match=src.match(/今回[^。]{0,145}?(芝|ダート|ダ)(\d{3,4})\s*m(?:±(\d{2,3})m)?/);
 if(!match)return null; // Legacy documents use their own evidence reader.
 const targetSurface=match[1]==='芝'?'芝':'ダート',distance=Number(match[2]);
 const window=match[3]?Number(match[3]):300;
 const isTurf=x=>/芝(?:\d{3,4}m|\s)/.test(x.raw||'');
 const isDirt=x=>/ダート\d{3,4}m|ダ\d{3,4}m/.test(x.raw||'');
 const validSurface=x=>targetSurface==='芝'?isTurf(x):isDirt(x);
 const isComparable=x=>x.distance&&Math.abs(x.distance-distance)<=window&&validSurface(x);
 const monthDay=x=>{const parts=x.date.split('/').map(Number);return (x.year||2026)*10000+parts[0]*100+parts[1];};
 const all=getRuns({reason:src}).sort((a,b)=>monthDay(b)-monthDay(a));
 if(!all.length)return null;
 const relevant=all.filter(isComparable),recent=all[0],top3=relevant.filter(x=>x.finish<=3);
 const isSameCourse=x=>x&&x.track===race?.track&&x.distance===distance&&validSurface(x);
 const format=x=>x?(x.track||'競馬場未記録')+(isTurf(x)?'芝':isDirt(x)?'ダート':'')+
  (x.distance?x.distance+'m':'')+'で'+x.finish+'着':'';
 const cleanSentence=s=>String(s||'').trim().replace(/。+$/,'')+'。';
 const ranks=Array.isArray(p?.runners)?p.runners:[];
 const selectedPeer=ranks.find(x=>Number(x.rank)===(rank===1?2:rank===5?6:rank-1));
 const ownScore=Number(r.score),peerScore=Number(selectedPeer?.score);
 const scoreGap=Number.isFinite(ownScore)&&Number.isFinite(peerScore)&&selectedPeer?.score!=null&&r.score!=null?
  Math.abs(ownScore-peerScore):null;
 const ordinal=rank<=5?rank+'位':'全頭中'+rank+'位';
 let core='',detail='',caution='';
 if(top3.length>=2){
  core=format(top3[0])+'、'+format(top3[1])+'と、'+
   (targetSurface==='芝'?'芝':'ダート')+'の近い距離で複数の好走を記録している。';
  detail='こうした実績の重なりを評価し、'+ordinal+'に置いた。';
 }else if(top3.length===1){
  const best=top3[0];
  core=(best===recent?'前走は':'過去に')+format(best)+'と好走。';
  const prior=all[1];
  if(best===recent&&prior&&isSameCourse(best)&&isSameCourse(prior)&&prior.finish>=best.finish+2){
   detail='2走前の同条件'+prior.finish+'着から前走では'+best.finish+
    '着まで着順を上げており、この直近の良化を材料に'+ordinal+'とした。';
  }else if(isSameCourse(best)){
   detail='今回と同じ競馬場・距離で力を出したことを評価して'+ordinal+'とした。';
  }else{
   detail='今回に近い条件で好走したことを材料に'+ordinal+'とした。';
  }
 }else if(relevant.length){
  const sorted=[...relevant].sort((a,b)=>a.finish-b.finish);
  const best=sorted[0];
  core=(isSameCourse(best)?'今回と同じ'+(race?.track||'競馬場')+'の':'今回に近い')+
   (targetSurface==='芝'?'芝':'ダート')+distance+
   'mの条件で、これまでの最高着順は'+best.finish+'着。';
  const leadPosition=src.match(/(?:先行)?3番手以内([1-9]\d*)走/);
  detail=leadPosition?'前で運んだ走りは確認できるが、上位入線の実績はまだ足りず'+ordinal+'の評価とした。':
   '今回に近い条件で3着以内の裏付けがなく、慎重な'+ordinal+'評価としている。';
 }else{
  core='今回の'+(race?.track||'')+(targetSurface==='芝'?'芝':'ダート')+
   distance+'mに近い条件での好走は、保存走歴から確認できない。';
  detail=all.length?format(recent)+'などの出走歴はあるが、条件適性は未確認として'+ordinal+'とした。':
   '今回条件での能力を断定できないため、暫定的な'+ordinal+'となっている。';
 }
 if(recent&&recent.finish>=5&&!(top3.length&&top3[0]===recent)){
  caution='直近の'+format(recent)+'という結果は、不安材料として残る。';
 }else if(/前走からの間隔が短く反動は未確認/.test(src)){
  caution='前走からの間隔が短く、反動がないかは確認できていない。';
 }else if(/過去走は1走で再現性に留保|比較可能な実走は1走のみ|近傍の証拠1走/.test(src)){
  caution='比較に使える過去走が限られ、次も同じ走りができるかはまだ分からない。';
 }else if(recent&&!validSurface(recent)&&top3.length){
  caution='直近は別の馬場種別を走っており、今回の条件への適性には注意したい。';
 }
 let rival='';
 if(selectedPeer&&rank<=5){
  const peerRuns=getRuns({reason:rawText(selectedPeer)})
   .sort((a,b)=>monthDay(b)-monthDay(a));
  const peerBest=peerRuns.find(isComparable);
  const name=selectedPeer.horse_name||'隣の順位の馬';
  if(peerBest&&peerBest.finish<=3){
   rival=(rank===1?'2位':rank===5?'6位':(rank-1)+'位')+'の'+name+
    'にも'+format(peerBest)+'の実績がある。';
  }
  if(scoreGap!==null){
   rival+=(rival?' ':'')+'保存評価点では'+scoreGap+'点差'+
    (scoreGap<=4?'と僅差。':'だが、項目ごとの点差の内訳までは確認できない。');
  }
 }
 const head=core+' '+detail;
 const description=[head];
 if(caution)description.push(caution);
 if(rival)description.push(rival);
 return {head,detail:description.join('\n')};
}

function naturalRankProse(r,p,race){
 const raw=modernSource(r,p),rank=Number(r?.rank);
 if(!raw||!Number.isInteger(rank)||rank<1||isSelectedEye(r,p))return null;
 const audit=p?.audit||{};
 const local=audit.official_past_content_audit?.status==='VERIFIED_WHOLE_FIELD_FACTS';
 const match=raw.match(/芝(\d{3,4})m±(\d{2,3})mの実走\d+走/);
 const jra=!!match&&!local;
 if(!local&&!jra)return null;
 const sentenceEnd=s=>String(s||'').trim().replace(/[。]+$/,'')+'。';
 const scoreOf=x=>x?.score===null||x?.score===undefined?null:
  (Number.isFinite(Number(x.score))?Number(x.score):null);
 const displayRank=rank<=5?rank+'位':'全頭中'+rank+'位';
 const samePeer=(Array.isArray(p?.runners)?p.runners:[]).find(x=>
  Number(x.rank)===(rank===1?2:rank===5?6:rank-1));
 const gap=samePeer&&scoreOf(r)!==null&&scoreOf(samePeer)!==null?
  Math.abs(scoreOf(r)-scoreOf(samePeer)):null;
 const source=local?raw.split(/(?:直近3走|最近3走|過去3走|公式過去3走)\s*[：:]/)[0]:raw;
 const runs=getRuns({reason:source}).slice(0,9);
 const raceDistance=match?Number(match[1]):
  Number(String(source).match(/(?:高知|佐賀|名古屋|船橋|川崎|大井|園田|笠松|金沢|盛岡|水沢|門別)(?:ファイナル[^。]{0,30})?[^。]{0,40}?[ダ芝](\d{3,4})m/)?.[1]||0);
 function isComparable(t){
  if(raceDistance&&t.distance&&Math.abs(t.distance-raceDistance)>200)return false;
  return !jra||/芝/.test(t.raw||'');
 }
 function readableRun(x){
  if(!x)return '';
  const surface=/芝/.test(x.raw||'')?'芝':/ダート|ダ(?=\d)/.test(x.raw||'')?'ダート':'';
  const venue=x.track?x.track+'の':'';
  return venue+surface+(x.distance?x.distance+'m':'')+'で'+x.finish+'着';
 }
 const compatible=runs.filter(isComparable);
 const podium=compatible.filter(x=>x.finish<=3);
 const strongest=podium.slice(0,2);
 const chronology=[...runs].sort((a,b)=>{
  const score=x=>(x.year||2026)*372+Number(x.date.split('/')[0])*31+Number(x.date.split('/')[1]);
  return score(b)-score(a);
 });
 const latest=chronology[0];
 const pos=/通過\s*([1-3])\s+([1-3])/.test(source)||
  /(?:1角|序盤)[1-3]番手→(?:最終角|4角)[1-3]番手/.test(source);
 const gains=/複数レースで中盤の位置進出|位置を押し上げる再現性|\d+ポジション進出/.test(source);
 const stable=/連続好走|近2走連続|最近の.*(?:好走|連対)|近走で.*(?:安定|好走)/.test(source);
 let lead='';
 if(strongest.length>=2){
  lead=readableRun(strongest[0])+'、'+readableRun(strongest[1])+
   'と、'+(jra?'芝の短距離':'今回に近い条件')+'で好走した記録がある';
 }else if(strongest.length===1){
  lead=readableRun(strongest[0])+'しており、'+
   (jra?'今回の芝の短距離':'今回に近い条件')+'でも好走できた経験がある';
 }else if(compatible.length){
  const board=compatible.filter(x=>x.finish<=5).slice(0,2);
  if(board.length===2){
   lead=readableRun(board[0])+'、'+readableRun(board[1])+'と、今回に近い条件で掲示板には載っている';
  }else{
   const best=compatible.reduce((a,b)=>a.finish<=b.finish?a:b);
   lead=readableRun(best)+'が確認できる一方、今回に近い条件での3着以内は保存走歴から確認できない';
  }
 }else if(runs.length){
  lead=readableRun(runs[0])+'という走歴はあるが、今回と近い条件での好走実績は保存資料から確認できない';
 }else{
  return null; // Keep existing safe evidence view if the note cannot be parsed.
 }
 let strength='';
 if(gains)strength='道中で位置を上げる走りも重視し';
 else if(pos)strength='前で運んだ記録も踏まえ';
 else if(stable&&strongest.length)strength='最近の好調さを重視し';
 else if(strongest.length)strength='こうした実走内容を根拠に';
 else strength='勝ち切る裏付けが乏しい点も考慮し';
 const head=sentenceEnd(lead)+' '+sentenceEnd(strength+'、'+displayRank+'に置いた');
 let caution='';
 const riskSentence=source.split('。').map(x=>x.trim()).find(x=>
  /(?:ただし|一方|反証|課題|不安|大敗|未確認|未実証|休養|不安定|後着)/.test(x)&&
  !/^(?:高知|佐賀).*?全頭独立評価/.test(x));
 if(latest&&latest.finish>=5&&
   (!strongest.length||strongest[0]!==latest)){
   caution='ただし、直近の'+readableRun(latest)+'という結果は不安材料になる';
 }else if(/逃げ確定とはしない/.test(source)){
   caution='ただし、先頭で運んだ過去の走りが今回も再現するとは限らない';
 }else if(jra&&/ダート/.test(latest?.raw||'')&&podium.length){
   caution='ただし、芝に戻って同じ力を発揮できるかは確実ではない';
 }else if(riskSentence&&/(?:休養|転入|延長|初戦|未確認|不安定)/.test(riskSentence)){
   caution='ただし、'+riskSentence.replace(/^(?:ただし|一方)[、，\s]*/,'').replace(/[。]+$/,'');
 }
 const peerName=samePeer?.horse_name;
 let contrast='';
 if(rank<=5&&gap!==null&&peerName){
  const relation=rank===1?'2位':rank===5?'6位':(rank-1)+'位';
  const peerRaw=rawText(samePeer),peerRuns=getRuns({reason:peerRaw});
  const peerMatch=peerRuns.find(x=>x.finish<=3&&(!raceDistance||!x.distance||Math.abs(x.distance-raceDistance)<=200)&&(!jra||/芝/.test(x.raw||'')));
  if(gap<=4&&peerMatch){
   contrast=relation+'の'+peerName+'にも'+readableRun(peerMatch)+'の実績があり、評価点は'+gap+'点差と接近している';
  }else if(gap<=4){
   contrast=relation+'の'+peerName+'とは評価点で'+gap+'点差の僅差となっている';
  }else{
   contrast=relation+'の'+peerName+'との評価点差は'+gap+'点だが、項目別の点差の内訳までは保存されていない';
  }
 }
 const paragraphs=[head];
 if(caution)paragraphs.push(sentenceEnd(caution));
 if(contrast)paragraphs.push(sentenceEnd(contrast));
 // All source-derived limits remain available in the saved FROZEN; do not
 // silently rewrite the score or claim per-factor causal contributions.
 return {head,detail:paragraphs.join('\n')};
}

function decisionFirst(r,p){
 const rank=Number(r?.rank),src=modernSource(r,p),audit=p?.audit||{};
 if(!Number.isInteger(rank)||rank<1||!src||isSelectedEye(r,p))return null;
 const local=audit.official_past_content_audit?.status==='VERIFIED_WHOLE_FIELD_FACTS';
 const jra=!local&&/(?:基礎\d+点に|Eval1,942|Eval1942)/.test(src);
 if(!local&&!jra)return null;
 const marker=n=>({1:'◎',2:'○',3:'▲',4:'☆',5:'△'})[n]||'';
 const clean=s=>String(s||'').trim().replace(/現級/g,'今回のクラス').replace(/反証/g,'不安材料').replace(/。+$/,'');
 const cut=(s,n=100)=>compact(clean(s),n);
 const rows=Array.isArray(p?.runners)?p.runners:[];
 const peer=rows.find(x=>Number(x.rank)===(rank===1?2:rank===5?6:rank-1));
 const score=x=>x?.score===null||x?.score===undefined?null:
  Number.isFinite(Number(x.score))?Number(x.score):null;
 const ownScore=score(r),peerScore=score(peer);
 const compare=peer&&rank<=5&&ownScore!==null&&peerScore!==null?
  marker(rank)+rank+'位 '+ownScore+'点 ／ '+marker(Number(peer.rank))+
  Number(peer.rank)+'位 '+peerScore+'点（'+Math.abs(ownScore-peerScore)+'点差）':'';
 const body=local?src.split(/(?:公式過去3走|直近3走|最近3走|過去3走|近3走|公式過去走|近走3走|直近)\s*[：:]/)[0]:src;
 const parts=body.split('。').map(x=>x.trim()).filter(Boolean);
 const generic=s=>/^(?:高知|佐賀).*?(?:全頭独立評価|全頭独立能力評価|独立評価)$/.test(s);
 const recent=parts.filter(s=>!generic(s));
 const hasDate=s=>/(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}/.test(s);
 const evidence=recent.filter(s=>hasDate(s)&&/(?:\d{1,2}着|勝ち|先着|上がり|番手|差)/.test(s))
  .slice(0,1).map(s=>cut(s,90)).join('。');
 let why='';
 if(local){
  const recorded=rank===1?audit.honmei_review?.reason:rank===5?audit.boundary_review?.reason:'';
  const segments=String(recorded||'').split('。').map(s=>s.trim()).filter(Boolean);
  const final=segments.length?segments[segments.length-1]:'';
  if(final&&/(?:優先|評価|重視|上位|本命|現在性|再現性|比較|差)/.test(final))why=cut(final,116);
  if(!why){
   const judgment=recent.find(s=>!hasDate(s)&&/(?:重視|優先|評価|上位|現在性|再現性|強み|適性|安定|勝ち筋)/.test(s)&&
    !/(?:未確認の|推測加点しない|未検証の)/.test(s))||
    recent.find(s=>/(?:を重視|を優先|を評価|再現性が強い|上位とした|勝ち筋|首位材料|格の裏付け|位置進出|進出が確認できる|実証される)/.test(s));
   if(judgment){
    const natural=judgment.match(/(?:今回|近走|同距離|現級|現在性|再現性|先行|末脚|コーナー|中盤|位置進出)[^。]{9,}/);
    why=cut(natural?natural[0]:judgment,116);
   }
  }
 }else{
  const matched=src.match(/近距離\d+走・\d+(?:\.\d+)?秒以内\d+走/);
  why=matched?'近い距離での接戦実績を評価（'+matched[0]+'）':
   '現級・距離・着差・通過順の確認済み材料を評価';
 }
 if(!why){const first=recent.find(s=>hasDate(s)&&/(?:\d{1,2}着|勝ち|先着|上がり|番手)/.test(s));why=first?'保存理由の先頭に挙げられた実績：'+cut(first,96):'順位を決めた要因の内訳は保存理由だけでは特定できません';}
 const course=src.match(/(京都|東京|福島|中山|阪神|中京|新潟|小倉|札幌|函館)(?:同系|同場同距離)(\d+)走を確認/);
 const risk=local?recent.find(s=>/(?:ただし|一方|課題|不安|反証|未証明|休養|大敗|適性.*未確認)/.test(s)):
   course&&Number(course[2])===0?course[1]+'で照合できた同系コース走歴は0件':'';
 const lines=['【この順位の理由】'+clean(why)+'。'];
 if(compare)lines.push('【近い順位の馬と比較】'+compare+'。');
 if(evidence&&!clean(why).includes(evidence.slice(0,24)))lines.push('【実際の根拠】'+clean(evidence)+'。');
 if(risk&&cut(risk,92)!==why&&!why.includes(cut(risk,92)))lines.push('【注意点】'+clean(cut(risk,92))+'。');
 return {head:why,detail:lines.join('\n')};
}

function headline(r,p,race){
 const jraProse=jraEvidenceProse(r,p,race);if(jraProse)return jraProse.head;
 const natural=naturalRankProse(r,p,race);if(natural)return natural.head;
 const decision=decisionFirst(r,p);if(decision)return decision.head;
 const auditEye=auditedEyeNote(r,p);if(auditEye)return auditEye.head;
 const verified=verifiedLocalNote(r,p);if(verified)return verified.head;
 const modern=modernNote(r,p);if(modern)return modern.head;
 const eye=eyeSelection(r,p);if(eye)return compact(eye.head,400);
 const source=rawText(r);
 if(!source)return '上位評価の理由が保存されていません';
 const finding=dissect(r),runs=getRuns(r);
 const first=source.split('。')[0];
 if(/^\s*(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2}/.test(first)&&/を評価|として評価|を重視/.test(first)){
  return compact(plain(first),118);
 }
 if(/近\d+走.*(?:隔たり|比較的小さ|差が小さ)/.test(finding.reason)){
  const podium=runs.find(x=>x.finish<=3&&/C3三|C3-3/.test(x.raw));
  if(podium)return compact(podium.date+(podium.track||'')+(podium.distance?podium.distance+'m':'')+
   'C3三で'+podium.finish+'着の実績を重視。今回も同じ条件で巻き返しを期待',118);
 }
 const pair=source.match(/(\d{1,2}\/\d{1,2})と(\d{1,2}\/\d{1,2})の([^。]+?)でともに(\d{1,2})着/);
 if(pair&&/複数回|3着内実績|同じ条件|同条件/.test(finding.reason)){
  return compact(pair[1]+'・'+pair[2]+'の'+pair[3]+'でともに'+pair[4]+'着。今回もその実績を評価',118);
 }
 if(finding.reason){
  if(/実績水準|上位級|上級組|掲示板周辺|素地|証拠が2件/.test(finding.reason)&&runs.length>=2){
   return compact(runs.slice(0,2).map(formatRun).join('・')+'。'+finding.reason,118);
  }
  // For vague summaries, attach the race already documented in the frozen reason.
  // Do not override the explicit, more useful explanations with a generic date.
  const vague=/^(?:今回(?:の)?|同条件|同場|同距離|継続した|近走)(?:(?!\d{1,2}[-/]\d{1,2}).){0,85}(?:経験|材料|証拠|実績|評価|接戦|近接|通用)/;
  if(vague.test(finding.reason)&&
    !/(?:最重要視|特別編成|同一条件の勝利)/.test(finding.reason)&&runs.length){
   const one=runs.find(x=>x.finish<=3)||runs[0];
   return compact(formatRun(one)+'。'+finding.reason,118);
  }
  return compact(finding.reason,118);
 }
 return '評価理由の要約に失敗。詳細で保存済みの原文を確認';
}
function comment(r,p,race){
 const jraProse=jraEvidenceProse(r,p,race);if(jraProse)return jraProse.detail;
 const natural=naturalRankProse(r,p,race);if(natural)return natural.detail;
 const decision=decisionFirst(r,p);if(decision)return decision.detail;
 const auditEye=auditedEyeNote(r,p);if(auditEye)return auditEye.detail;
 const verified=verifiedLocalNote(r,p);if(verified)return verified.detail;
 const modern=modernNote(r,p);if(modern)return modern.detail;
 const eye=eyeSelection(r,p);if(eye)return eye.detail;
 if(!rawText(r))return '【評価理由】保存された評価理由がありません。';
 const isEye=!!p?.eye&&Number(p.eye.horse_no)===Number(r.horse_no)&&
   !(p?.top5||[]).some(x=>Number(x.horse_no)===Number(r.horse_no));
 const rank=Number(r.rank),finding=dissect(r),head=headline(r,p,race);
 const name=isEye?'EYEに選んだ理由':rank>=1&&rank<=5?'この順位にした理由':'評価した理由';
 const lines=['【'+name+'】'+head+'。','【根拠となる過去走】'+evidence(r)+'。'];
 const contrast=comparison(r,p,race);
 if(contrast)lines.push(contrast);
 if(finding.risk)lines.push('【不安・未確認】'+finding.risk+'。');
 // Preserve the full evidence source whenever interpretation is still incomplete.
 if(!finding.reason)lines.push('【保存理由の原文】'+compact(rawText(r),350)+'。');
 return lines.join('\n');
}
function formatComparableRun(run){
 // Class labels are copied only when explicitly present next to the saved result.
 // This prevents a C4-3 win being mistaken for a C4-2 win in rank comparisons.
 const raw=String(run.raw||'');
 const classMatch=raw.match(/(?:[ABC]\d{1,2}(?:[-－]\d{1,2}|[a-z]|[一二三四五六七八九十])?|C\d{1,2}(?:[-－]\d{1,2}|[一二三四五六七八九十])?|[123]勝(?:級|クラス)|未勝利|新馬|JpnI{1,3})/i);
 const label=classMatch?classMatch[0]:'';
 return run.date+(run.track||'')+(run.distance?run.distance+'m':'')+
  (label?label:'')+'・'+run.finish+'着';
}
function comparison(r,p,race){
 const ordered=(p?.top5||[]).filter(x=>Number(x.rank)>=1&&Number(x.rank)<=5)
  .sort((a,b)=>Number(a.rank)-Number(b.rank));
 if(ordered.length<2)return '';
 const rank=Number(r.rank);
 if(!Number.isInteger(rank)||rank<1||rank>5)return '';
 const current=ordered.find(x=>Number(x.horse_no)===Number(r.horse_no));
 const other=rank===1?ordered.find(x=>Number(x.rank)===2):ordered.find(x=>Number(x.rank)===rank-1);
 if(!current||!other||!rawText(current)||!rawText(other))return '';
 const runsOf=x=>getRuns(x);
 if(!runsOf(current).length||!runsOf(other).length)return '';
 const label=x=>(Number(x.rank)===1?'◎':Number(x.rank)===2?'○':
  Number(x.rank)===3?'▲':Number(x.rank)===4?'☆':'△')+
  (x.horse_name||String(x.horse_no||'?'));
 const relevant=x=>{
  const runs=runsOf(x),podium=runs.filter(q=>q.finish<=3);
  return (podium.length?podium:runs).slice(0,2).map(formatComparableRun).join('、');
 };
 // When the saved sources have matching date, track, distance, AND class,
 // compare those results before selectively showing each horse's best finish.
 // This is a condition match, not proof they were in the same numbered race.
 const cls=x=>{
  const m=String(x.raw||'').match(/(?:[ABC]\d{1,2}(?:[-－]\d{1,2}|[a-z]|[一二三四五六七八九十])?|C\d{1,2}(?:[-－]\d{1,2}|[一二三四五六七八九十])?|[123]勝(?:級|クラス)|未勝利|新馬|JpnI{1,3})/i);
  return m?m[0]:'';
 };
 const matches=[];
 for(const a of runsOf(current)){
  for(const b of runsOf(other)){
   if(a.date===b.date&&(!a.year||!b.year||a.year===b.year)&&a.track&&a.track===b.track&&a.distance&&
     a.distance===b.distance&&cls(a)&&cls(a)===cls(b)){
    matches.push({a,b});
   }
  }
 }
 if(matches.length){
  const same=matches[0];
  return '【近い順位の馬と同条件の記録を比較】'+
   label(current)+'：'+formatComparableRun(same.a)+' ／ '+
   label(other)+'：'+formatComparableRun(same.b)+
   '。保存された日付・競馬場・距離・クラスが一致する記録であり、同一レースの直接対戦や順位差の採点理由を断定するものではありません。';
 }
 return '【近い順位の馬と根拠を比較】'+label(current)+'：'+relevant(current)+
  ' ／ '+label(other)+'：'+relevant(other)+
  '。保存済みの実績を並べたもので、順位差の採点理由を断定するものではありません。';
}
function overview(p,race){
 const top=[...(p?.top5||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
 return top.slice(0,2).map((r,i)=>(i?'○':'◎')+r.horse_no+' '+(r.horse_name||'')+
  '｜'+headline(r,p,race)).join('\n');
}
window.LabRankCompare=Object.freeze({comment,overview,headline,comparison});
})(window);
