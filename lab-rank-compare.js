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
  .replace(/反証/g,'不安材料');
}
function getRuns(r){
 const head=rawText(r).split('。')[0]||'';
 const dates=[...head.matchAll(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}/g)].slice(0,8);
 let previousVenue='';
 return dates.map((m,i)=>{
  const section=head.slice(m.index,dates[i+1]?.index??head.length);
  const dm=m[0].match(/(?:20\d{2}[-/])?(\d{1,2})[-/](\d{1,2})$/);
  const part=section.slice(m[0].length);
  const place=part.match(/(\d{1,2})着|勝ち|勝利/);
  if(!dm||!place)return null;
  const venue=part.match(venues);
  const same=/^\s*同/.test(part);
  const track=venue?.[1]||(same?previousVenue:'');
  if(venue)previousVenue=venue[1];
  const distance=part.match(/(\d{3,4})\s*m/);
  const finish=place[1]?Number(place[1]):1;
  return {date:Number(dm[1])+'/'+Number(dm[2]),track,
   distance:distance?Number(distance[1]):null,finish,raw:section};
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
 // The first sentence is usually the chronological history inventory.
 const analysis=(sentences.length>1&&/\d{1,2}\/\d{1,2}|20\d{2}-\d{2}-\d{2}/.test(sentences[0]))?
   sentences.slice(1):sentences;
 const strengths=[],cautions=[];
 const addGood=s=>{const t=compact(s);if(t)strengths.push(t)};
 const addRisk=s=>{const t=compact(s);if(t)cautions.push(t)};
 for(const s of analysis){
  if(/^未取得|^推測で補わない|^推測加点しない/.test(s))continue;
  let match=s.match(/^(.+?)が不安材料だが[、，]?\s*(.+)$/);
  if(!match)match=s.match(/^(.+?)が反証だが[、，]?\s*(.+)$/);
  if(match){addRisk(match[1]);addGood(match[2]);continue;}
  match=s.match(/^(.+?)(?:を評価するが|を重視するが|を評価したが|を重視したが)[、，]?\s*(.+)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)(?:、|，)(.+?(?:は反証|が反証|は不安|未実証|未検証|未知))$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)が[、，]\s*(.+(?:未実証|未検証|未確認|不安|反証|未知|課題).*)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  match=s.match(/^(.+?)(?:、|，)?(?:ただし|一方で|一方|しかし)[、，]?\s*(.+)$/);
  if(match){addGood(match[1]);addRisk(match[2]);continue;}
  // A single documented caution must not be rebranded as positive evidence.
  if(/^(ただし|一方|反証|不安|未検証|未確認)|(?:は反証|が反証|は不安|未実証|未検証|未知数|が課題|検証できない)(?:[。]?|$)/.test(s)){
   addRisk(s);continue;
  }
  if(/今回|評価|重視|実績|強み|好走|連対|勝ち|勝利|接近|安定|力|クラス|条件|通用|優位|再現性|現級|上昇材料/.test(s)){
   addGood(s);continue;
  }
  // Narrative cannot be reconstructed from raw records alone.
 }
 // Prefer a clear evaluative statement, not a list of dates.
 const reason=strengths.find(x=>/評価|重視|今回|同場|同距離|現級|実績|勝利|連対|能力|好走|上昇材料|再現性/.test(x))||strengths[0]||'';
 return {reason:plain(reason),risk:plain(cautions[0]||'')};
}
function headline(r,p,race){
 if(!rawText(r))return '上位評価の理由が保存されていません';
 const finding=dissect(r);
 if(finding.reason)return compact(finding.reason,86);
 const runs=getRuns(r);
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
 if(rank===1||rank===2){
  const top=[...(p?.top5||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
  const peer=top.find(x=>Number(x.rank)===(rank===1?2:1));
  if(peer&&Number.isFinite(Number(r.score))&&Number.isFinite(Number(peer.score)))
   lines.push('【上位2頭の差】'+(rank===1?'○':'◎')+String(peer.horse_no)+
    'とは総合評価で'+Math.abs(Number(r.score)-Number(peer.score))+
    '点差。点差だけでは優劣の理由は説明できません。');
 }
 return lines.join('\n');
}
function overview(p,race){
 const top=[...(p?.top5||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
 return top.slice(0,2).map((r,i)=>(i?'○':'◎')+r.horse_no+' '+(r.horse_name||'')+
  '｜'+headline(r,p,race)).join('\n');
}
window.LabRankCompare=Object.freeze({comment,overview,headline});
})(window);
