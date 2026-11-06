/* LAB RANK: evidence-based comparative notes. Read-only; never modifies FROZEN. */
(function(window){'use strict';
function rawText(r){return String(r?.comment||r?.reason||r?.short_reason||'').trim()}
function getRuns(r){
 const head=rawText(r).split('。')[0]||'';
 return head.split('／').slice(0,8).map((part,i)=>{
  const date=part.match(/20\d{2}-(\d{2})-(\d{2})/),venue=part.match(/(船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館)[^\d]{0,16}?(\d{3,4})m/),place=part.match(/(\d{1,2})着/);
  if(!date||!venue||!place)return null;
  const suffix=part.slice(place.index+place[0].length),margin=suffix.match(/^(?:\s|・|、|着差|=)*(\d+(?:\.\d+)?)/);
  const grade=part.match(/(?:A1|A2|A3|B1|B2|B3|C1|C2|C3)(?:A1|A2|B1|B2)?|オープン|3勝クラス|2勝クラス|JpnI{1,3}/);
  return {day:`${Number(date[1])}/${Number(date[2])}`,venue:venue[1],distance:Number(venue[2]),finish:Number(place[1]),margin:margin?margin[1]:null,grade:grade?.[0]||'',index:i}
 }).filter(Boolean)
}
function formatRun(v){return `${v.day}${v.venue}${v.distance}m${v.grade?' '+v.grade:''}・${v.finish}着${v.margin!==null?`（${v.margin}差）`:''}`}
function evidence(r,limit=2){
 const rows=getRuns(r),pos=rows.filter(x=>x.finish<=3),near=rows.filter(x=>x.finish<=6&&(x.margin===null||Number(x.margin)<=1.5)),pick=pos.length?pos.slice(0,limit):near.length?near.slice(0,limit):rows.slice(0,Math.min(limit,2));
 return pick.length?pick.map(formatRun).join('、'):'確認できる近走材料が不足'
}
function narrative(r){
 const parts=rawText(r).split('。').map(x=>x.trim()).filter(Boolean).slice(1);
 const notes=parts.filter(x=>!/^(今回|未取得の|確認できない|通過順|独立比較：)/.test(x)&&!/推測加点しない|推測で補わない|推定しない|推測しない/.test(x));
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
 return '原本に個別の懸念は明記されておらず、今回の適性を断定できない'
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
 return [`【${name}】${evidence(r,2)}${positive}。`,`【ライバル比較】${compare(r,p)}`,`【判断の分かれ目】${riskFor(r,race)}。`].join('\n')
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
