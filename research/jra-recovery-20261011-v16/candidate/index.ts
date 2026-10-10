
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { load } from "npm:cheerio@1.0.0";

const BASE="https://www.jra.go.jp";
const TRACKS={"01":"札幌","02":"函館","03":"福島","04":"新潟","05":"東京","06":"中山","07":"中京","08":"京都","09":"阪神","10":"小倉"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

const decode=(bytes)=>{
  try{return new TextDecoder("shift_jis").decode(bytes)}
  catch{return new TextDecoder().decode(bytes)}
};
const clean=(v)=>String(v??"").replace(/\s+/g," ").trim();
const parseCourseLayout=(value)=>{
  const normalized=clean(value).normalize("NFKC");
  const hasOuter=normalized.includes("外");
  const hasInner=normalized.includes("内");
  if(hasOuter&&hasInner) return "OUTER_INNER";
  if(hasOuter) return "OUTER";
  if(hasInner) return "INNER";
  if(normalized.includes("直線")) return "STRAIGHT";
  return null;
};
const uniq=(xs)=>[...new Set(xs)];
const parseDraw=($,row)=>{
  const direct=Number(clean($(row).find("td.waku").first().text()));
  if(Number.isInteger(direct)&&direct>=1&&direct<=8) return direct;
  const html=$(row).html()??"";
  const m=html.match(/(?:^|[\s"'=_-])waku[_-]?([1-8])(?:[\s"'<>_-]|$)/i)
    ?? html.match(/waku[^0-9]{0,8}([1-8])/i);
  return m?Number(m[1]):null;
};
const drawFromField=(horseNo,fieldSize)=>{
  if(!Number.isInteger(horseNo)||!Number.isInteger(fieldSize)||horseNo<1||fieldSize<1) return null;
  if(fieldSize<=8) return horseNo<=fieldSize?horseNo:null;
  const base=Math.floor(fieldSize/8);
  const extra=fieldSize%8;
  let upper=0;
  for(let frame=1;frame<=8;frame++){
    upper+=base+(frame>8-extra?1:0);
    if(horseNo<=upper) return frame;
  }
  return null;
};

const fetchCard=async(cname)=>{
  const res=await fetch(BASE+"/JRADB/accessD.html?CNAME="+encodeURIComponent(cname),{
    headers:{
      "User-Agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":"ja-JP,ja;q=0.9,en;q=0.7",
      "Referer":"https://www.jra.go.jp/",
      "Cache-Control":"no-cache"
    },
    redirect:"follow"
  });
  if(!res.ok) throw new Error("JRA HTTP "+res.status);
  return decode(new Uint8Array(await res.arrayBuffer()));
};

const parseCname=(cname)=>{
  const m=String(cname).match(/^pw01dde01(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})\/([0-9A-F]{2})$/i);
  if(!m) return null;
  const track=TRACKS[m[1]];
  if(!track) return null;
  return {
    track_code:m[1],
    track,
    race_no:Number(m[5]),
    race_date:m[6].slice(0,4)+"-"+m[6].slice(4,6)+"-"+m[6].slice(6,8)
  };
};

const cardLinks=(html)=>{
  const $=load(html);
  const found=[];
  $("a").each((_,a)=>{
    const s=($(a).attr("href")??"")+" "+($(a).attr("onclick")??"");
    const m=s.match(/pw01dde[^"'<>\s&]+\/[0-9A-Fa-f]{2}/g);
    if(m) found.push(...m);
  });
  return uniq(found);
};

const parsePast=(raw,ref)=>{
  const text=clean(raw).normalize("NFKC");
  if(!text) return null;
  const date=text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const finish=text.match(/\s(\d+)着\s/);
  const field=text.match(/\s(\d+)頭(\d+)番(\d+)番人気\s/);
  const course=text.match(/\s(\d{3,4})(芝|ダ|障)\s/);
  const time=text.match(/\s(\d+:\d{2}\.\d)\s/);
  const final3f=text.match(/3F\s*([0-9]+\.[0-9])/);
  const bw=text.match(/\s(\d{3})kg(?:\s|$)/);
  const goingMatch=text.match(/\s(良|稍重|重|不良)\s/);
  const margin=text.match(/\(([+\-]?[0-9]+(?:\.[0-9]+)?)\)\s*$/);
  const track=date ? clean(text.slice(date[0].length)).split(" ")[0] : null;
  return {
    raw:text,
    source_ref:ref||null,
    race_date:date ? date[1]+"-"+String(date[2]).padStart(2,"0")+"-"+String(date[3]).padStart(2,"0") : null,
    track,
    finish:finish?Number(finish[1]):null,
    field_size:field?Number(field[1]):null,
    horse_no:field?Number(field[2]):null,
    popularity:field?Number(field[3]):null,
    distance:course?Number(course[1]):null,
    surface:course ? (course[2]==="ダ"?"ダート":course[2]==="芝"?"芝":"障害") : null,
    time_raw:time?time[1]:null,
    going:goingMatch?goingMatch[1]:null,
    body_weight:bw?Number(bw[1]):null,
    final3f:final3f?Number(final3f[1]):null,
    margin_to_winner:margin?Number(margin[1]):null
  };
};

const parseCard=(html,cname)=>{
  const meta=parseCname(cname);
  if(!meta) throw new Error("invalid cname");
  const $=load(html);
  const raceName=clean($(".race_name").first().text());
  const courseText=clean($(".race_title .cell.course").first().text());
  const className=clean($(".race_title .cell.class").first().text());
  const pageText=clean($("body").text());
  const distanceMatch=courseText.replaceAll(",","").match(/(\d+)\s*メートル/);
  const isObstacle=raceName.includes("障害")||raceName.includes("ジャンプ")||className.includes("障害")||courseText.includes("障害");
  let surface=null;
  if(isObstacle) surface="障害";
  else if(courseText.includes("ダート")) surface="ダート";
  else if(courseText.includes("芝")) surface="芝";
  let turn=null;
  if(courseText.includes("・右")) turn="右";
  else if(courseText.includes("・左")) turn="左";
  else if(courseText.includes("・直線")) turn="直線";
  const weather=clean($(".race_header .weather .txt").first().text())||null;
  let going=null;
  if(surface==="芝") going=clean($(".race_header .turf .txt").first().text())||null;
  else if(surface==="ダート") going=clean($(".race_header .durt .txt").first().text())||null;
  const post=pageText.match(/発走時刻[:：]?\s*([0-9]{1,2}時[0-9]{2}分)/);

  const runners=[];
  $("table.basic.narrow-xy tbody tr").each((_,row)=>{
    const horseNo=Number(clean($(row).find("td.num").first().text()));
    const horseCell=$(row).find("td.horse").first();
    const horseLink=horseCell.find("a[href*='accessU']").first();
    const horseName=clean(horseLink.text());
    if(!Number.isInteger(horseNo)||horseNo<1||!horseName) return;

    const horseText=clean(horseCell.text()).normalize("NFKC");
    const jockeyText=clean($(row).find("td.jockey").first().text()).normalize("NFKC");
    const odds=horseText.match(/(\d+(?:\.\d+)?)\s*\((\d+)番人気\)/);
    const bw=horseText.match(/(\d{3})kg\s*\(([+\-]?\d+)\)/);
    const sexWeightJockey=jockeyText.match(/^([牡牝騸せん]+\d+)\/[^ ]+\s+([0-9]+(?:\.[0-9]+)?)kg\s+(.+)$/);
    const trainerText=clean(horseCell.find(".trainer").first().text()) ||
      (horseText.match(/([^ ]+(?:\s[^ ]+)?)\((美浦|栗東)\)/)?.[1] ?? "");

    const equipment=$(row).find("img")
      .map((__,img)=>$(img).attr("alt")??$(img).attr("title")??"")
      .get()
      .map((x)=>clean(String(x)))
      .filter((x)=>/(ブリンカー|チーク|メンコ|シャドーロール|ホライゾネット)/.test(x))
      .filter((x,i,a)=>x&&a.indexOf(x)===i)
      .join(" / ") || null;

    const pastRuns=[];
    for(const cls of ["p1","p2","p3","p4"]){
      const cell=$(row).find("td.past."+cls).first();
      if(!cell.length) continue;
      const raw=clean(cell.text());
      const ref=cell.find("a[href*='accessS']").first().attr("href")??null;
      const parsed=parsePast(raw,ref);
      if(parsed){
        const priorClass=clean(cell.find(".race_line .name").first().text());
        const priorClassDetail=clean(cell.find(".race_line .r_class").first().text());
        const priorJockey=clean(cell.find(".info_line1 .jockey").first().text());
        const priorWeightRaw=clean(cell.find(".info_line1 .weight").first().text()).normalize("NFKC");
        const priorWeight=Number(priorWeightRaw.replace(/[^0-9.]/g,""));
        const corners=cell.find(".corner_list li").map((__,li)=>{
          const n=Number(clean($(li).text()));
          return Number.isFinite(n)?n:null;
        }).get().filter((n)=>n!=null);
        parsed.race_class=priorClass||null;
        parsed.race_class_detail=priorClassDetail||null;
        parsed.jockey=priorJockey||null;
        parsed.weight_carried=Number.isFinite(priorWeight)?priorWeight:null;
        parsed.corner_positions=corners;
        parsed.early_pos=corners.length?corners[0]:null;
        parsed.final_turn_pos=corners.length?corners[corners.length-1]:null;
        parsed.pos_change=corners.length>1?corners[0]-corners[corners.length-1]:0;
        pastRuns.push(parsed);
      }
    }

    runners.push({
      horse_no:horseNo,
      draw:parseDraw($,row),
      horse_name:horseName,
      horse_ref:horseLink.attr("href")??null,
      sex_age:sexWeightJockey?.[1]??null,
      weight_carried:sexWeightJockey?Number(sexWeightJockey[2]):null,
      jockey:sexWeightJockey?.[3]??null,
      trainer:trainerText||null,
      body_weight:bw?Number(bw[1]):null,
      body_weight_diff:bw?Number(bw[2]):null,
      win_odds:odds?Number(odds[1]):null,
      popularity:odds?Number(odds[2]):null,
      equipment,
      past_runs:pastRuns
    });
  });

  for(const runner of runners){
    if(runner.draw==null) runner.draw=drawFromField(runner.horse_no,runners.length);
  }

  return {
    race:{
      race_key:meta.race_date.replaceAll("-","")+"_"+meta.track+"_"+meta.race_no+"R",
      cname,
      race_date:meta.race_date,
      track:meta.track,
      race_no:meta.race_no,
      race_name:raceName||null,
      race_type:isObstacle?"障害":"平地",
      class_name:className||null,
      surface,
      distance:distanceMatch?Number(distanceMatch[1]):null,
      going,
      weather,
      turn,
      course_text:courseText||null,
      course_layout:parseCourseLayout(courseText),
      post_time:post?.[1]??null,
      field_size:runners.length,
      source_checked_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },
    runners
  };
};

Deno.serve(async(req)=>{
  if(req.method!=="POST") return json({ok:false},405);
  let body:any={}; try{body=await req.json()}catch{}
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return json({ok:false,error:"config"},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const action=String(body.action??"");

  if(action==="discover"){
    const nowJst=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
    const seedResult=await db.from("jra_live_seeds")
      .select("*").eq("active",true).gte("race_date",nowJst)
      .order("race_date",{ascending:true}).limit(1).maybeSingle();
    if(seedResult.error) return json({ok:false,error:seedResult.error.message},500);
    if(!seedResult.data) {
      console.warn("JRA_NO_SEED", {from_race_date:nowJst});
      return json({ok:false,error:"JRA_NO_SEED",from_race_date:nowJst},503);
    }

    const targetDate=seedResult.data.race_date;
    const firstHtml=await fetchCard(seedResult.data.seed_cname);
    const firstLinks=uniq([seedResult.data.seed_cname,...cardLinks(firstHtml)]);

    // Current JRA pages may expose the other venue only as a link to one
    // representative race (not always race 1). Pick one representative
    // CNAME per venue first, then crawl each representative page to recover
    // the full race list for every venue on the target date.
    const repByTrack=new Map();
    for(const c of firstLinks){
      const m=parseCname(c);
      if(!m||m.race_date!==targetDate) continue;
      if(!repByTrack.has(m.track_code)) repByTrack.set(m.track_code,c);
    }
    const meetingSeeds=[...repByTrack.values()];

    const pages=await Promise.all(meetingSeeds.map(fetchCard));
    const discovered=uniq([...meetingSeeds,...pages.flatMap(cardLinks)])
      .map((c)=>({c,meta:parseCname(c)}))
      .filter((x)=>x.meta&&x.meta.race_date===targetDate);

    // Keep only one canonical CNAME for each venue/race number so the queue
    // does not process alternate page variants for the same race.
    const byRace=new Map();
    for(const x of discovered){
      const key=x.meta.track_code+"_"+x.meta.race_no;
      if(!byRace.has(key)) byRace.set(key,x);
    }
    const allLinks=[...byRace.values()];

    const rows=allLinks.map((x)=>({
      cname:x.c,
      race_date:x.meta.race_date,
      track_code:x.meta.track_code,
      track:x.meta.track,
      race_no:x.meta.race_no,
      status:"pending",
      updated_at:new Date().toISOString()
    }));
    if(rows.length){
      const q=await db.from("jra_live_queue").upsert(rows,{onConflict:"cname",ignoreDuplicates:true});
      if(q.error) return json({ok:false,error:q.error.message},500);
    }

    // A navigation link for a future date can be any race number. One
    // representative seed per future date is enough because the next
    // discover run will fan out across all venues and races.
    const futureByDate=new Map();
    for(const c of uniq([...firstLinks,...pages.flatMap(cardLinks)])){
      const m=parseCname(c);
      if(!m||m.race_date<=targetDate) continue;
      if(!futureByDate.has(m.race_date)) futureByDate.set(m.race_date,c);
    }
    const futureSeeds=[...futureByDate.entries()].map(([race_date,seed_cname])=>({
      race_date,
      seed_cname,
      source:"JRA公式出馬表navigation",
      active:true,
      updated_at:new Date().toISOString()
    }));
    if(futureSeeds.length){
      const futureSave=await db.from("jra_live_seeds").upsert(futureSeeds,{onConflict:"seed_cname",ignoreDuplicates:true});
      if(futureSave.error) {
        console.error("JRA_FUTURE_SEED_SAVE_FAILED", {race_date:targetDate});
        return json({ok:false,error:"JRA_FUTURE_SEED_SAVE_FAILED",race_date:targetDate,queued:rows.length},500);
      }
    }

    return json({
      ok:true,
      race_date:targetDate,
      meetings:meetingSeeds.map((c)=>parseCname(c)),
      queued:rows.length,
      future_seeds:futureSeeds.map((s)=>s.race_date)
    });
  }

  if(action==="sync_batch"){
    const batchSize=Math.max(1,Math.min(5,Number(body.batch_size)||4));
    const pending=await db.from("jra_live_queue").select("*")
      .in("status",["pending","error"]).lt("attempts",3)
      .order("race_date",{ascending:true}).order("track_code",{ascending:true}).order("race_no",{ascending:true})
      .limit(batchSize);
    if(pending.error) return json({ok:false,error:pending.error.message},500);
    const done=[]; const failed=[];

    for(const job of pending.data??[]){
      await db.from("jra_live_queue").update({
        status:"processing",attempts:Number(job.attempts||0)+1,updated_at:new Date().toISOString()
      }).eq("cname",job.cname);
      try{
        const parsed=parseCard(await fetchCard(job.cname),job.cname);
        if(
          parsed.runners.length===0 ||
          !parsed.race.surface ||
          !Number.isFinite(Number(parsed.race.distance))
        ) {
          throw new Error("JRA card content unavailable");
        }
        const raceUp=await db.from("jra_live_races")
          .upsert(parsed.race,{onConflict:"race_key"}).select("id").single();
        if(raceUp.error||!raceUp.data?.id) throw raceUp.error??new Error("race upsert");
        const raceId=raceUp.data.id;
        const runners=parsed.runners.map((r)=>({
          live_race_id:raceId,...r,
          source_checked_at:new Date().toISOString(),
          updated_at:new Date().toISOString()
        }));
        if(runners.length){
          const ru=await db.from("jra_live_runners").upsert(runners,{onConflict:"live_race_id,horse_no"});
          if(ru.error) throw ru.error;
        }
        const published=await db.rpc("publish_jra_live_race",{p_live_race_id:raceId});
        if(published.error) throw published.error;
        await db.from("jra_live_queue").update({
          status:"done",last_error:null,updated_at:new Date().toISOString()
        }).eq("cname",job.cname);
        done.push({race_key:parsed.race.race_key,runners:runners.length});
      }catch(e){
        const msg=String(e).slice(0,800);
        failed.push({cname:job.cname,error:msg});
        const transient=msg.includes("JRA card content unavailable");
        await db.from("jra_live_queue").update({
          status:transient?"pending":"error",
          attempts:transient?Number(job.attempts||0):Number(job.attempts||0)+1,
          last_error:msg,
          updated_at:new Date().toISOString()
        }).eq("cname",job.cname);
      }
    }
    return json({ok:failed.length===0,done,failed});
  }

  if(action==="status"){
    const [races,runners,queue,seeds]=await Promise.all([
      db.from("jra_live_races").select("id",{count:"exact",head:true}),
      db.from("jra_live_runners").select("id",{count:"exact",head:true}),
      db.from("jra_live_queue").select("status"),
      db.from("jra_live_seeds").select("race_date,seed_cname,active").order("race_date")
    ]);
    const qc={}; for(const r of queue.data??[]) qc[r.status]=(qc[r.status]??0)+1;
    return json({ok:true,races:races.count??0,runners:runners.count??0,queue:qc,seeds:seeds.data??[]});
  }

  return json({ok:false,error:"unsupported"},400);
});
