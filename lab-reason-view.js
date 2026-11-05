/* LAB HUB — display-only, evidence-grounded narrative v3. Existing FROZEN is immutable. */
(function(global){
  'use strict';
  const formatReason = function formatReason(source, meta = {}) {
  const raw=String(source??"").trim();
  if(!raw)return "評価コメント未登録";
  const fixed=/(?:推測(?:で)?加点しない|推測で補わない|推測しない|未取得のため推測|取得できず推測)/;
  if(!/^20\d{2}-\d{2}-\d{2}/.test(raw)){
    const s=raw.split("。").map(x=>x.trim()).filter(x=>x&&!fixed.test(x));
    return s.length?s.join("。")+"。":"判断できる材料が限られ、評価は慎重に。";
  }
  const b=raw.indexOf("。"),history=b<0?raw:raw.slice(0,b),rest=b<0?"":raw.slice(b+1);
  const venue="船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館";
  const vm=new RegExp(`(${venue})(?:ダ|芝)?\\s*(\\d{3,4})m`);
  const targetInfo=rest.match(new RegExp(`今回(?:は|の)?\\s*(${venue})(?:ダ|芝)?\\s*(\\d{3,4})m`));
  const target=targetInfo?{track:targetInfo[1],distance:Number(targetInfo[2])}:null;
  const rr=history.split("／").map((s,i)=>{
    const dt=s.match(/^20\d{2}-(\d{2})-(\d{2})/),course=s.match(vm),pos=s.match(/(\d{1,2})着/);
    if(!dt||!pos)return null;
    const suffix=s.slice(pos.index+pos[0].length);
    const mm=suffix.match(/^(?:[\s・、]|着差(?:表記)?)*(\d+(?:\.\d+)?)(?:差)?/);
    return {day:`${Number(dt[1])}/${Number(dt[2])}`,track:course?.[1]||"",distance:course?Number(course[2]):null,finish:Number(pos[1]),margin:mm?Number(mm[1]):null,i,raw:s};
  }).filter(Boolean);
  if(!rr.length)return raw;
  const course=r=>`${r.track}${r.distance||""}m`;
  const same=r=>target&&r.track===target.track&&r.distance===target.distance;
  const f=r=>`${r.day}${course(r)}・${r.finish}着${r.margin!==null?`（${r.margin}差）`:""}`;
  const good=rr.filter(r=>r.finish<=3);
  const goodSame=good.filter(same);
  const wins=good.filter(r=>r.finish===1);
  const winsSame=wins.filter(same);
  const close=rr.filter(r=>r.finish>=4&&r.finish<=6&&r.margin!==null&&r.margin<=1);
  const last=rr[0],sameCount=rr.filter(same).length;
  let sentences=[];
  if(winsSame.length>=2){
    const v=winsSame.slice(0,2);
    sentences.push(`この舞台で勝ち切る力は証明済み。${f(v[0])}、${f(v[1])}と${target.track}${target.distance}mで複数の勝利を挙げている。`);
    sentences.push(`コース適性の確かさが何よりの魅力で、今回も主役候補。`);
  }else if(goodSame.length>=2){
    const v=goodSame.slice(0,2);
    const type=winsSame.length?"勝利と好走を重ねている":"繰り返し上位に迫っている";
    sentences.push(`${f(v[0])}、${f(v[1])}。同じ${target.track}${target.distance}mで${type}のは心強い。`);
    sentences.push(winsSame.length?"この条件での勝負強さを生かしたい。":"相手が変わっても力を出せるか、注目したい一頭。");
  }else if(goodSame.length===1){
    const r=goodSame[0],extra=good.find(x=>x!==r);
    if(r.finish===1)sentences.push(`${f(r)}。今回と同じ舞台で勝った経験は、頼もしい武器になる。`);
    else sentences.push(`${f(r)}。今回と同じ舞台でしっかり結果を残している。`);
    if(extra)sentences.push(`${f(extra)}もあり、好走の裏付けは一つだけではない。`);
    else sentences.push(`この実績を今回の走りにつなげられるかが見どころ。`);
  }else if(good.length>=2){
    const a=good.slice(0,2);
    const prefix=wins.length>=2?"勝ち切った経験が複数ある。":"好走を重ねてきた経験がある。";
    sentences.push(`${f(a[0])}、${f(a[1])}。${prefix}`);
    if(target&&sameCount===0)sentences.push(`今回の${target.distance}mは未経験。その力を新しい条件でも発揮できるか楽しみだ。`);
    else sentences.push("今回の条件でその力を出し切れるかがポイント。");
  }else if(good.length===1){
    const r=good[0];
    const debut=rr.length===1&&/NewBeginning|新馬|フレッシュチャレンジ/.test(r.raw);
    const stem=debut?"デビュー戦":"過去";
    sentences.push(`${stem}の${f(r)}は評価できる走り。`);
    if(rr.length===1)sentences.push("まだ材料は少ないが、この一戦を手掛かりに力を見極めたい。");
    else if(last!==r&&last.finish>=6)sentences.push(`直近は${f(last)}と苦戦。好走時の姿を取り戻せるかが焦点だ。`);
    else sentences.push("この走りを今回も見せられるか期待したい。");
    if(target&&!sameCount){
      const change=r.distance?target.distance>r.distance?"距離延長":target.distance<r.distance?"距離短縮":"距離変更":"初距離";
      sentences.push(`ただし今回は${target.distance}mへの${change}。未知の条件をどうこなすかが鍵。`);
    }
  }else if(close.length){
    const r=close[0];
    sentences.push(`${f(r)}と大きくは離されていない一戦がある。`);
    if(last!==r&&last.finish>=7)sentences.push(`一方で直近は${f(last)}。まずはこの差を詰めたい。`);
    else sentences.push("勝ち負けの実績はまだ不足しているが、着差の小さい走りが手掛かり。");
    if(target&&!sameCount)sentences.push(`${target.distance}mへの条件替わりも未知数。`);
  }else{
    sentences.push(rr.length>1?`近走は${f(rr[0])}、${f(rr[1])}と厳しい結果が続いている。`:`${f(rr[0])}と、好走の手掛かりがまだ少ない。`);
    sentences.push(target&&!sameCount?`今回の${target.distance}mは未経験。変化を見たいが、強く推せる根拠はまだ足りない。`:"ここは評価を抑えたが、次につながる走りが欲しい。");
  }
  const latestPoor=last.finish>=6&&last.margin!==null&&last.margin>=1.4;
  const latestAlreadyMentioned=sentences.some(s=>s.includes(f(last)));
  if(good.length>=2&&latestPoor&&!latestAlreadyMentioned&&!sentences.some(s=>s.includes("苦戦"))){
    if(same(last))sentences.push(`気になるのは直近の${f(last)}。得意舞台でも立て直せるかが勝負どころ。`);
    else sentences.push(`直近の${f(last)}から、どれだけ巻き返せるかがポイント。`);
  }
  const out=sentences.slice(0,3).join("");
  return out.length>200?sentences.slice(0,2).join(""):out;
};
  global.LabReasonView = Object.freeze({format:formatReason});
})(window);
