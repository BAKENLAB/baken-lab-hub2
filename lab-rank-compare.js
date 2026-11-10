/* LAB RANK: evidence-based comparative notes. Read-only; never modifies FROZEN. */
(function(window){'use strict';
function rawText(r){
 // Saved official reason is the authoritative ability explanation. A generic
 // optional display comment must never conceal it.
 return String(r?.reason||r?.comment||r?.short_reason||'').trim()
}
function getRuns(r){
 const head=rawText(r).split('。')[0]||'';
 // LOCAL saved reasons commonly use short dates and 、 separators,
 // rather than ISO dates and ／ separators. Recognize both safely.
 const dates=[...head.matchAll(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}/g)].slice(0,8);
 let previousVenue='';
 return dates.map((date,i)=>{
  const part=head.slice(date.index,dates[i+1]?.index??head.length);
  const dm=date[0].match(/(?:20\d{2}[-/])?(\d{1,2})[-/](\d{1,2})$/);
  const place=part.match(/(\d{1,2})着/);
  if(!dm||!place)return null;
  const course=part.slice(date[0].length);
  const venue=course.match(/(船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館)/);
  // "同1400m" inherits venue only when a prior explicit venue was parsed.
  const same=/^\s*同(?:場)?/.test(course);
  const track=venue?.[1]||(same?previousVenue:'');
  if(venue)previousVenue=venue[1];
  const distance=course.match(/(\d{3,4})\s*m/);
  const suffix=part.slice(place.index+place[0].length);
  // Retain saved literal; never reinterpret NAR lengths as seconds.
  const margin=suffix.match(/^\s*(\d+(?:\.\d+)?)差/);
  const grade=course.match(/(?:3歳)?[ABC]\d{1,2}(?:[一二三四五六七八九十]+|[-]\d+)?|[123]勝クラス|オープン|JpnI{1,3}/);
  return {day:String(Number(dm[1]))+'/'+String(Number(dm[2])),venue:track,
   distance:distance?Number(distance[1]):null,
   finish:Number(place[1]),margin:margin?margin[1]:null,grade:grade?.[0]||'',index:i}
 }).filter(Boolean)
}
function formatRun(v){
 return v.day+(v.venue||'')+(v.distance?String(v.distance)+'m':'')+
  (v.grade?' '+v.grade:'')+'・'+v.finish+'着'+
  (v.margin!==null?'（原文'+v.margin+'差）':'')
}
function evidence(r,limit=2){
 const rows=getRuns(r);
 const pos=rows.filter(x=>x.finish<=3);
 // Missing margin is UNKNOWN, not evidence of a close finish.
 const near=rows.filter(x=>x.finish<=6&&x.margin!==null&&Number(x.margin)<=1.5);
 const pick=pos.length?pos.slice(0,limit):near.length?near.slice(0,limit):rows.slice(0,Math.min(limit,2));
 if(pick.length)return pick.map(formatRun).join('、');
 // Parser failure is not a race-history acquisition failure.
 return rawText(r).split('。')[0]||'具体的な近走根拠の記載なし'
}
function narrative(r){
 const parts=rawText(r).split('。').map(x=>x.trim()).filter(Boolean).slice(1);
 const notes=parts.filter(x=>!/^(未取得の|確認できない|通過順|独立比較：)/.test(x)&&!/推測加点しない|推測で補わない|推定しない|推測しない/.test(x));
 const positives=notes.filter(s=>!/ただし|未知|未実証|反証|不確実|課題/.test(s)&&/評価|実績|勝ち|安定|強み|重視|適合|好走|級|軽量化|力/.test(s));
 const risks=notes.filter(s=>/ただし|級差|未知|未実証|反証|不確実|相手強化|課題|不安|未確証|距離延長|距離短縮|苦戦/.test(s));
 return {positive:positives[0]||'',risk:risks[0]||''}
}
function targetCourse(r,race){
 const body=rawText(r).split('。').slice(1).join('。');
 const all=[...body.matchAll(/(船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館)[^\d。]{0,10}(\d{3,4})m/g)];
 const candidates=all.filter(m=>m[1]===race?.track);
 const m=candidates[candidates.length-1];
 return m?{track:m[1],distance:Number(m[2])}:null
}
function riskFor(r,race){
 const specific=narrative(r).risk;if(specific)return specific.replace(/。$/,'');
 const course=targetCourse(r,race),runs=getRuns(r);
 if(course&&!runs.some(x=>x.venue===course.track&&x.distance===course.distance))return `記載された近走に${course.track}${course.distance}mの実走がなく、同一条件での再現性は未確認`;
 if(/A2B1|A1A2/.test(String(race?.race_name||''))){
  const good=runs.filter(x=>x.finish<=3);
  if(good.length&&good.every(x=>!/(A1|A2)/.test(x.grade)))return '記載された好走はB級以下が中心。今回のA級混合でどこまで通用するかが焦点';
 }
 return ''
}
function peerOf(r,p){
 const top=Array.isArray(p?.top5)?[...p.top5].sort((a,b)=>Number(a.rank)-Number(b.rank)):[];
 if(!top.length)return null;
 const i=top.findIndex(x=>Number(x.horse_no)===Number(r.horse_no));
 return i<0?top[top.length-1]:top[i===0?1:i===1?0:i-1]||null
}
function compare(r,p){
 const peer=peerOf(r,p);if(!peer)return '比較対象の保存データがない。';
 const a=Number(r.score),b=Number(peer.score),diff=Number.isFinite(a)&&Number.isFinite(b)?`${Math.abs(a-b)}点差`:'総合点の比較不可';
 const mark=['◎','○','▲','☆','△'][Number(peer.rank)-1]||'比較相手';
 const aHigh=getRuns(r).some(x=>x.finish<=3&&/A[12]/.test(x.grade)),bHigh=getRuns(peer).some(x=>x.finish<=3&&/A[12]/.test(x.grade));
 let comparison=`相手の実績は${evidence(peer,1)}`;
 if(aHigh!==bHigh)comparison=aHigh?'こちらはA級での好走、相手はB級以下での好走が中心':'相手にはA級での好走、こちらにはB級以下での好走が目立つ';
 return `${mark}${Number(peer.horse_no)}${peer.horse_name||''}（${peer.score??'—'}点）と${diff}。${comparison}。`
}
function comment(r,p,race){
 if(!rawText(r))return '保存された評価理由がありません。';
 const n=narrative(r),rank=Number(r.rank),isEye=!!p?.eye&&Number(p.eye.horse_no)===Number(r.horse_no)&&!(p.top5||[]).some(x=>Number(x.horse_no)===Number(r.horse_no));
 const name=isEye?'TOP5外でも警戒する材料':rank===1?'◎の評価材料':rank===2?'○の逆転材料':rank<=5?'相手候補としての材料':'能力評価の材料';
 const positive=n.positive?`。${n.positive.replace(/。$/,'')}`:'';
 const lines=[`【${name}】${evidence(r,2)}${positive}。`,`【ライバル比較】${compare(r,p)}`];const risk=riskFor(r,race);if(risk)lines.push(`【判断の分かれ目】${risk}。`);return lines.join('\n')
}
function overview(p,race){
 const top=Array.isArray(p?.top5)?[...p.top5].sort((a,b)=>Number(a.rank)-Number(b.rank)):[];
 if(!top.length)return '';
 const a=top[0],b=top[1],lines=[`◎${a.horse_no} ${a.horse_name||''}（${a.score??'—'}点）｜${evidence(a,2)}`];
 if(b)lines.push(`○${b.horse_no} ${b.horse_name||''}（${b.score??'—'}点）｜${evidence(b,3)}`);
 if(b){
  const aHigh=getRuns(a).some(x=>x.finish<=3&&/A[12]/.test(x.grade)),bHigh=getRuns(b).some(x=>x.finish<=3&&/A[12]/.test(x.grade));
  const gap=Number.isFinite(Number(a.score))&&Number.isFinite(Number(b.score))?`${Math.abs(Number(a.score)-Number(b.score))}点差`:'点差不明';
  lines.push(aHigh&&!bHigh?`◎と○は${gap}。◎のA級好走と、○の地元B級好走をどう比べるかが焦点。`:`◎と○は${gap}。近走の級・距離・相手関係を見比べたい。`);
 }
 if(p.eye&&typeof p.eye==='object'){
  const e=p.eye,last=top[top.length-1],gap=Number.isFinite(Number(last?.score))&&Number.isFinite(Number(e.score))?`（△との差${Math.abs(Number(last.score)-Number(e.score))}点）`:'',note=narrative(e).positive;
  lines.push(`🧪EYE${e.horse_no} ${e.horse_name||''}${gap}｜${evidence(e,2)}${note?`。${note}`:''}`);
 }
 lines.push('※点差は保存された総合評価。因子別の配点内訳は未記録。これは能力比較であり買い目ではありません。');
 return lines.join('\n')
}
window.LabRankCompare=Object.freeze({comment,overview});
})(window);
