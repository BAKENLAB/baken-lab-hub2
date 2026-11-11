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
  return {date:Number(parsedDate[1])+'/'+Number(parsedDate[2]),track,distance,
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
   let pair=text.match(/^(.+?)[、，]\s*(.+(?:反証|未検証|未実証|未確認|未知|不安|大敗|低調|不足).*)$/);
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
function headline(r,p,race){
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
   if(a.date===b.date&&a.track&&a.track===b.track&&a.distance&&
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
