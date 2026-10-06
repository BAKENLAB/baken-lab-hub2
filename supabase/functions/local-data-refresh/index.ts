
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { load } from "npm:cheerio@1.0.0";

const REFRESH_KEY = Deno.env.get('LOCAL_DATA_REFRESH_KEY') ?? '';
if (!REFRESH_KEY) throw new Error('Missing refresh configuration');

const TRACK_CODES: Record<string, string> = {
  "盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21",
  "金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28",
  "高知":"31","佐賀":"32","門別":"36"
};

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const clean = (value: unknown) =>
  String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

const jstDate = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
};

const jstHour = () => new Date(Date.now() + 9 * 3600_000).getUTCHours();

function currentRunnerSlice(cells:string[]) {
  const pastIndex = cells.findIndex(cell => /\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}/.test(cell));
  return cells.slice(0, pastIndex >= 0 ? pastIndex : cells.length);
}
function currentRunnerStatus(cells:string[]) {
  const currentText = currentRunnerSlice(cells).join(" ");
  return /取消/.test(currentText) ? "CANCELLED" : /除外/.test(currentText) ? "EXCLUDED" : "ACTIVE";
}
function hasCurrentPositiveOdds(cells:string[]) {
  return currentRunnerSlice(cells).some(cell => /^\d+(?:\.\d+)?\s*\(\d+人気\)$/.test(clean(cell)));
}

function parseRaceList(html: string, date: string, track: string) {
  const $ = load(html);
  const timeByRace = new Map<number,string>();
  $("table tr").each((_i, el) => {
    const cells = $(el).find("th,td").map((_j,c)=>clean($(c).text())).get().filter(Boolean);
    const m = String(cells[0] || "").match(/^(\d+)R$/);
    const t = String(cells[1] || "").match(/^(\d{1,2}:\d{2})$/);
    if (m && t) timeByRace.set(Number(m[1]), t[1]);
  });

  const names = new Map<number,string>();
  $("a").each((_i,a)=>{
    const href = String($(a).attr("href") || "");
    if (!/TodayRaceInfo\/DebaTable/.test(href)) return;
    const m = href.match(/[?&]k_raceNo=(\d+)/);
    if (!m) return;
    const raceNo = Number(m[1]);
    const name = clean($(a).text());
    if (raceNo > 0 && name) names.set(raceNo, name);
  });

  return [...timeByRace.entries()]
    .filter(([raceNo]) => names.has(raceNo))
    .map(([raceNo,time]) => ({
      race_date: date,
      track,
      race_no: raceNo,
      circuit: "LOCAL",
      race_name: names.get(raceNo) || null,
      post_time: `${date}T${time}:00+09:00`,
      source: "NAR_OFFICIAL_SCHEDULE",
      updated_at: new Date().toISOString()
    }))
    .sort((a,b)=>a.race_no-b.race_no);
}

async function discoverSchedule(date: string) {
  const report:any[] = [];
  for (const [track, code] of Object.entries(TRACK_CODES)) {
    try {
      const url =
        "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceList?" +
        "k_babaCode=" + encodeURIComponent(code) +
        "&k_raceDate=" + encodeURIComponent(date.replaceAll("-","/"));
      const res = await fetch(url, {
        headers: {
          "User-Agent":"Mozilla/5.0 BAKEN-LAB/2.0",
          "Accept":"text/html,application/xhtml+xml",
          "Accept-Language":"ja-JP,ja;q=0.9",
          "Cache-Control":"no-cache"
        }
      });
      if (!res.ok) {
        report.push({track,ok:false,error:"http_"+res.status});
        continue;
      }
      const rows = parseRaceList(await res.text(), date, track);
      if (!rows.length) {
        report.push({track,ok:true,races:0});
        continue;
      }
      const { error } = await db.from("official_races").upsert(
        rows,
        { onConflict:"race_date,track,race_no,circuit" }
      );
      if (error) {
        report.push({track,ok:false,error:error.message});
        continue;
      }
      report.push({track,ok:true,races:rows.length});
    } catch (e) {
      report.push({track,ok:false,error:String((e as Error)?.message || e)});
    }
  }
  return report;
}

function parseOfficialDeba(html: string) {
  const $ = load(html);
  const rows: { index: number; cells: string[] }[] = [];

  $("table tr").each((index, element) => {
    const cells = $(element)
      .find("th,td")
      .map((_i, cell) => clean($(cell).text()))
      .get()
      .filter((cell) => cell !== "");
    if (cells.length) rows.push({ index, cells });
  });

  const mainRows = rows.filter((row) => {
    const jockeyIndex = row.cells.findIndex((cell) =>
      /^.+[（(][^）)]+[）)]$/.test(cell) &&
      !/^\(/.test(cell) &&
      !/^\d/.test(cell)
    );
    if (jockeyIndex < 1) return false;
    const numericBeforeName = row.cells
      .slice(0, jockeyIndex - 1)
      .filter((cell) => /^\d+$/.test(cell))
      .map(Number);
    const horseNo = numericBeforeName.at(-1);
    return Number.isInteger(horseNo) && Number(horseNo) >= 1 && Number(horseNo) <= 20;
  });

  const runners:any[] = [];

  for (let pos=0; pos<mainRows.length; pos++) {
    const main = mainRows[pos];
    const nextIndex = mainRows[pos+1]?.index ?? Number.MAX_SAFE_INTEGER;
    const jockeyIndex = main.cells.findIndex((cell) =>
      /^.+[（(][^）)]+[）)]$/.test(cell) &&
      !/^\(/.test(cell) &&
      !/^\d/.test(cell)
    );
    if (jockeyIndex < 1) continue;

    const horseName = clean(main.cells[jockeyIndex-1]);
    const jockeyRaw = clean(main.cells[jockeyIndex]);
    const jockey = jockeyRaw.replace(/\s*[（(][^）)]+[）)]\s*$/, "");
    const numericBeforeName = main.cells
      .slice(0,jockeyIndex-1)
      .filter((cell)=>/^\d+$/.test(cell))
      .map(Number);
    const horseNo = numericBeforeName.at(-1) ?? null;
    if (!Number.isInteger(horseNo) || horseNo < 1 || horseNo > 20 || !horseName) continue;

     const oddsCell = main.cells.find(cell => /^\d+(?:\.\d+)?\s*\(\d+人気\)$/.test(cell));
    const oddsMatch = oddsCell?.match(/^(\d+(?:\.\d+)?)\s*\((\d+)人気\)$/) || null;

    let weightCarried:number|null = null;
    let sexAge:string|null = null;
    const following = rows.filter(row => row.index > main.index && row.index < nextIndex);

    for (const row of following) {
      const rowSexAge = row.cells.find(cell => /^[牡牝セ騙セン]\d+$/.test(cell));
      if (!rowSexAge) continue;
      if (!sexAge) sexAge = rowSexAge.replace(/^セン/,"セ");

      for (const cell of row.cells) {
        const weightMatch = cell.match(/^(?:[▲△☆◇]\s*)?(\d{2}(?:\.\d+)?)\s+(?:\d+\s*-\s*){3}\d+/);
        if (!weightMatch) continue;
        const value = Number(weightMatch[1]);
        if (Number.isFinite(value) && value >= 40 && value <= 70) {
          weightCarried = value;
          break;
        }
      }
      if (weightCarried !== null) break;
    }

    const status=currentRunnerStatus(main.cells);
    if(status!=="ACTIVE" && hasCurrentPositiveOdds(main.cells)) throw new Error("CURRENT_STATUS_ODDS_CONFLICT");
    runners.push({
      horse_no:horseNo,
      horse_name:horseName,
      jockey:jockey || null,
      weight_carried:weightCarried,
      sex_age:sexAge,
      win_odds:oddsMatch ? Number(oddsMatch[1]) : null,
      popularity:oddsMatch ? Number(oddsMatch[2]) : null,
      status
    });
  }

  return Array.from(new Map(runners.map(r=>[r.horse_no,r])).values())
    .sort((a:any,b:any)=>a.horse_no-b.horse_no);
}

async function fetchOfficialRace(date:string, track:string, raceNo:number) {
  const code=TRACK_CODES[track];
  if(!code) return {ok:false,error:"unsupported_track",runners:[] as any[]};
  const url =
    "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?" +
    "k_babaCode="+encodeURIComponent(code)+
    "&k_raceDate="+encodeURIComponent(date.replaceAll("-","/"))+
    "&k_raceNo="+encodeURIComponent(String(raceNo));
  try {
    const response=await fetch(url,{headers:{
      "User-Agent":"Mozilla/5.0 BAKEN-LAB/2.0",
      "Accept":"text/html,application/xhtml+xml",
      "Accept-Language":"ja-JP,ja;q=0.9",
      "Cache-Control":"no-cache"
    }});
    if(!response.ok) return {ok:false,error:"http_"+response.status,runners:[] as any[]};
    const runners=parseOfficialDeba(await response.text());
    return {ok:runners.length>0,error:runners.length?null:"no_rows",runners};
  } catch(error) {
    return {ok:false,error:String((error as Error)?.message||error),runners:[] as any[]};
  }
}

Deno.serve(async(req:Request)=>{
  try {
    const url=new URL(req.url);
    if(url.searchParams.get("key")!==REFRESH_KEY) {
      return new Response(JSON.stringify({ok:false,error:"unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
    }
    const date=url.searchParams.get("date")||jstDate();
    const trackFilter=clean(url.searchParams.get("track"));
    const raceNoFilter=Number(url.searchParams.get("race_no")||0);
    const force=url.searchParams.get("force")==="1";
    const requestedMaxDetails=Number(url.searchParams.get("max_details")||"8");
    const maxDetailFetches=Number.isInteger(requestedMaxDetails)
      ? Math.max(1,Math.min(requestedMaxDetails,12))
      : 8;

    if(!force) {
      const hour=jstHour();
      if(hour<7||hour>22) {
        return new Response(JSON.stringify({ok:true,skipped:"outside_refresh_hours",date}),{headers:{"content-type":"application/json; charset=utf-8"}});
      }
    }

    const discovery = (!trackFilter && !raceNoFilter) ? await discoverSchedule(date) : [];

    let query=db.from("official_races")
      .select("race_date,track,race_no,circuit,post_time,field_payload,field_status,market_status")
      .eq("race_date",date).eq("circuit","LOCAL").order("post_time",{ascending:true});
    if(trackFilter) query=query.eq("track",trackFilter);
    if(Number.isInteger(raceNoFilter)&&raceNoFilter>0) query=query.eq("race_no",raceNoFilter);

    const {data:races,error:raceError}=await query;
    if(raceError) throw raceError;

    const now=Date.now();
    const report:any[]=[];
    let detailFetches=0;

    for(const race of races??[]) {
      const postMs=race.post_time?new Date(race.post_time).getTime():NaN;
      const minutesToPost=Number.isFinite(postMs)?Math.round((postMs-now)/60000):null;
      const existingRunners=Array.isArray(race.field_payload?.runners)?race.field_payload.runners:[];
      const activeExisting=existingRunners.filter((r:any)=>!["CANCELLED","EXCLUDED"].includes(String(r?.status||"ACTIVE")));
      const existingFieldComplete=activeExisting.length>0 && activeExisting.every((r:any)=>
        clean(r?.jockey) && r?.weight_carried!==null && r?.weight_carried!==undefined && r?.weight_carried!==""
      );
      const marketWindow=minutesToPost!==null && minutesToPost<=120 && minutesToPost>=-10;
      const detailWindow=minutesToPost!==null && minutesToPost<=240 && minutesToPost>=-10;

      if(!force && !detailWindow && !marketWindow) {
        report.push({track:race.track,race_no:race.race_no,skipped:"outside_detail_window",minutes_to_post:minutesToPost});
        continue;
      }

      if(!force && existingFieldComplete && !marketWindow) {
        report.push({track:race.track,race_no:race.race_no,skipped:"field_complete_outside_market_window"});
        continue;
      }

      if(detailFetches>=maxDetailFetches) {
        report.push({track:race.track,race_no:race.race_no,skipped:"detail_batch_limit",minutes_to_post:minutesToPost});
        continue;
      }
      detailFetches++;

      const fetched=await fetchOfficialRace(date,String(race.track),Number(race.race_no));
      if(!fetched.ok) {
        await db.from("official_races").update({
          field_status:existingFieldComplete?race.field_status:"RETRY",
          market_status:marketWindow?"RETRY":race.market_status,
          market_last_error:marketWindow?"OFFICIAL_REFRESH_"+fetched.error:null,
          updated_at:new Date().toISOString()
        }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","LOCAL");
        report.push({track:race.track,race_no:race.race_no,ok:false,error:fetched.error});
        continue;
      }

      const byNo=new Map(fetched.runners.map((r:any)=>[Number(r.horse_no),r]));
      const byName=new Map(fetched.runners.map((r:any)=>[clean(r.horse_name),r]));
      const mergedRunners=existingRunners.length
        ? existingRunners.map((r:any)=>{
            const o=byNo.get(Number(r.horse_no))||byName.get(clean(r.horse_name));
            if(!o) return r;
            return {...r,
              jockey:o.jockey||r.jockey||null,
              weight_carried:o.weight_carried??r.weight_carried??null,
              sex_age:o.sex_age||r.sex_age||null,
              status:o.status||r.status||"ACTIVE"
            };
          })
        : fetched.runners.map((r:any)=>({
            horse_no:r.horse_no,horse_name:r.horse_name,jockey:r.jockey,
            weight_carried:r.weight_carried,sex_age:r.sex_age,status:r.status||"ACTIVE"
          }));

      const active=mergedRunners.filter((r:any)=>!["CANCELLED","EXCLUDED"].includes(String(r?.status||"ACTIVE")));
      const jockeyCount=active.filter((r:any)=>clean(r.jockey)).length;
      const weightCount=active.filter((r:any)=>r.weight_carried!==null&&r.weight_carried!==undefined&&r.weight_carried!=="").length;
      const fieldComplete=active.length>0&&jockeyCount===active.length&&weightCount===active.length;

      const officialMarket=fetched.runners.filter((r:any)=>{
        const m=active.find((a:any)=>Number(a.horse_no)===Number(r.horse_no)||clean(a.horse_name)===clean(r.horse_name));
        return Boolean(m)&&Number.isFinite(Number(r.win_odds))&&Number(r.win_odds)>0&&Number.isInteger(Number(r.popularity))&&Number(r.popularity)>0;
      }).map((r:any)=>({horse_no:r.horse_no,horse_name:r.horse_name,win_odds:r.win_odds,popularity:r.popularity}));

      const marketComplete=active.length>0&&officialMarket.length===active.length;

      const nextPayload={
        ...(race.field_payload||{}),
        runners:mergedRunners,
        official_field_source:"NAR_OFFICIAL_DEBA",
        official_refreshed_at:new Date().toISOString(),
        data_quality:{
          active_runners:active.length,jockey_count:jockeyCount,weight_count:weightCount,
          field_complete:fieldComplete,market_count:officialMarket.length,market_complete:marketComplete
        }
      };

      const updateRace:any={
        field_payload:nextPayload,
        field_status:fieldComplete?"READY":"RETRY",
        field_fetched_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
      if(marketWindow||force) {
        updateRace.market_status=marketComplete?"READY":"RETRY";
        updateRace.market_last_error=marketComplete?null:"INCOMPLETE_MARKET_"+officialMarket.length+"_OF_"+active.length;
      }

      await db.from("official_races").update(updateRace)
        .eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","LOCAL");

      if((marketWindow||force)&&marketComplete) {
        const {error:marketError}=await db.from("official_market").upsert({
          race_date:date,track:race.track,race_no:race.race_no,circuit:"LOCAL",
          runners:officialMarket,source:"NAR_OFFICIAL_DEBA",captured_at:new Date().toISOString()
        },{onConflict:"race_date,track,race_no,circuit"});
        if(marketError) {
          report.push({track:race.track,race_no:race.race_no,market_error:marketError.message});
        }
      }

      report.push({
        track:race.track,race_no:race.race_no,field_complete:fieldComplete,
        active:active.length,jockey_count:jockeyCount,weight_count:weightCount,
        market_complete:marketComplete,market_count:officialMarket.length,minutes_to_post:minutesToPost
      });
    }

    return new Response(JSON.stringify({ok:true,date,discovery,processed:report.length,detail_fetches:detailFetches,max_detail_fetches:maxDetailFetches,report}),{
      headers:{"content-type":"application/json; charset=utf-8"}
    });
  } catch(error) {
    return new Response(JSON.stringify({ok:false,error:String((error as Error)?.message||error)}),{
      status:500,headers:{"content-type":"application/json; charset=utf-8"}
    });
  }
});

