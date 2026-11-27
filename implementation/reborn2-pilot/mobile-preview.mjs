import {createServer} from 'node:http';
import {readManifest,readField} from './compact-store.mjs';
import assert from 'node:assert/strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=(h,field,extra={})=>'/detail?'+new URLSearchParams({horse:h,field,...extra});
const styles=':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b1017;color:#eef3fa;font:15px/1.6 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:16px}h1{font-size:28px;line-height:1.2}h2{font-size:18px;margin:0}h3{font-size:15px;margin:12px 0 5px;color:#a1c9ba}a{color:#abd3f4;overflow-wrap:anywhere}article{background:#131c26;border:1px solid #344051;border-radius:14px;margin:12px 0;padding:14px}.row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:center}.grade{font-weight:800;font-size:21px;color:#a9d8c6}.muted{font-size:12px;color:#a8b6c7}.notice{padding:10px;border:1px solid #b2975d;color:#f0d49f;border-radius:9px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{border:1px solid #3e4b5d;padding:5px 8px;border-radius:6px;font-size:12px}p{overflow-wrap:anywhere}.link{display:inline-flex;align-items:center;min-height:44px;padding:6px 8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#101722;padding:10px;border-radius:8px;font-size:12px}footer{font-size:12px;overflow-wrap:anywhere;color:#a8b6c7}@media(max-width:420px){main{padding:12px}article{padding:11px}.grade{font-size:18px}}';
const shell=(title,body)=>'<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+'</title><style>'+styles+'</style><main>'+body+'</main></html>';
const label={UNASSESSED:'未評価',S:'S',A:'A',B:'B',C:'C'};
const link=(h,field,text,extra={})=>'<a class="link" href="'+esc(href(h,field,extra))+'">'+esc(text)+'</a>';
export function renderList(s){
 const cards=[...s.runners].sort((a,b)=>a.no-b.no).map(h=>'<article data-horse="'+esc(h.horseId)+'"><div class="row"><b>'+h.no+'</b><div><h2>'+esc(h.name)+'</h2><div class="muted">'+esc(h.statusLabel)+'</div></div><span class="grade">'+esc(h.status==='CANCELLED'?'取消':label[h.grade])+'</span></div><p>'+esc(h.gradeLabel)+'</p><h3>5観点</h3><div class="chips">'+h.axes.map(a=>'<span>'+esc(a.name+'：'+a.state+(a.hasUnknown?'・未確認あり':''))+'</span>').join('')+'</div><h3>具体的分析コメント</h3>'+h.findings.map(f=>'<p><b>'+esc(f.kind)+'</b>　'+esc(f.text)+link(h.horseId,f.link.field,'根拠',f.link.route?{route:f.link.route}:f.link.item?{item:f.link.item}:{})+'</p>').join('')+'<h3>勝ち筋・好走筋</h3><p>勝ち筋 '+h.winCount+'／好走筋 '+h.placeCount+'／反証 '+h.counterCount+'</p>'+link(h.horseId,'paths','展開・経路の詳細')+link(h.horseId,'axes','5観点の根拠')+link(h.horseId,'eye','LAB EYE '+h.eyeCount+'分類')+link(h.horseId,'holdReasons','保留理由 '+h.holdCount+'件')+link(h.horseId,'analysisItems','全分析項目')+'</article>').join('');
 return shell('REBORN 2｜開発プレビュー','<header><div class="muted">BAKEN LAB｜馬券に、理由を。</div><h1>REBORN 2</h1><p>'+esc(s.race.label)+'｜全'+s.runners.length+'頭</p><p class="notice">架空材料のみ・正式評価ではありません。馬番順表示。詳細は必要な項目を開いた時に読み込みます。</p></header>'+cards+'<footer>固定エンジン '+esc(s.engineCommit)+'<br>分析保存 '+esc(s.snapshotDigest)+'</footer>');
}
const fieldNames={paths:'勝ち筋・好走筋・反証の経路',axes:'5観点',eye:'LAB EYE',holdReasons:'保留理由',analysisItems:'全分析項目',missingness:'不足材料'};
const allowed=Object.keys(fieldNames);
export async function openDetail(root,m,h,field,params){
 assert.ok(allowed.includes(field),'DETAIL_FIELD');
 const summary=m.summary.runners.find(r=>r.horseId===h);assert.ok(summary,'UNKNOWN_HORSE');
 let v=await readField(root,m,h,field);
 if(field==='axes'&&m.header.mode==='FULL'){
  // Full axis payload lives in the paths field. Use links instead of
  // embedding a duplicate route dataset.
  v=v.map(a=>({...a,detail:'各経路のaxesを参照'}));
 }
 const route=params.get('route'),item=params.get('item');
 if(route){assert.equal(field,'paths');v=v.find(x=>x.id===route);assert.ok(v,'UNKNOWN_ROUTE');}
 if(item){assert.equal(field,'analysisItems');v=v.find(x=>x.item===item);assert.ok(v,'UNKNOWN_ITEM');}
 const raw=JSON.stringify(v,null,2),size=12000,number=Math.max(1,Math.ceil(raw.length/size)),p=Number(params.get('page')??1);
 assert.ok(Number.isSafeInteger(p)&&p>=1&&p<=number,'PAGE');
 const extra={...(route?{route}:{}),...(item?{item}:{})};
 return shell(fieldNames[field],'<a class="link" href="/">一覧に戻る</a><h1>'+esc(summary.no+' '+summary.name)+'</h1><h2>'+esc(fieldNames[field])+'</h2><p class="muted">根拠データ（原文・'+p+'/'+number+'ページ）。全データは保存済み。'+(field==='axes'&&m.header.mode==='FULL'?' 各経路の根拠：':'')+'</p>'+(field==='axes'&&m.header.mode==='FULL'?link(h,'paths','経路別の詳細'):'')+'<pre>'+esc(raw.slice((p-1)*size,p*size))+'</pre><nav>'+(p>1?link(h,field,'前へ',{...extra,page:p-1}):'')+(p<number?link(h,field,'次へ',{...extra,page:p+1}):'')+'</nav>');
}
export async function startPreview(root,digest,port=0){
 const m=await readManifest(root,digest);
 let detailReads=0;
 const server=createServer(async(req,res)=>{
  const head={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"};
  try{assert.equal(req.method,'GET');const u=new URL(req.url,'http://127.0.0.1');
   let html;if(u.pathname==='/')html=renderList(m.summary);else if(u.pathname==='/detail'){detailReads++;html=await openDetail(root,m,u.searchParams.get('horse'),u.searchParams.get('field'),u.searchParams);}else{res.writeHead(404,head);res.end('Not found');return;}
   res.writeHead(200,head);res.end(html);
  }catch{res.writeHead(400,head);res.end('詳細の読み込みができません。');}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
 return {server,url:'http://127.0.0.1:'+server.address().port,detailReads:()=>detailReads};
}
