/* LAB WATCH: read-only profiles; does not alter FROZEN rank/grade/EYE/bets. */
(function(host){
'use strict';
const profiles=Object.freeze({
'2026-10-13|名古屋|1|9':{
horse_name:'ドウリファー',checked_on:'2026-10-13',
evidence_state:'外部サイトの通算戦績は0戦表示。ただしNAR公式の個体IDと過去走の照合は未完了。',
factors:[
{title:'血統',note:'父Wootton Bassett、母父Galileo。血統背景は注目材料だが、名古屋ダート1500mでの走力は未検証。',source:'netkeiba｜競走馬データ',url:'https://db.sp.netkeiba.com/horse/2022110148/'},
{title:'管理厩舎',note:'愛知・角田輝也厩舎。所属情報は確認済みだが、この馬の実戦能力を保証するものではない。',source:'JBIS｜産駒情報',url:'https://www.jbis.or.jp/horse/0001132958/sire/progeny/'},
{title:'生産背景',note:'アイルランドのCoolmore生産馬。生産背景は参考情報で、能力ランクへの加点はしない。',source:'JBIS｜産駒情報',url:'https://www.jbis.or.jp/horse/0001132958/sire/progeny/'}
]}});
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function watchRunners(payload){const rows=Array.isArray(payload?.runners)?payload.runners:[];return rows.filter(r=>r?.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY'&&r?.status!=='CANCELLED'&&r?.status!=='EXCLUDED'&&r?.rank==null&&r?.grade==null);}
function profileFor(info,runner){const key=[info?.date||'',info?.track||'',String(info?.raceNo||''),String(runner?.horse_no||'')].join('|');const p=profiles[key];return p?.horse_name===runner?.horse_name?p:null;}
function safeUrl(url){try{const u=new URL(String(url));if(u.protocol==='https:'&&['db.sp.netkeiba.com','www.jbis.or.jp','umanity.jp'].includes(u.hostname))return u.href;}catch{}return'';}
function watchSectionHtml(payload,info){
const rows=watchRunners(payload);if(!rows.length)return'';
const entries=rows.map(r=>{const profile=profileFor(info,r);
const facts=profile?.factors?.length?'<div class="watch-facts">'+profile.factors.map(f=>{const href=safeUrl(f.url);return '<div class="watch-fact"><strong>＋ '+esc(f.title)+'</strong><p>'+esc(f.note)+'</p>'+(href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(f.source||'出典を見る')+' ↗</a>':'')+'</div>';}).join('')+'</div>':'<div class="watch-empty">血統・厩舎・調教などの確認済みプラス材料は、まだ登録されていません。</div>';
return '<details class="watch-card" data-watch-horse="'+esc(r.horse_no)+'"><summary class="watch-heading"><span class="watch-number">'+esc(r.horse_no)+'</span><div class="watch-horse"><strong>'+esc(r.horse_name)+'</strong><small>順位・評価なし　/　'+esc(r.sex_age||'性齢未確認')+'　/　'+esc(r.jockey||'騎手未確認')+'　/　'+(r.weight_carried==null?'斤量未確認':esc(r.weight_carried)+'kg')+'</small></div><span class="watch-toggle" aria-hidden="true"><span class="watch-label-open">詳細 ▼</span><span class="watch-label-close">閉じる ▲</span></span></summary><div class="watch-expanded"><p class="watch-explain">公的な過去走を確認できないため、S〜F・順位は付けず、参考情報だけを別枠で紹介します。</p>'+(profile?'<p class="watch-verification">'+esc(profile.evidence_state)+'　（資料確認日 '+esc(profile.checked_on)+'）</p>':'')+facts+'<div class="watch-disclaimer">※プラス材料は注目ポイントであり、好走予測や能力加点ではありません。人気・オッズ、事後結果は使っていません。</div></div></details>';
}).join('');
return '<section class="section" id="labWatchSection"><div class="section-label">LAB 🔍 WATCH / 未評価馬の注目材料</div>'+entries+'</section>';
}
function xCopyLines(payload,info){const rows=watchRunners(payload);if(!rows.length)return[];const lines=['','🔍 LAB WATCH｜評価保留・参考材料'];for(const r of rows){lines.push(String(r.horse_no)+'番 '+r.horse_name+'（過去走未確認／順位・グレードなし）');const p=profileFor(info,r);if(p?.factors?.length)lines.push(...p.factors.map(x=>'・'+x.title+'：'+x.note));else lines.push('・確認済みの参考材料は未登録');}lines.push('※LAB RANK・EYE・買い目には反映しない参考情報');return lines;}
host.LabWatch=Object.freeze({watchRunners,profileFor,watchSectionHtml,xCopyLines});
})(typeof window==='undefined'?{}:window);
