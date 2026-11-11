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
  let part=original.split('。')[0],finish=part.match(/(\d{1,2})着|勝ち|勝利/);
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
 return raw?'具体的な過去走の抽出に失敗。保存理由の原文を確認':'保存理由が未登録';
}
function dissect(r){
 const saved=rawText(r),runs=getRuns(r),strengths=[],risks=[];
 const dateAtStart=/^\s*(?:(?:20\d{2}[-/])?\d{1,2}[-/]\d{1,2})(?!\d)/;
 const riskWords=/反証|未実証|未検証|未確認|未知|不安|大敗|低調|苦戦|不振|失速|不足|休養|空白|初挑戦|初戦|実績なし|根拠は限定的|現在性が低い|過信しない|減点しすぎ/;
 const positiveWords=/評価|重視|好走|勝利|勝ち|連対|実績|証拠|材料|通用|強み|接近|安定|再浮上|巻き返し|上積み|適性|末脚|先行力|水準|上位入線|入着|素地|優位|近接/;
 for(const sentence of saved.split('。').map(x=>x.trim()).filter(Boolean)){
  if(/^TOP5外\d+位$/.test(sentence))continue;
  // Date-led results are evidence, not an inferred interpretation of why a horse ranked.
  // Crucially, they must remain available as the fallback when no narrative follows.
  if(dateAtStart.test(sentence)){
   const tail=sentence.split(/[、，]/).find(x=>riskWords.test(x));
   if(tail)risks.push(compact(tail));
   continue;
  }
  for(const clause of sentence.split(/(?:ただし|一方で|一方|しかし|ものの|だが|したが|けれども)/g)){
   const text=compact(clause.replace(/^(?:そして|なお)[、，\s]*/,''));
   if(!text)continue;
   // Split at a true risk clause, not at every comma between race records.
   let pair=text.match(/^(.+?)[、，]\s*(.+(?:反証|未検証|未実証|未確認|未知|不安|大敗|低調|不足).*)$/);
   if(pair&&!riskWords.test(pair[1])){
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
  reason=runs.slice(0,2).map(formatRun).join('、')+'の実走記録を参照（上位好走の証明は限定的）';
 }
 return {reason:plain(reason),risk:plain(risks[0]||'')};
}
function headline(r,p,race){
 if(!rawText(r))return '上位評価の理由が保存されていません';
 const finding=dissect(r);
 if(finding.reason)return compact(finding.reason,118);
 // Never imply missing records or reverse the sign of a caution as the ranking merit.
 return '保存理由から評価の要点を抽出できません。詳細で原文を確認';
}
function comment(r,p,race){
 if(!rawText(r))return '【評価理由】保存された評価理由がありません。';
 const isEye=!!p?.eye&&Number(p.eye.horse_no)===Number(r.horse_no)&&
   !(p?.top5||[]).some(x=>Number(x.horse_no)===Number(r.horse_no));
 const rank=Number(r.rank),finding=dissect(r),head=headline(r,p,race);
 const name=isEye?'EYEに選んだ理由':rank>=1&&rank<=5?'この順位にした理由':'評価した理由';
 const lines=['【'+name+'】'+head+'。','【根拠となる過去走】'+evidence(r)+'。'];
 if(finding.risk)lines.push('【不安・未確認】'+finding.risk+'。');
 // Preserve the full evidence source whenever interpretation is still incomplete.
 if(!finding.reason)lines.push('【保存理由の原文】'+compact(rawText(r),350)+'。');
 return lines.join('\n');
}
function overview(p,race){
 const top=[...(p?.top5||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
 return top.slice(0,2).map((r,i)=>(i?'○':'◎')+r.horse_no+' '+(r.horse_name||'')+
  '｜'+headline(r,p,race)).join('\n');
}
window.LabRankCompare=Object.freeze({comment,overview,headline});
})(window);
