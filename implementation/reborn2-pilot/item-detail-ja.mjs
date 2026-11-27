import {sourceMap} from './work04-intake.mjs';
const map=new Map(sourceMap.items.map(i=>[i.id.startsWith('EYE-')?i.id.replace('-',''):'RANK'+i.id,i]));
const stateName={HELD:'保留',PARTIAL_ANALYZED:'部分分析済み（総合判断は保留）',SUPPORT:'支持',COUNTER:'反証',MIXED:'支持と反証',UNKNOWN:'未確認',INSUFFICIENT_EVIDENCE:'証拠不足',OBSERVED:'観測あり',VERIFIED:'確認済み',NOT_APPLICABLE:'対象外'};
export function itemName(id){return map.get(id)?.name??id;}
export function itemState(i){const s=i.state??i.base;return stateName[s]??'分析材料・判定範囲を確認（原状態：'+String(s??'未記録')+'）';}
const valueText=v=>{
 if(v==null)return '未確認';
 if(typeof v==='number'||typeof v==='string'||typeof v==='boolean')return String(v);
 if(Array.isArray(v)&&v.every(x=>typeof x==='number'||typeof x==='string'))return v.join('／');
 return null;
};
const partial=(f)=>{const v=f.value??{};switch(f.type){
 case 'REPORTED_FINISH':return '過去走の報告着順 '+v.finish+'着／登録'+v.declaredCount+'頭。';
 case 'REPORTED_INDIVIDUAL_FINAL600':return '個別上がり3F '+(v.ms/1000).toFixed(1)+'秒。';
 case 'LITERAL_MARGIN':return '報告着差 '+v.literal+'（時計へ換算しない）。';
 case 'REPORTED_CONDITION_COMPARISON':return '過去 '+v.historical+'／今回 '+v.current+'。'+(v.state==='MATCHED_LITERAL'?'報告値一致。':'報告値相違。');
 case 'REPORTED_CONTEXT':return '報告条件 '+(v.state==='REPORTED_CONTEXT_MATCH'?'一致':'差または不足')+'。コース形状・クラス同等性は未確認。';
 case 'REPORTED_WEIGHT_CHANGE':return '過去斤量 '+v.pastG/1000+'kg／今回 '+v.currentG/1000+'kg。';
 case 'DIRECT_REPORTED_COMPARISON':return '対戦馬ID '+v.rival+'：本人'+v.finish+'着、相手'+v.rivalFinish+'着。'+(v.final600DifferenceMs==null?'上がり差未確認。':'本人－相手の上がり差 '+v.final600DifferenceMs+'ms。');
 case 'REPORTED_SECTION_VS_FINISH':case 'SECTION_FINISH_REVIEW':return '着順 '+v.finish+'着、報告上がり順位 '+v.reportedFinal600Rank.join('〜')+'位。余力や不利を断定しない。';
 case 'REPORTED_CURRENT_BODY_WEIGHT':return '報告馬体重 '+v.kg+'kg（増減 '+(v.deltaKg??'未確認')+'kg）。';
 default:return '観測材料 '+f.type+'。詳細原文を参照。';
}};
export function describeItem(i){
 const meta=map.get(i.item),rows=[];
 for(const f of i.partialFindings??[])rows.push({label:'観測',text:partial(f),refs:f.refs??[]});
 for(const f of i.semanticV47??[]){const v=valueText(f.value);rows.push({label:stateName[f.state]??'再分析',text:'検証対象 '+f.predicate+'。'+(v===null?'比較値は原文参照。':v+'。'),refs:f.refs??[]});}
 for(const f of i.routeReviewV47??[]){if(rows.length>=8)break;rows.push({label:'経路検証',text:'この項目に対応する展開・比較の検証。状態 '+(stateName[f.state]??f.state??'未確認')+'。',refs:f.refs??[],route:f.route});}
 if(i.v48?.grade)rows.unshift({label:'総合判断',text:'条件付き研究評価 '+(i.v48.grade==='UNASSESSED'?'未評価':i.v48.grade)+'。勝ち筋 '+i.v48.win.length+'、好走筋 '+i.v48.place.length+'、反証 '+i.v48.counter.length+'、保留 '+i.v48.held.length+'。',refs:[]});
 if(i.v48?.comparisons?.length)rows.unshift({label:'間接比較',text:'共通対戦馬を用いた条件付き比較 '+i.v48.comparisons.length+'件。比較対象・範囲は原文参照。',refs:[]});
 return {name:itemName(i.item),state:itemState(i),note:meta?.note??'追加材料は原文を確認。',rows,hold:i.reason??i.sourceReason??null,sourcePlanning:'供給候補の説明であり、確認済み能力の証明ではない。'};
}
