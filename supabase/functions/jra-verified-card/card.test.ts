/**
 * Staged JRA card/parser regression tests.
 * Run with: deno test --allow-none supabase/functions/jra-verified-card/card.test.ts
 * Synthetic fixtures model verified 2026-10-17 official DOM features:
 * - frame image /JRADB/img/waku/X.png
 * - p.weight and p.jockey, strong.red odds
 * - optional blinker icon in the horse number td.
 * Real HTML end-to-end must also pass before any production deploy.
 */
import {load} from "npm:cheerio@1.0.0";
import {parseNumberedJraCard} from "./parse-numbered-card.mjs";
import {validateCurrentJraField} from "./validate-current-field.mjs";
const expect=(b,m)=>{if(!b)throw Error(m)};
const expectThrows=(fn,match)=>{let ok=false;try{fn()}catch(e){ok=String(e).includes(match)}expect(ok,"Expected "+match)};
const race=(field_size)=>({
 race_date:"2026-10-17",track:"新潟",race_no:1,race_name:"2歳未勝利",race_type:"平地",
 surface:"芝",distance:1600,field_size,post_time:"9時45分"
});
const frame=(n,count)=>count<=8?n:Math.min(8,Math.max(1,Math.ceil(n*8/count)));
function fixture(n,opts={}) {
 const rows=Array.from({length:n},(_,i)=>{
  const no=i+1,draw=frame(no,n),blink=opts.blink&&no===8;
  const extra=blink?'<span class="horse_icon blinker"><img src="/JRADB/img/kigo/icon_blinker.png" /></span>':"";
  const current=opts.noOdds&&no===3?"":'<div class="odds_line"><span class="num"><strong class="red">9.2</strong></span></div>';
  const img=opts.badDraw&&no===3?"/unknown.png":"/JRADB/img/waku/"+draw+".png";
  return '<tr><td class="waku"><img src="'+img+'"/></td>'+
    '<td class="num">'+no+extra+'</td>'+
    '<td class="horse"><a href="/JRADB/accessU.html?CNAME=H'+no+'">馬'+no+'</a>'+current+'</td>'+
    '<td class="jockey"><p class="weight">55.0<span>kg</span></p><p class="jockey">騎手'+no+'</p></td>'+
    '<td class="past">前走 取消</td></tr>';
 }).join("");
 return '<!doctype html><html lang="ja"><body>'+
  '<table class="basic narrow-xy mt20"><caption>'+
  '<div class="race_header">2026年10月17日（土）4回新潟1日 発走時刻：9時45分</div>'+
  '<div class="race_title"><div class="race_number"><img src="/JRADB/img/race_number_main/race_num_1.png"></div>'+
  '<span class="race_name">2歳未勝利</span><div class="cell course">1,600メートル（芝・左）</div></div>'+
  '</caption><tbody>'+rows+'</tbody></table></body></html>';
}
const live=n=>Array.from({length:n},(_,i)=>{
 const no=i+1;return {horse_no:no,horse_name:"馬"+no,horse_ref:"/JRADB/accessU.html?CNAME=H"+no,
 draw:frame(no,n),jockey:"騎手"+no,weight_carried:55};
});
const checkedAt="2026-10-17T08:42:45+09:00",nowMs=Date.parse("2026-10-17T08:43:00+09:00");
Deno.test("5 horse active current card roundtrip",()=>{
 const parsed=parseNumberedJraCard({html:fixture(5),load,expectedRace:race(5)});
 const verified=validateCurrentJraField({race:race(5),officialRows:parsed.rows,liveRows:live(5),checkedAt,nowMs});
 expect(verified.length===5,"5 validated");expect(verified.every(x=>x.status==="ACTIVE"),"all active");
});
Deno.test("18 horse card parses number cell including blinker image",()=>{
 const parsed=parseNumberedJraCard({html:fixture(18,{blink:true}),load,expectedRace:race(18)});
 expect(parsed.rows.length===18,"full count");expect(parsed.rows[7].horse_no===8,"blinker no 8");
 expect(parsed.rows[17].horse_no===18,"number 18"); 
});
Deno.test("no current odds is unverified ACTIVE even if prior run has odds",()=>{
 expectThrows(()=>parseNumberedJraCard({html:fixture(5,{noOdds:true}),load,expectedRace:race(5)}),"JRA_CURRENT_ACTIVE_STATUS_UNVERIFIED");
});
Deno.test("inferred or missing draw is prohibited",()=>{
 expectThrows(()=>parseNumberedJraCard({html:fixture(5,{badDraw:true}),load,expectedRace:race(5)}),"JRA_CURRENT_DRAW_NOT_PUBLISHED");
});
Deno.test("old card with wrong race number is rejected",()=>{
 const html=fixture(5).replace("race_num_1.png","race_num_4.png");
 expectThrows(()=>parseNumberedJraCard({html,load,expectedRace:race(5)}),"JRA_OFFICIAL_RACE_NUMBER_MISMATCH");
});
Deno.test("horse identity reference mismatch is rejected",()=>{
 const parsed=parseNumberedJraCard({html:fixture(5),load,expectedRace:race(5)});
 parsed.rows[0].horse_ref="/JRADB/accessU.html?CNAME=FAKE";
 expectThrows(()=>validateCurrentJraField({race:race(5),officialRows:parsed.rows,liveRows:live(5),checkedAt,nowMs}),"JRA_CURRENT_IDENTITY_MISMATCH");
});
Deno.test("stale source evidence is rejected",()=>{
 const parsed=parseNumberedJraCard({html:fixture(5),load,expectedRace:race(5)});
 expectThrows(()=>validateCurrentJraField({race:race(5),officialRows:parsed.rows,liveRows:live(5),checkedAt:"2026-10-17T08:39:00+09:00",nowMs}),"STALE_OR_FUTURE_JRA_PROOF");
});
