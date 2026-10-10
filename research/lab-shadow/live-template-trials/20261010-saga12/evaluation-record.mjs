// Human-selected ordering/reasons and pair assessments for this single trial.
// Formatting only: no model calls, network, scoring function or production save.
import {readFileSync,writeFileSync} from 'node:fs';
import {createWorksheet,createOutsideAuditSlots,validateCompleted} from '../../local-save-template-v1/template.mjs';
const dir=new URL('./',import.meta.url), context=JSON.parse(readFileSync(new URL('input-context.json',dir),'utf8'));
const start='2026-10-10T11:00:52Z';
const decisions=[
 [13,'B','9/19佐賀1400mで0.9秒差4着、③に0.2秒先着。園田交流1400mも2.3秒差6着で、今回距離の確認材料がある。移籍元の名前だけで加点せず、佐賀の直接実績を重視。地方通過順がなく勝ち切る再現性は未確定。'],
 [3,'B','9/19佐賀1400mで1.1秒差5着、上がり38.9。⑬と同じレースで僅差だったことを評価。中央では芝1200mとダート短距離で大敗しており、その成績を1400mへ単純換算しない。履歴4件、地方での再現回数は少ない。'],
 [12,'C','8/30佐賀1400mで2.6秒差6着、同レースの⑩⑦に先着。9/19の1300mも4着。ただし⑩には先着されており、距離実績を優先してこの順とした。良1400mへの裏付けはあるが、上位との能力差を断定できない。'],
 [10,'C','9/19佐賀1300mで1.4秒差3着、上がり39.5で⑫⑦に先着。一方8/30の良1400mは4.5秒差8着で距離延長に不安。中央1000mの上がりを佐賀1400mの能力へ直接換算せず、今回は信頼度を抑える。'],
 [6,'C','9/19佐賀1300mは1.1秒差7着で⑭⑨に先着。良1400mでは1.7秒差7着など、強い勝利根拠はないが、今回51kgは直近54kgより3kg軽い。減量の効果を確定せず、今回条件での比較材料として扱う。'],
 [8,'D','7/18佐賀の良1400mで0.8秒差5着、上がり39.2。ただし直近8/30の良1400mは4.5秒差12着で反転根拠がない。最新掲載履歴から41日で、休養効果や状態回復は確認できない。'],
 [14,'D','8/9佐賀の良1400mで0.9秒差4着、①②に先着。直近1300mでは1.7秒差8着、⑥に先着された。1400mへ戻る材料はあるが、過去の好走だけで今回の改善を確定しない。'],
 [2,'D','8/29佐賀の良1400mで0.8秒差5着。9/19同距離では3.3秒差5着で①⑤④⑪に先着したが、着差は縮まっていない。中央1700mの位置取りは今回の地方脚質を保証しない。'],
 [1,'D','8/9佐賀の良1400mで1.1秒差5着。一方9/19は3.5秒差7着。今回53kgは直近54kgより1kg軽いが、末脚の改善や状態回復を確認できず、軽量だけでは上位評価にしない。'],
 [4,'D','8/30佐賀1300mで1.1秒差8着、①⑭に先着した実績はある。直近1400mは3.9秒差8着、7/4も4.6秒差10着で今回距離の裏付けが弱い。6/25の取止は完走や敗戦に数えない。'],
 [9,'D','8/30佐賀1300mで0.7秒差6着、①④⑭に先着。8/8良1400mは2.0秒差4着。ただし直近1300mは2.6秒差10着、上がり44.5で状態改善の裏付けがない。'],
 [7,'E','直近佐賀1300mは2.6秒差5着で⑫と同タイムだが後着、⑩には先着された。8/30良1400mは4.7秒差9着。中央の芝と長距離ダート大敗を今回距離へ換算せず、佐賀での改善材料不足を重視。'],
 [5,'E','9/19佐賀1400mは3.5秒差6着で①に先着したが、上がり43.2。近走の900mも2.5秒差6着、1300mも1.7秒差10着で、今回1400mに適合する反転根拠が乏しい。騎手名で加点しない。'],
 [11,'F','9/19佐賀1400mは7.2秒差13着、上がり46.0。過去の同距離も4.3秒差10着で、今回に接続する好走根拠が最も弱い。1300mでの1.8秒差5着だけではこの距離での反転を支持できない。']
];
const p=createWorksheet(context);
for(const [i,[n,grade,reason]] of decisions.entries()) Object.assign(p.runners.find(r=>r.horse_no===n),{rank:i+1,grade,reason});
p.top5=decisions.slice(0,5).map(([n])=>structuredClone(p.runners.find(r=>r.horse_no===n)));
Object.assign(p.audit,createOutsideAuditSlots(p));
const refs=n=>context.runners.find(r=>r.horse_no===n).history_source_refs;
const localFact=r=>`${r.race_date} ${r.track}${r.race_no}R ${r.distance}m ${r.going} ${r.finish===null?'完走着順なし':r.finish+'着'}、記録着差=${r.margin}、上がり=${r.final3f??'欠損'}`;
for(const e of p.audit.runner_evidence_audit){
 const r=context.runners.find(x=>x.horse_no===e.horse_no);
 e.recent_runs_checked=true;e.evidence_summary=p.runners.find(x=>x.horse_no===e.horse_no).reason;
 e.evidence_facts=r.recent_runs.slice(0,2).map(localFact);
 e.evidence_refs=refs(r.horse_no);
 e.missing_items=[...e.missing_items,'地方近走通過順','不利の具体的証拠','当日馬場傾向'];
 if(r.recent_runs.some(x=>['小倉','阪神','福島','東京','中山','京都','新潟'].includes(x.track))) e.missing_items.push('JRA着差は着差表記であり秒差未確認');
}
const cases={
 8:['7/18良1400m0.8秒差を再現できるか検討したが、直近同条件4.5秒差を反転する現在材料がない。','7/18の上がり39.2は距離実績の材料だが、直近43.4との落差の原因が不明。','過去の良1400mでの僅差を再現する必要があるが、位置取りと状態を確認できない。','8/30の12着4.5秒差、最新履歴から41日で調整過程が不明。'],
 14:['1300mから1400mへ戻り、8/9の同距離0.9秒差4着を確認。ただし距離戻りと同距離実績は関連する一つの材料で、独立した現在材料が不足。','8/9は①②に先着したが、9/19の1300mでは⑥に先着されている。','8/9の良1400m実績を再現すれば上振れ余地はあるが、展開・位置取りは不明。','直近1.7秒差8着、地方の通過順がなく距離変更による改善を断定できない。'],
 2:['今回良1400mは8/29の0.8秒差5着と同条件。直近も1400mであり距離替わりの新しい材料はない。','9/19は①⑤④⑪に先着したが、3.3秒差で上位との隔たりがある。','8/29の僅差を再現する必要があるが、差を縮める現在の変化は確認できない。','9/19の3.3秒差、8/9の3.9秒差。中央の通過順を地方の位置取りへ流用できない。'],
 1:['直近54kgから今回53kgへ1kg減。8/9良1400m1.1秒差5着もあるが、二つの材料だけで直近不振の反転を確定できない。','8/9は1.1秒差だが9/19同距離では3.5秒差7着となっている。','軽量で過去の1400m内容を再現する可能性は検討したが、脚質・調整過程は不明。','直近上がり43.1、3.5秒差。1kg減の効果と再現性は未確認。'],
 4:['1300mからではなく直近1400mを継続。8/30の1300m1.1秒差を今回距離へ結び付ける条件改善がない。','8/30は①⑭に先着したが、9/19の1400mではその二頭より後着。','1300mの相対実績を1400mへ再現する裏付けがなく到達筋は未確定。','1400mで3.9秒差と4.6秒差。6/25取止には走破能力の証拠がない。'],
 9:['1300mから1400mへ延長し8/8の良1400m4着を参照したが、現在の独立した改善材料はない。','8/30の1300mは0.7秒差で①④⑭に先着。一方直近は2.6秒差10着。','8/8の1400m内容を再現する必要があるが、直近の悪化を反転する状態証拠がない。','直近上がり44.5。前々走51kgから直近・今回54kgで、今回は軽量化ではない。'],
 7:['1300mから1400mへ延長するが、8/30同距離4.7秒差9着があり有利な条件戻りと確認できない。','9/19は⑫と同タイム1:27.9でも5着で⑫より後着、⑩とは1.2秒差。','佐賀1400mでの改善を確認できず具体的な上位到達筋は未確定。','良1400m4.7秒差、地方通過順なし。中央芝・1800m内容の直接換算は禁止。'],
 5:['直近から同じ1400mで斤量54kgも維持。騎手替わりは確認できるが能力改善の根拠にはしない。','9/19は①より先着したが同じ3.5秒差、上がり43.2で内容の強い反転材料はない。','同距離3.5秒差を縮める独立した現在材料がなく上位到達筋は確認不能。','近走900m2.5秒差、1300m1.7秒差と大きな改善を確認できない。'],
 11:['直近と同距離1400m、同斤量54kg。騎手替わりだけでは直近7.2秒差の反転根拠にならない。','8/29の1300m1.8秒差5着はあるが、1400mでは7.2秒差・4.3秒差。','1300mの内容を1400mへ接続する確認材料がなく到達筋は不明。','直近上がり46.0。大敗原因・調整・馬体重が欠損。']
};
const checked=(finding,evidence_refs)=>({status:'CHECKED',finding,evidence_refs});
const missing=finding=>({status:'MISSING',finding,evidence_refs:[]});
for(const c of p.audit.eye_candidate_audit){
 const r=context.runners.find(x=>x.horse_no===c.horse_no), last=r.recent_runs[0], rr=refs(r.horse_no), current=[context.race.current_source_ref,...rr];
 const completed=r.recent_runs.filter(x=>x.finish!==null), local=r.recent_runs.filter(x=>x.track==='佐賀');
 const pos=r.recent_runs.filter(x=>Number.isFinite(x.early_pos));
 const [upside_trigger,hidden_evidence,finish_path,risk]=cases[c.horse_no];
 Object.assign(c,{upside_trigger,hidden_evidence,finish_path,risk,eye_case:false,evidence_refs:rr});
 c.review_checks={
 distance_change:checked(`直近${last.distance}m→今回1400m。掲載1400m履歴: ${r.recent_runs.filter(x=>x.distance===1400).map(localFact).join(' / ')}`,current),
 track_change:checked(`直近は${last.track}、今回佐賀。確認できる掲載競馬場=${[...new Set(r.recent_runs.map(x=>x.track))].join('・')}。転入・転厩の正確な日付は不明。`,current),
 going_change:checked(`直近${last.going}→今回良。地方の良履歴=${r.recent_runs.filter(x=>x.going==='良'&&['佐賀','金沢','名古屋','園田'].includes(x.track)).map(localFact).join(' / ')||'掲載なし'}。芝とダートの時計を同列換算しない。`,current),
 class_change:missing(`今回class_name欠損。レース名はC2-26組、直近名=${last.race_name}。級の厳密な上下は未確認。`),
 promotion_demotion:missing(`今回C2-26組と掲載レース名だけから${r.horse_name}の昇降級を確定できない。`),
 weight_change:checked(`今回${r.weight_carried}kg、直近${last.weight_carried}kg。差=${Number(r.weight_carried)-Number(last.weight_carried)}kg。軽量効果の大きさは未確認。`,current),
 jockey_change:checked(`今回=${r.jockey}、直近=${last.jockey}。表記と変更の有無を確認しただけで、名前による能力加点は行わない。`,current),
 draw:missing(`${r.horse_name}の今回枠番はcontextにない。馬番から推測しない。`),
 running_style:pos.length?checked(`確認できた歴史上のearly_pos=${pos.map(x=>x.race_date+' '+x.track+' '+x.distance+'m '+x.early_pos).join(' / ')}。地方近走の位置取りはなく今回脚質へ転用しない。`,rr):missing(`${r.horse_name}の地方近走通過順がなく今回の脚質を確定できない。表示用ラベルから採点しない。`),
 pace_peers:missing(`全14頭の地方近走位置取りが揃わず、${r.horse_name}と同型馬の数・ペースを確認できない。`),
 margins:checked(`地方の着差と着順=${local.map(localFact).join(' / ')}。JRAの着差文字列は秒差ではなく数値化しない。取止は敗戦に数えない。`,rr),
 passing_order:pos.length?checked(`掲載位置取り=${pos.map(x=>x.race_date+' '+x.track+' '+x.early_pos+'→'+x.final_turn_pos).join(' / ')}。これらは当該過去走のみの記録で地方近走は欠損。`,rr):missing(`${r.horse_name}の掲載履歴に利用可能な通過順がない。`),
 final_section:checked(`上がり記録=${completed.map(x=>x.race_date+' '+x.track+' '+x.distance+'m '+x.final3f).join(' / ')}。異なる距離・場・馬場の値を直接能力換算しない。`,rr),
 trouble:missing(`${r.horse_name}の不利・出遅れ・進路等の公式記述は取得入力にない。着順から不利を創作しない。`),
 layoff_preparation:missing(`最新掲載日=${last.race_date}。当日までの間隔は計算できるが、休養理由・調整内容・叩き効果は未確認。`),
 current_suitability:checked(`${r.horse_name}について確認できる今回条件とリスク: ${p.runners.find(x=>x.horse_no===r.horse_no).reason}`,current),
 same_condition_history:checked(`佐賀・1400m・良の掲載実績=${r.recent_runs.filter(x=>x.track==='佐賀'&&x.distance===1400&&x.going==='良').map(localFact).join(' / ')||'掲載履歴内にはない'}。未掲載実績の不存在は断定しない。`,rr)
 };
}
// Current-upside comparisons, not baseline rank comparisons. No candidate has
// a demonstrated two-independent-signal current case; do not force a winner.
const pairReasons={
 '8:14':'⑧は7/18良1400m0.8秒差、⑭は8/9同条件0.9秒差。⑧は直近同距離4.5秒差、⑭は距離戻りだが直近1300m1.7秒差。異なる日の僅差だけで現在の反転優位を確定できない。',
 '2:8':'⑧は直近良1400m4.5秒差からの状態改善不明、②は8/29同条件0.8秒差でも直近3.3秒差。双方に現在の改善証拠がなく、古い着差だけで優位を決めない。',
 '1:8':'①には今回1kg減、⑧には7/18同距離0.8秒差。ただし①直近3.5秒差、⑧直近4.5秒差で、軽量と過去実績を比較して唯一の反転根拠にできない。',
 '4:8':'④は8/30の1300m1.1秒差だが直近1400m3.9秒差、⑧は過去良1400m0.8秒差から直近4.5秒差。距離適性の過去差と今の状態反転を分離し、上振れ優位は不明。',
 '8:9':'⑨は8/8良1400m2.0秒差4着から直近1300m2.6秒差10着、⑧は過去1400m0.8秒差から直近4.5秒差。どちらも直近悪化を説明できず現在の反転優位を確定できない。',
 '7:8':'⑦は直近1300m2.6秒差、前回良1400m4.7秒差。⑧は同距離で0.8秒差実績があるが直近4.5秒差。⑧の基礎距離実績を今回の独立した上振れ理由とは扱わない。',
 '5:8':'⑤は直近1400m3.5秒差で騎手替わり、⑧は直近良1400m4.5秒差で調整不明。騎手名や過去0.8秒差だけを理由に現在の一変優位を決められない。',
 '8:11':'⑪は直近1400m7.2秒差、⑧は4.5秒差。大敗幅の大小は基礎評価の材料であり、両者の今回の改善材料がないため上振れ勝者は決めない。',
 '2:14':'8/9良1400mは⑭0.9秒差、②3.9秒差。⑭の距離戻りと②の8/29僅差を検討したが、同一過去比較だけでは現在の独立二材料を満たす候補を確定できない。',
 '1:14':'8/9良1400mで⑭が①に先着、8/30良1300mでは①が⑭に先着。①の今回1kg減と⑭の距離戻りはあるが、相互の現在性・反転確度を確定できない。',
 '4:14':'8/30良1300mは④が⑭に先着、⑭には8/9良1400m0.9秒差がある。④の直近1400m3.9秒差と⑭の直近1300m1.7秒差だけから上振れ優位を決めない。',
 '9:14':'8/30良1300mは⑨が⑭に先着、9/19同距離は⑭が⑨に先着。双方1400m実績はあるが、逆転の原因・今回の改善証拠が欠け、優位は確定不能。',
 '7:14':'⑭は良1400m0.9秒差と距離戻り、⑦は前回同距離4.7秒差。⑭に距離の材料はあるが独立した現在材料がなく、基礎実績差を上振れ確定に流用しない。',
 '5:14':'⑭の8/9良1400m0.9秒差と⑤の直近1400m3.5秒差・騎手替わりを比較。距離戻りと騎手変更の効果は未確認で独立した二材料の優位を確定できない。',
 '11:14':'⑭は1400m戻りだが直近1300m1.7秒差、⑪は直近1400m7.2秒差。⑪の悪化原因も⑭の現在改善も不明で、低い基礎評価だけを反転材料にしない。',
 '1:2':'9/19同じ1400mで②5着3.3秒差、①7着3.5秒差。①1kg減と②良1400m0.8秒差歴はあるが、僅かな直接着差と軽量だけで上振れ優位を確定できない。',
 '2:4':'9/19同じ1400mで②が④に先着。②は良1400m0.8秒差歴、④は1300m1.1秒差歴。これは基礎距離評価で、今回の新しい反転材料は双方不足。',
 '2:9':'②は直近1400m3.3秒差、⑨は1300m2.6秒差10着。②同距離僅差歴と⑨距離延長を検討したが、日・距離の違う着差から現在の改善確度を決められない。',
 '2:7':'②は8/29良1400m0.8秒差、⑦は8/30同条件4.7秒差。異なるレースの差と転入前経歴では今回の独立した改善材料を確認できない。',
 '2:5':'9/19同じ1400mで②5着、⑤6着。⑤騎手替わりもあるが効果未確認。小さい直接差と名前では一変優位を支持できない。',
 '2:11':'9/19同じ1400mは②3.3秒差、⑪7.2秒差。②の良1400m実績は基礎評価へ反映済みであり、双方の今回変化の証拠は不足。',
 '1:4':'9/19同じ1400mは①が④に先着、8/30良1300mは④が①に先着。①1kg減は確認できるが、距離による逆転を説明する通過順・状態情報がない。',
 '1:9':'8/30良1300mは⑨0.7秒差、①1.4秒差。①は1kg減、⑨は1400m戻りだが直近2.6秒差10着。効果を比較できる現在の証拠が足りない。',
 '1:7':'①は1kg減だが直近1400m3.5秒差、⑦は直近1300m2.6秒差・前回1400m4.7秒差。軽量一材料だけで⑦との上振れ優位を確定しない。',
 '1:5':'9/19同じ1400mは⑤6着、①7着で同じ3.5秒差。①1kg減と⑤騎手替わりを比較したが、今回の効果・状態は不明で勝者を決めない。',
 '1:11':'同じ直近1400mで①3.5秒差、⑪7.2秒差。①1kg減だけでは独立二材料にならず、⑪大敗の原因も確認できない。',
 '4:9':'8/30良1300mで⑨が④に先着。今回1400mでは④直近3.9秒差、⑨過去2.0秒差だが直近1300m悪化。過去差と今回の改善可能性を同一視しない。',
 '4:7':'④直近1400m3.9秒差と⑦前回良1400m4.7秒差を比較したが、不同レースの秒差だけでは今回の一変材料を証明できない。④取止は比較に使わない。',
 '4:5':'9/19同じ1400mで⑤が④に先着。⑤騎手替わり、④距離継続だが、どちらも好走へ接続する独立二材料を確認できない。',
 '4:11':'9/19同じ1400mで④3.9秒差、⑪7.2秒差。基礎内容差はあっても今回の改善根拠がなく、一変候補の優位を決めない。',
 '7:9':'⑨は過去良1400m2.0秒差4着、⑦は同距離4.7秒差9着。⑨直近1300m2.6秒差10着と⑦同距離延長の不確実性を残し、現在上振れは比較不能。',
 '5:9':'⑨は1400mへ延長し過去4着歴、⑤は1400m継続と騎手替わり。⑨直近上がり44.5、⑤43.2だけでは条件の違いもあり反転優位は決められない。',
 '9:11':'⑨直近1300m2.6秒差、⑪直近1400m7.2秒差。⑨の過去1400m4着はあるが直近悪化原因が不明、⑪も現在改善材料がない。',
 '5:7':'⑦は1400m延長で前回同距離4.7秒差、⑤は直近同距離3.5秒差と騎手替わり。距離延長も騎手変更も効果未確認で上振れ優位を支持しない。',
 '7:11':'⑦前回良1400m4.7秒差、⑪直近稍重1400m7.2秒差。異なる馬場と日付の大敗幅では今回改善の独立根拠にならない。',
 '5:11':'9/19同じ1400mで⑤6着3.5秒差、⑪13着7.2秒差。両馬とも騎手替わりはあるが、その名前や基礎着差で反転候補を決めない。'
};
for(const pair of p.audit.eye_pairwise_comparison){const key=[...pair.horse_nos].sort((a,b)=>a-b).join(':');if(!pairReasons[key])throw Error('UNREVIEWED_PAIR_'+key);pair.reason=pairReasons[key];pair.evidence_refs=[...new Set(pair.horse_nos.flatMap(refs))];}
Object.assign(p.audit,{all_runners_checked:true,field_integrity_checked:context.field_integrity_checked,
 outside_top5_reaudited:true,eye_audit_specificity_guard:true,eye_selected_rank:null,
 eye_abstention_reason:'TOP5外9頭を17項目と36組で確認したが、独立した上振れ根拠を二つ以上持ち全相手に明確優位な候補を確認できない。⑭距離戻りと同距離実績は関連材料、①軽量と過去実績も直近悪化への橋渡しが不足。状態・地方通過順・枠が欠損し選出を見送る。'});
p.summary='佐賀1400mの実績と直接比較を優先し⑬③を上位。⑫⑩は距離と直近内容の長短を分離し、⑥は今回51kgも考慮。異なる競馬場・馬場の時計や中央着差文字列を秒差換算しない。S・A該当なし、EYE未選出。地方位置取り・枠・当日馬体重等が欠損し展開の断定はしない。';
const completed_at=new Date().toISOString();
const result=validateCompleted(p,context);
writeFileSync(new URL('completed-payload.json',dir),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
writeFileSync(new URL('validation-record.json',dir),JSON.stringify({race:context.race,started_at:start,
 completed_at,elapsed_seconds:(Date.parse(completed_at)-Date.parse(start))/1000,
 job_lease_until:'2026-10-10T11:15:53.864156+00:00',format_valid:result.format_valid,
 production_save_verified:false,production_save_performed:false,live_claim_rechecked:false,
 input_verification_source:'LOCAL MCP v9 returned field_integrity_checked=true; independent official re-fetch not performed',
 runner_audits:14,outside_candidates:9,outside_check_count:153,pair_count:36,
 exact_generation_source:'Human assessment recorded in evaluation-record.mjs; script only formats records',
 limitations:['JRA margin strings are not seconds','NAR recent positions absent','No condition/fitness inference from missing data','Display styles derive partly from old JRA history and are not used to rank','MCP format pass is not truth or production acceptance proof']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({format_valid:true,runner_audits:14,outside_checks:153,pairs:36,elapsed_seconds:(Date.parse(completed_at)-Date.parse(start))/1000}));
