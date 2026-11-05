/* LAB HUB: evidence-led comments for display only; FROZEN source is never edited. */
(function(global){
  'use strict';
  const formatReason = function formatReason(source,meta={}) {
  const raw=String(source??"").trim();
  if(!raw)return "評価コメント未登録";
  const boiler=/推測(?:で)?加点しない|推測で補わない|推測しない|未取得のため推測|取得できず推測|通過順・当日馬場・枠・調教|^今回同場同距離実走\d+件|^今回.{0,55}(?:近走|同場|距離適性|クラス).{0,30}(?:比較|照合)/;
  if(!/^20\d{2}-\d{2}-\d{2}/.test(raw)){
    const meaningful=raw.split("。").map(s=>s.trim()).filter(s=>s&&!boiler.test(s));
    return meaningful.length?meaningful.join("。")+"。":"評価材料が限られるため、判断は慎重に。";
  }
  const ix=raw.indexOf("。"),list=ix<0?raw:raw.slice(0,ix),body=ix<0?"":raw.slice(ix+1);
  const venueNames="船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館";
  const venueRegex=new RegExp(`(${venueNames})(?:ダ|芝)?\\s*(\\d{3,4})m`);
  const next=body.match(new RegExp(`今回(?:は|の)?\\s*(${venueNames})(?:ダ|芝)?\\s*(\\d{3,4})m`));
  const target=next?{venue:next[1],distance:Number(next[2])}:null;
  const rows=list.split("／").map((s,i)=>{
    const date=s.match(/^20\d{2}-(\d{2})-(\d{2})/),course=s.match(venueRegex),finish=s.match(/(\d{1,2})着/);
    if(!date||!finish)return null;
    const after=s.slice(finish.index+finish[0].length);
    const m=after.match(/^(?:[\s・、]|着差(?:表記)?)*(\d+(?:\.\d+)?)(?:差)?/);
    return {date:`${Number(date[1])}/${Number(date[2])}`,venue:course?.[1]||"",distance:course?Number(course[2]):null,finish:Number(finish[1]),margin:m?Number(m[1]):null,index:i,raw:s};
  }).filter(Boolean);
  if(!rows.length)return raw;
  const same=r=>!!(target&&r.venue===target.venue&&r.distance===target.distance);
  const short=r=>`${r.date}${r.venue}${r.distance??""}m・${r.finish}着${r.margin!==null?`（${r.margin}差）`:""}`;
  const nice=r=>`${r.venue}${r.distance??""}mで${r.finish}着${r.margin!==null?`、${r.margin}差`:""}`;
  const good=rows.filter(r=>r.finish<=3),goodSame=good.filter(same),sameRows=rows.filter(same),near=rows.filter(r=>r.finish>=4&&r.finish<=6&&r.margin!==null&&r.margin<=1.0);
  const bad=rows.filter(r=>r.finish>=6),poorSame=sameRows.filter(r=>r.finish>=6).sort((a,b)=>a.index-b.index),latest=rows[0];
  const caution=poorSame.find(r=>r.margin!==null&&r.margin>=1.2)||bad.find(r=>r.margin!==null&&r.margin>=1.5)||bad[0];
  const output=[],isHigh=Number(meta.rank)<=2,rankPhrase=isHigh?"上位に評価":"評価";
  if(goodSame.length>=2){
    output.push(`今回と同じ${target.venue}${target.distance}mで、${goodSame.slice(0,2).map(r=>`${r.date}に${r.finish}着${r.margin!==null?`（${r.margin}差）`:""}`).join("、")}。この条件で好走を重ねている点が強み。`);
  }else if(goodSame.length===1){
    const r=goodSame[0];
    output.push(`今回と同じ${target.venue}${target.distance}mで${r.date}に${r.finish}着${r.margin!==null?`、${r.margin}差`:""}。距離への対応を示した実績として${rankPhrase}。`);
    const additional=good.find(x=>x!==r);
    if(additional)output.push(`${short(additional)}もあり、他の条件でも好走経験がある。`);
  }else if(good.length>=2){
    output.push(`${short(good[0])}、${short(good[1])}と複数の好走歴がある。`);
    if(target&&!sameRows.length)output.push(`ただし今回の${target.distance}mは未経験で、距離への対応が鍵。`);
    else output.push(`過去の走りは魅力だが、今回の条件で力を発揮できるか見極めたい。`);
  }else if(good.length===1){
    const r=good[0];
    if(rows.length===1){
      const debut=/NewBeginning|新馬|フレッシュチャレンジ/.test(r.raw)?"デビュー戦":"前走";
      output.push(`${debut}の${nice(r)}。確認できる実走はまだ1回だが、この走りを手掛かりに${rankPhrase}。`);
    }else{
      output.push(`${short(r)}の好走歴があり、巻き返しの根拠はある。`);
      if(latest!==r&&latest.finish>=4)output.push(`一方、直近は${short(latest)}。最近の内容には課題が残る。`);
    }
    if(target&&!sameRows.length) {
      const direction=r.distance&&target.distance>r.distance?"距離延長":r.distance&&target.distance<r.distance?"距離短縮":"距離変更";
      output.push(`今回は${target.distance}mへの${direction}が初めてで、対応できるかが焦点。`);
    }
  }else if(near.length){
    const r=near[0];output.push(`${short(r)}と、着順ほど大きく負けていない走りはある。`);
    if(latest!==r&&latest.finish>=7)output.push(`ただし直近は${short(latest)}と苦戦しており、上位争いには改善が必要。`);
    if(target&&!sameRows.length)output.push(`今回の${target.distance}mは未経験。条件替わりも未知数だ。`);
    else if(output.length<2)output.push(`3着以内の実績がなく、勝ち負けを強く推す材料はまだ少ない。`);
  }else{
    if(rows.length>1)output.push(`近走は${short(latest)}、${short(rows[1])}と厳しい結果が続いている。`);
    else output.push(`${short(latest)}と、現時点で好走を裏付ける材料が少ない。`);
    if(target&&!sameRows.length)output.push(`今回の${target.distance}mは初条件で、変わり身は未知数。`);
    else output.push(`今回の条件でも上位争いを裏付ける材料が乏しく、${rankPhrase}は控えめ。`);
  }
  const hasRisk=output.some(s=>/ただし|一方|課題|鍵|未知|初めて|未経験|厳しい|苦戦|材料が乏し/.test(s));
  if(good.length&&caution&&caution.margin!==null&&caution.margin>=1.2&&!hasRisk){
    if(same(caution))output.push(`ただし同じ距離では${short(caution)}もあり、安定感に不安が残る。`);
    else output.push(`ただし${short(caution)}の敗戦もあり、過信は禁物。`);
  }else if(good.length&&caution&&same(caution)&&caution.margin!==null&&caution.margin>=1.2&&!output.some(s=>s.includes(caution.date))){
    output.push(`同距離では${short(caution)}の敗戦もあり、適性には課題が残る。`);
  }
  if(output.length>3)output.splice(3);
  return output.join("").replace(/。。/g,"。");
};
  global.LabReasonView=Object.freeze({format:formatReason});
})(window);
