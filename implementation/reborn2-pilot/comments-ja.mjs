const names={A:'能力',B:'条件適性',C:'相手比較',D:'展開耐性',E:'LAB EYE'};
const reasons={CURRENT_STATUS_UNCERTIFIED:'今回の出走状態を確認できていない',CURRENT_PARTICIPATION:'今回の出走状態を確認できていない',INDIVIDUAL_CROSSING_CLOCK_UNAVAILABLE:'個馬の通過時計がない',COURSE_VERSION_UNCERTIFIED:'コース形状・適用時期が未確認',NO_SUPPORTED_WIN_OR_PLACE_OR_AFFIRMATIVE_ADVERSE_DECISION:'勝ち筋・好走筋・明確な劣勢のいずれも判断材料が不足',DEPENDENT_ROUTE_OR_FIELD_BOUND:'展開・相手比較の成立範囲が未確定',REQUIRED_DIRECTIONAL_PROOF_NOT_ESTABLISHED:'能力発揮の方向を裏付ける材料が不足',CANCELLED:'出走取消'};
const gradeText={S:'複数の条件で勝ち筋を支持',A:'条件付きの勝ち筋を支持',B:'条件付きの好走筋を支持',C:'比較可能な条件で劣勢を支持',UNASSESSED:'判断に必要な証拠が不足'};
const statusText={ACTIVE:'出走確認済み（架空）',UNKNOWN:'出走状態未確認',CANCELLED:'出走取消'};
const rank=p=>p.rank?.length===2?p.rank[0]===p.rank[1]?p.rank[0]+'着相当':p.rank.join('〜')+'着相当':null;
const clock=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)?v.map(x=>Math.abs(x)/1000).sort((a,b)=>a-b).map(x=>x.toFixed(2)).join('〜')+'秒':null;
function pairs(p,dir){const a=p?.axes?.find(x=>x.axis==='A');return p?.own?.filter(q=>dir==='support'?q.finish?.[0]>0:q.finish?.[1]<0)??(a?.[dir]??[]).flatMap(q=>Array.isArray(q.value)?q.value:[]);}
const display=(id,roster)=>roster.find(r=>r.horseId===id||r.horseId.split('|').at(-1)===id)?.name??'比較対象馬';
const line=(p,dir,roster)=>{const q=pairs(p,dir).find(q=>clock(q.finish));if(!q)return '';return display(q.rival,roster)+'との相対時計差は'+clock(q.finish)+(dir==='support'?'先着側':'後着側')+'。';};
export function summarizeRunner(r,roster,mode){
 const findings=[],push=(kind,text,link)=>findings.push({kind,text,link});
 if(r.status==='CANCELLED'){push('保留','出走取消。能力評価は付けない。',{field:'holdReasons'});}
 else if(mode==='PARTIAL'){
  const fs=r.analysisItems.flatMap(i=>(i.partialFindings??[]).map((f,index)=>({...f,item:i.item,index})));
  for(const f of fs.filter(f=>['REPORTED_FINISH','REPORTED_INDIVIDUAL_FINAL600','DIRECT_REPORTED_COMPARISON','REPORTED_CONTEXT'].includes(f.type)).slice(0,6)){
   const v=f.value;let text;
   if(f.type==='REPORTED_FINISH')text='過去走の報告着順は'+v.finish+'着（登録'+v.declaredCount+'頭）。';
   if(f.type==='REPORTED_INDIVIDUAL_FINAL600')text='個別上がり3Fは'+(v.ms/1000).toFixed(1)+'秒。';
   if(f.type==='DIRECT_REPORTED_COMPARISON')text=display(v.rival,roster)+'との直接対戦では'+(v.order==='AHEAD'?'先着':v.order==='BEHIND'?'後着':'順位差未確定')+'。'+(v.final600DifferenceMs===null?'':v.final600DifferenceMs===0?'上がりの報告値は同じ。':'上がりは'+(Math.abs(v.final600DifferenceMs)/1000).toFixed(1)+'秒'+(v.final600DifferenceMs<0?'速い。':'遅い。'));
   if(f.type==='REPORTED_CONTEXT')text=v.state==='REPORTED_CONTEXT_MATCH'?'報告上の距離・馬場などは今回と一致。ただしコース形状やクラス水準の同等性は未確認。':'今回と過去の報告条件に差または不足があり、単純比較はできない。';
   push('過去走',text,{field:'analysisItems',item:f.item});
  }
  push('保留','今回の出走状態と個馬通過時計等を確認できないため、勝ち筋・好走筋とSABCは保留。',{field:'missingness'});
 }else{
  const paths=r.paths??[],win=paths.find(p=>r.winPaths.includes(p.id)),place=paths.find(p=>r.placePaths.includes(p.id)&&p.id!==win?.id&&p.state==='SUPPORTED_CONDITIONAL_PLACE')??(!win?paths.find(p=>r.placePaths.includes(p.id)):undefined),counter=paths.find(p=>r.counterPaths.includes(p.id)&&pairs(p,'counter').some(q=>clock(q.finish)))??paths.find(p=>r.counterPaths.includes(p.id));
  const pathLink=p=>({field:'paths',route:p.id});
  if(win)push('勝ち筋','過去の反応を今回と同条件で再現できる場合、'+(rank(win)??'勝ち筋')+'の比較範囲。'+line(win,'support',roster)+'実際の着順を保証するものではない。',pathLink(win));
  if(place)push('好走筋','比較可能な条件で'+(rank(place)??'好走筋')+'の範囲。'+line(place,'support',roster)+'展開が異なれば再現できない可能性がある。',pathLink(place));
  if(counter)push('反証','反証・再現性の確認では'+(rank(counter)?rank(counter)+'の範囲。':'反証または再現性の注意がある。')+line(counter,'counter',roster)+'支持材料だけで判断しない。',pathLink(counter));
  if(!win&&!place&&!counter)push('判断','確認可能な材料では今回の勝ち筋・好走筋を確定できない。',{field:'missingness'});
  if(r.holdReasons.length)push('保留',r.holdReasons.map(x=>reasons[x]??'追加確認が必要な分析条件').filter((x,i,a)=>a.indexOf(x)===i).join('。')+'。',{field:'holdReasons'});
 }
 const axes=r.axes.map(a=>{const support=a.supportingRoutes?.length??0,counter=a.counterRoutes?.length??0,unknown=a.unknownRoutes?.length??0;
 return {axis:a.axis,name:names[a.axis],state:mode==='PARTIAL'?(a.state==='PARTIAL_OBSERVATION'?'部分観測':'保留'):support&&counter?'支持・反証あり':support?'支持あり':counter?'反証あり':unknown?'保留':'確認なし',hasUnknown:unknown>0||!!a.held?.length};});
 return {horseId:r.horseId,no:r.no,name:r.name,status:r.status,statusLabel:statusText[r.status],grade:r.grade,gradeLabel:r.status==='CANCELLED'?'出走取消':gradeText[r.grade],axes,findings,winCount:r.winPaths.length,placeCount:r.placePaths.length,counterCount:r.counterPaths.length,eyeCount:r.eye.length,holdCount:r.holdReasons.length};
}
