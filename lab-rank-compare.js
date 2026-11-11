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
 const head=rawText(r).split('。')[0]||'';
 const dates=[...head.matchAll(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}/g)].slice(0,8);
 let previousVenue='',previousDistance=null;
 return dates.map((m,i)=>{
  const section=head.slice(m.index,dates[i+1]?.index??head.length);
  const dm=m[0].match(/(?:20\d{2}[-/])?(\d{1,2})[-/](\d{1,2})$/);
  let part=section.slice(m[0].length);
  let place=part.match(/(\d{1,2})着|勝ち|勝利/);
  if(!dm)return null;
  // Official note sometimes says "9/23と8/26の園田C3三でともに3着".
  // Two independent results are stated explicitly in that wording.
  if(!place&&dates[i+1]&&/^\s*と\s*$/.test(part)){
   const next=head.slice(dates[i+1].index+dates[i+1][0].length,
     dates[i+2]?.index??head.length);
   if(/ともに\s*\d{1,2}着/.test(next)){part=next;place=next.match(/(\d{1,2})着/);}
  }
  if(!place)return null;
  const venue=part.match(venues);
  const same=/^\s*同/.test(part);
  const track=venue?.[1]||(same?previousVenue:'');
  if(venue)previousVenue=venue[1];
  const distance=part.match(/(\d{3,4})\s*m/);
  const parsedDistance=distance?Number(distance[1]):same?previousDistance:null;
  if(distance)previousDistance=Number(distance[1]);
  const finish=place[1]?Number(place[1]):1;
  return {date:Number(dm[1])+'/'+Number(dm[2]),track,
   distance:parsedDistance,finish,raw:section};
 }).filter(Boolean);
}
function formatRun(r){
 return r.date+(r.track||'')+(r.distance?r.distance+'m':'')+
  '・'+r.finish+'着';
}
function evidence(r){
 const rows=getRuns(r);
 const good=rows.filter(x=>x.finish<=3);
 const selected=good.length?good.slice(0,2):rows.slice(0,2);
 if(selected.length)return selected.map(formatRun).join('、');
 const head=rawText(r).split('。')[0]||'';
 // Parser uncertainty must not be misrepresented as missing official history.
 return head&&/\d{1,2}\/\d{1,2}|20\d{2}-\d{2}-\d{2}/.test(head)?
   compact(head,100):'保存コメントには具体的なレース結果の記載なし';
}
function dissect(r){
 const text=rawText(r);
 const sentences=text.split('。').map(x=>x.trim()).filter(Boolean);
 // A date-led first sentence can ALSO contain the evaluation itself.
 // e.g. "7/29園田C3二2着を評価。" Never discard that conclusion.
 const firstIsHistoryOnly=sentences.length>1&&
   /\d{1,2}\/\d{1,2}|20\d{2}-\d{2}-\d{2}/.test(sentences[0])&&
   !/(?:評価|重視|期待|上位候補|根拠|材料|好走を証明|力を示す)/.test(sentences[0]);
 const analysis=firstIsHistoryOnly?sentences.slice(1):sentences;
 const strengths=[],cautions=[];
 const addGood=s=>{const t=compact(s);if(t)strengths.push(t)};
 const addRisk=s=>{const t=compact(s);if(t)cautions.push(t)};
 for(const s of analysis){
  if(/^未取得|^推測で補わない|^推測加点しない/.test(s))continue;
  // A caution-only sentence must not promote its opening half to a strength.
  if(/^(?:直近|前走|休み明け).*?(?:なし|不安|反証|未実証)|^近走.*?なし|^ただし/.test(s)){
    addRisk(s);continue;
  }
  // Separate a witnessed ability claim from its counter-evidence.
  // Previous versions misclassified the *whole sentence* as a risk:
  // "上級組で2着・3着の証拠あり、中央大敗は反証"
  // and "上級組への水準は実証したが直近3走が大敗".
  let contrast=s.match(/^(.+?)(?:したが|だが|ものの)[、，]?\s*(.+)$/);
  if(contrast){
   const before=contrast[1].trim(),after=contrast[2].trim();
   if(/低調|苦戦|不振|根拠は限定的|実績はなく|不安|未確認|未検証|大敗/.test(before))
     addRisk(before);
   else addGood(before);
   if(/可能性|未検証|未確認|未知|期待|反証|低調|苦戦|大敗|\d+着/.test(after))
     addRisk(after);
   else addGood(after);
   continue;
  }
  contrast=s.match(/^(.+?)[、，]\s*(.+(?:反証|未検証|未実証|未確認|未知|不安材料|大敗|低調).*)$/);
  if(contrast&&!/反証|未検証|未実証|未確認|未知|不安材料|低調/.test(contrast[1])){
   addGood(contrast[1]);addRisk(contrast[2]);continue;
  }
  // "poor recent results, but possible condition improvement" is a
  // documented HOPE, not verified race strength.
  let match=s.match(/^(.+?(?:低調|苦戦|不振|根拠は限定的|実績はなく|未確認))だが[、，]?\s*(.+)$/);
  if(match){
   addRisk(match[1]);
   if(/可能性|未検証|未知|期待/.test(match[2]))addRisk(match[2]);
   else addGood(match[2]);
   continue;
  }
  match=s.match(/^(.+?)が不安材料だが[、，]?\s*(.+)$/);
  if(!match)match=s.match(/^(.+?)が反証だが[、，]?\s*(.+)$/);
  if(match){addRisk(match[1]);addGood(match[2]);continue;}
  match=s.match(/^(.+?)(?:を|は)(?:評価するが|重視するが|評価したが|重視したが)[、，]?\s*(.+)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)(?:、|，)(.+?(?:は反証|が反証|は不安|未実証|未検証|未知))$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)が[、，]\s*(.+(?:未実証|未検証|未確認|不安|反証|未知|課題).*)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)(?:、|，)?(?:ただし|一方で|一方|しかし)[、，]?\s*(.+)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  // A single documented caution must not be rebranded as positive evidence.
  if(/^(ただし|一方|反証|不安|未検証|未確認)|反証|近況低調|未検証|未確認|勝ち切り証拠は不足|連対不足|角通過順は未確認|前回\d+着/.test(s)){
   addRisk(s);continue;
  }
  if(/今回|評価|重視|実績|強み|好走|連対|勝ち|勝利|接近|安定|力|クラス|条件|通用|優位|再現性|現級|上昇材料|実証|掲示板|素地|上級|水準/.test(s)){
   addGood(s);continue;
  }
  // Narrative cannot be reconstructed from raw records alone.
 }
 // Prefer a clear evaluative statement, not a list of dates.
 const reason=strengths.find(x=>/評価|重視|今回|同場|同距離|現級|実績|勝利|連対|能力|好走|上昇材料|再現性/.test(x))||strengths[0]||'';
 return {reason:plain(reason),risk:plain(cautions[0]||'')};
}
function headline(r,p,race){
 const source=rawText(r);
 if(!source)return '上位評価の理由が保存されていません';
 const finding=dissect(r),runs=getRuns(r);
 // An empty-sounding summary must not hide an actual recorded result.
 // Screenshot regression: Sonoda 1R 10 (C3-3 second + recent C3-2 fifth).
 if(/近\d+走.*(?:隔たり|比較的小さ|差が小さ)/.test(finding.reason)){
  const podium=runs.find(x=>x.finish<=3&&/C3三|C3-3/.test(x.raw));
  if(podium){
   return compact(podium.date+(podium.track||'')+
     (podium.distance?podium.distance+'m':'')+
     'のC3三で'+podium.finish+'着の実績を重視。今回同じC3三で巻き返しを期待',86);
  }
 }
 // An explicit paired-date 3rd-place note is stronger than "some top-3 results".
 const combo=source.match(/(\d{1,2}\/\d{1,2})と(\d{1,2}\/\d{1,2})の([^。]+?)でともに(\d{1,2})着/);
 if(combo&&/複数回|3着内実績|同条件/.test(finding.reason)){
  return compact(combo[1]+'・'+combo[2]+'の'+combo[3]+'でともに'+combo[4]+
    '着。今回もこの条件での実績を評価',86);
 }
 if(finding.reason){
  // Concrete recorded finishing positions are more useful than abstractions
  // like "上級組への実走水準" or "中央2戦で素地あり".
  if(/(?:実走水準|上位級|上級組|掲示板周辺|素地|証拠が2件)/.test(finding.reason)&&runs.length>=2){
   return compact(runs.slice(0,2).map(formatRun).join('・')+
     '。'+finding.reason,100);
  }
  return compact(finding.reason,86);
 }
 return runs.length?'上位評価の決め手は保存理由に明記なし（要確認）':
  '具体的な評価理由は保存情報から確認できません';
}
function comment(r,p,race){
 if(!rawText(r))return '【評価理由】保存された評価理由がありません。';
 const isEye=!!p?.eye&&Number(p.eye.horse_no)===Number(r.horse_no)&&
   !(p?.top5||[]).some(x=>Number(x.horse_no)===Number(r.horse_no));
 const rank=Number(r.rank),finding=dissect(r);
 const name=isEye?'EYEに選んだ理由':rank>=1&&rank<=5?
  'この順位にした理由':'評価した理由';
 const lines=['【'+name+'】'+headline(r,p,race)+'。'];
 lines.push('【根拠となる過去走】'+evidence(r)+'。');
 if(finding.risk)lines.push('【不安・未確認】'+finding.risk+'。');
 // Rank point differences are NOT independent ability evidence and
 // must not occupy the explanation. Show only documented support + risks.
 return lines.join('\n');
}
function overview(p,race){
 const top=[...(p?.top5||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
 return top.slice(0,2).map((r,i)=>(i?'○':'◎')+r.horse_no+' '+(r.horse_name||'')+
  '｜'+headline(r,p,race)).join('\n');
}
window.LabRankCompare=Object.freeze({comment,overview,headline});
})(window);
