/* BAKEN LAB: display-only reason summaries. FROZEN evidence remains unchanged. */
(function(global){
  'use strict';
  const formatReason = function formatReason(source) {
  const raw = String(source ?? "").trim();
  if (!raw) return "評価コメント未登録";
  const hasDatedList = /^20\d{2}-\d{2}-\d{2}/.test(raw);
  if (!hasDatedList && raw.length <= 190 && !/推測加点しない|推測で補わない/.test(raw)) return raw;
  let history = [], body = raw;
  if (hasDatedList) {
    const boundary = raw.indexOf("。");
    if (boundary !== -1) {
      history = raw.slice(0, boundary).split("／").map(s => s.trim()).filter(s => /^20\d{2}-\d{2}-\d{2}/.test(s));
      body = raw.slice(boundary + 1).trim();
    }
  }
  const sentences = body.split("。").map(s => s.trim()).filter(Boolean);
  const boilerplate = s => /推測加点しない|推測で補わない|推測しない|取得できず.*(?:推測|加点)|(?:通過順|枠|調教|追切|当日馬場).*(?:取得できず|未取得|未確認)|^今回.{0,70}(?:近走|クラス|級差|同場|距離適性).{0,35}(?:比較|照合)$/.test(s);
  const meaningful = sentences.filter(s => !boilerplate(s));
  const selectFacts = entries => entries.map(s => {
    const dt = s.match(/^20\d{2}-(\d{2})-(\d{2})/);
    const course = s.match(/(船橋|園田|笠松|盛岡|門別|高知|佐賀|名古屋|大井|川崎|浦和|水沢|金沢|東京|京都|阪神|中山|中京|新潟|小倉|札幌|函館)(?:ダ)?(\d{3,4})m/);
    const pos = s.match(/(\d{1,2}着)(?:[・、\s]*着差)?\s*([\d.]+差|同タイム)?/);
    if (!dt || !pos) return null;
    return {finish:Number(pos[1].replace("着","")),text:`${Number(dt[1])}/${Number(dt[2])}${course ? course[1]+course[2]+"m" : ""} ${pos[1]}${pos[2]||""}`};
  }).filter(Boolean);
  const facts = selectFacts(history);
  const positive = facts.filter(x => x.finish <= 3);
  const negative = facts.filter(x => x.finish >= 6);
  const leadCandidate = meaningful.map(s => s.match(/(?:近走|同場同距離|同距離|同級|現級|上級|前走)[^、。]{0,30}(?:安定|上昇|連勝|高評価|好走|実績|強み|良好|証明|評価)/)?.[0]).find(Boolean);
  const same = body.match(/今回同場同距離実走(\d+)件/);
  let lead = leadCandidate || "";
  if (!lead && same) lead = Number(same[1]) > 0 ? `同場同距離の実走${Number(same[1])}件を確認` : "今回と同じ距離の実走は未確認";
  if (!lead && positive.length >= 2) lead = "複数の好走実績を評価";
  if (!lead && positive.length === 1) lead = "好走実績を確認";
  if (!lead) lead = "近走の実績と今回条件を比較";
  lead = lead.replace(/[。]+$/,"");
  const usable = meaningful.filter(s => s!==lead && !/^今回同場同距離実走\d+件$/.test(s));
  const evidences = usable.filter(s => !/^(?:通過順|当日馬場|枠|調教)/.test(s));
  let evidence = evidences.filter(s=>/着|勝|秒差|好走|連勝|安定|相手|クラス|距離/.test(s)).slice(0,2).join("。");
  if (evidence.length>145) {
    const items=evidence.split(/[、。]/).filter(Boolean);
    evidence=items.slice(0,2).join("、");
  }
  if (!evidence && facts.length) {
    const picks=[...positive.slice(0,2)];
    if (!picks.length) picks.push(facts[0]);
    evidence=picks.map(x=>x.text).join("、");
  }
  const caution = meaningful.find(s=>/(?:反証|懸念|不安|課題|距離未知|初経験|未経験)/.test(s)) || (negative.length && !/(?:7着|8着|9着|10着)/.test(evidence) ? `${negative[0].text}は不安材料` : "");
  const parts=[lead+"。"];
  if(evidence)parts.push(evidence.replace(/[。]+$/,"")+"。");
  if(caution && !parts.some(p=>p.includes(caution)))parts.push("注意："+caution.replace(/[。]+$/,"")+"。");
  return parts.join("\n");
};
  global.LabReasonView = Object.freeze({ format: formatReason });
})(window);
