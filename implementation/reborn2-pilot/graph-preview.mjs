// Isolated read-only preview. No public deployment, no database, no writes.
// A process-local issued capability is required before server startup.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {reviewAllHorses,reviewHorseItems,reviewHorseItem,runNormalReview} from './native-graph-issuance.mjs';
import {describeItem} from './item-detail-ja.mjs';
const esc=x=>String(x??'未確認').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={OBSERVED:'観測値あり',MISSING:'欠損',HELD:'保留',CONFLICT:'矛盾',PARTIAL_ANALYZED:'部分分析済み',UNASSESSED:'未評価',UNKNOWN:'未確認',ACTIVE:'出走予定',CANCELLED:'取消'};
const text=x=>esc(state[x]??x);
const page=(title,body)=>'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+'</title><style>body{margin:0 auto;padding:16px;max-width:760px;font:16px/1.6 system-ui,sans-serif;background:#f5f6f7;color:#18222b}h1{font-size:22px}h2{font-size:18px}h3{font-size:16px}article,section{background:white;border:1px solid #dde2e6;border-radius:12px;padding:12px;margin:12px 0;overflow-wrap:anywhere}a{color:#17556f}small{color:#56636c}li{margin:6px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}details{margin:8px 0}nav{margin:8px 0}</style></head><body>'+body+'</body></html>';
export async function startGraphPreview(capability,{port=0,normal=false}={}){
 const overview=reviewAllHorses(capability),token=randomBytes(24).toString('hex'),base='/'+token;
 const candidate=normal?runNormalReview(capability):null;
 let detailReads=0;
 const link=(p,q={})=>base+p+(Object.keys(q).length?'?'+new URLSearchParams(q):'');
 const header=(candidate?'<p>REBORN 2 NORMAL v0.2 開発候補・正式採用前</p>':'')+(candidate?.analysisTiming?'<p>'+esc(candidate.retrospective?'遡及検証（発走後分析・予想公開不可）':'発走前分析候補')+'／材料時点 '+esc(candidate.analysisTiming.featureCutoff)+'／分析時刻 '+esc(candidate.analysisTiming.analysisAt)+'</p>':'')+'<h1>BAKEN LAB REBORN 2｜証拠閲覧</h1><p>独立プレビュー・'+esc(overview.receipt.scope)+'・総合評価未確定</p><nav><a href="'+base+'/">全頭一覧</a></nav>';
 const server=createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end(body);};
  try{
   if(req.method!=='GET'||!['127.0.0.1:'+server.address().port,'localhost:'+server.address().port].includes(req.headers.host))return send(403,'Forbidden');
   const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;
   if(p===base+'/'){
    const rows=overview.roster.map(h=>'<article data-horse="'+esc(h.horseId)+'"><h2>'+esc(h.horseNo)+'番 '+esc(h.displayName??h.horseId)+'</h2><p>'+text(h.status)+'・総合評価 '+text(h.grade)+(candidate?'／NORMAL候補 '+text(candidate.runners.find(q=>q.horse===h.horseId).candidateGrade):'')+'</p><p>所見あり '+h.findings.length+'項目／保留 '+h.held+'項目</p><a href="'+esc(link('/horse',{id:h.horseId}))+'">全115項目を見る</a></article>').join('');
    return send(200,page('全頭一覧',header+rows+'<section><h2>完全分析の不足材料</h2>'+overview.availability.requirements.map(q=>'<p>'+esc(q.need)+'：'+esc(q.why)+'</p>').join('')+'</section>'));
   }
   const id=u.searchParams.get('id');
   if(p===base+'/horse'){
    const h=overview.roster.find(h=>h.horseId===id);assert.ok(h);
    const n=candidate?.runners.find(q=>q.horse===id);const normalDetail=n?'<section><h3>NORMAL候補 '+text(n.candidateGrade)+'</h3><p>'+esc(n.decisionReason)+'</p><p>勝ち筋 '+n.winPaths.length+'／好走筋 '+n.placePaths.length+'／反証 '+n.counterPaths.length+'</p>'+n.axes.map(a=>'<p>'+esc(a.axis)+' '+esc(a.state)+' '+esc(a.reason)+'</p>').join('')+'<p>未確認相手：'+esc(n.currentAbility.unresolvedRivals?.join('、')||'なし')+'</p><details><summary>条件付き経路と反証・EYE</summary><pre>'+esc(JSON.stringify({win:n.winPaths,place:n.placePaths,counter:n.counterPaths,feedback:n.feedback,comparisons:n.comparisons},null,2))+'</pre></details></section>':'';
    return send(200,page('個馬詳細',header+'<h2>'+esc(h.displayName??id)+'</h2><p>評価 '+text(h.grade)+'</p>'+normalDetail+'<section><h3>5観点</h3>'+h.axes.map(a=>'<p>'+esc(a.axis)+'：'+esc(a.state)+'／'+a.count+'所見</p>').join('')+'</section><section><h3>全115項目</h3><ol>'+reviewHorseItems(capability,id).map(i=>'<li><a href="'+esc(link('/item',{id,item:i.item}))+'">'+esc(i.item)+' '+esc(i.name)+'</a> — '+text(i.state)+'</li>').join('')+'</ol></section>'));
   }
   if(p===base+'/item'){
    const item=u.searchParams.get('item'),d=reviewHorseItem(capability,id,item);detailReads++;
    const ni=candidate?.runners.find(q=>q.horse===id)?.items.find(q=>q.item===item);const normalItem=ni?'<section><h3>NORMAL計算 '+esc(ni.state)+'</h3><p>'+esc(ni.reason??'確認された所見')+'</p>'+ni.findings.map(f=>'<details><summary>'+esc(f.type)+'</summary><pre>'+esc(JSON.stringify({value:f.value,limits:f.limits,refs:f.refs},null,2))+'</pre></details>').join('')+'</section>':'';
    const desc=describeItem({item,state:d.state,partialFindings:d.findings,reason:d.hold});
    const roots=new Map([...d.roots,...d.materialTrace.roots].map(x=>[x.id,x]));
    const materials=d.materialTrace.trace.map(t=>'<li data-state="'+esc(t.state)+'">'+esc(t.eventId)+'／'+esc(t.field)+'：'+text(t.state)+' — '+esc(t.value===null?t.reason:JSON.stringify(t.value))+'<br><small>'+ (t.sourcePresent?'原本参照あり':'原本の該当項目なし')+'</small></li>').join('');
    const sources=[...roots.values()].filter(n=>n.kind.endsWith('_SOURCE_DOCUMENT')||n.kind.endsWith('_SOURCE_FIELD')).map(n=>'<li><details><summary>'+esc(n.kind)+' '+esc(n.payload.field??n.payload.id)+'</summary><pre>'+esc(JSON.stringify(n.payload,null,2))+'</pre><small>'+esc(n.id)+'</small></details></li>').join('');
    return send(200,page('項目別証拠',header+'<nav><a href="'+esc(link('/horse',{id}))+'">個馬詳細へ戻る</a></nav><h2>'+esc(d.item)+' '+esc(d.name)+'</h2><p>'+text(d.state)+'</p>'+normalItem+'<section><h3>成立した所見</h3>'+ (desc.rows.length?desc.rows.map(x=>'<p>'+esc(x.text)+'</p>').join(''):'<p>成立した所見なし。能力不足とは判定しない。</p>')+'</section><section><h3>原本材料・欠損・保留</h3><p>材料参照は分析成立の証明ではない。</p><ul>'+materials+'</ul><p>未供給項目：'+esc(d.materialTrace.absentFields.join('、')||'なし')+'</p><ul>'+d.materialHolds.map(q=>'<li>'+esc(q.need)+'：'+esc(q.why)+'</li>').join('')+'</ul><h3>原本の位置とハッシュ</h3><ul>'+sources+'</ul><small>原本本文は独立審査用ローカル保管で照合。ここでは原本識別子と位置を表示。</small></section>'));
   }
   return send(404,'Not found');
  }catch{return send(404,'Not found');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,url:'http://127.0.0.1:'+server.address().port+base+'/',detailReads:()=>detailReads,analysisReceipt:candidate?.analysisTiming?{timing:candidate.analysisTiming,analysisDigest:candidate.analysisDigest,sourceGraphDigest:candidate.sourceGraphDigest,approvalDigest:candidate.approvalDigest,formal:false}:null};
}
