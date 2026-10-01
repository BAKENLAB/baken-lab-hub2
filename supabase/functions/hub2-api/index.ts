
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {validatePayload, predictionSnapshot, assertPredictionMatch, protocolPolicy, isTestPrediction, dataErrorPrediction} from "../../../prediction-contract.mjs";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

const asIsoDate = (value: string | null) => {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const raceKey = (x: any) => `${x.race_date}|${x.track}|${x.race_no}|${x.circuit ?? "LOCAL"}`;

// No shape guessing or reconstruction. Storage protocol is selected explicitly.
const normalizeDisplayPayload = (payload: any, version = 'CHAPPY_DIRECT_1') => {
  const policy=protocolPolicy(version);
  validatePayload(payload,policy.legacy,version);
  return structuredClone(payload);
};

const enrichPayloadWithField = (payload: any, fieldPayload: any) => {
  const base = structuredClone(payload);
  const fieldRows = Array.isArray(fieldPayload?.runners) ? fieldPayload.runners : [];
  if (!fieldRows.length || !Array.isArray(base.runners)) return base;

  const byNo = new Map(fieldRows.map((m: any) => [Number(m.horse_no), m]));

  base.runners = base.runners.map((r: any) => {
    const m = byNo.get(Number(r?.horse_no));
    if (!m) return r;
    const next = { ...r };
    if (m.jockey !== null && m.jockey !== undefined && m.jockey !== "") next.jockey = m.jockey;
    if (m.weight_carried !== null && m.weight_carried !== undefined && m.weight_carried !== "") next.weight_carried = m.weight_carried;
    if (m.sex_age !== null && m.sex_age !== undefined && m.sex_age !== "") next.sex_age = m.sex_age;
    if (m.trainer !== null && m.trainer !== undefined && m.trainer !== "") next.trainer = m.trainer;
    return next;
  });

  return base;
};

const enrichPayloadWithMarket = (payload: any, market: any) => {
  const base = structuredClone(payload);
  const marketRows = Array.isArray(market?.runners) ? market.runners : [];
  if (!marketRows.length || !Array.isArray(base.runners)) return base;

  const byNo = new Map(marketRows.map((m: any) => [Number(m.horse_no), m]));

  base.runners = base.runners.map((r: any) => {
    const m = byNo.get(Number(r?.horse_no));
    if (!m) return r;
    const next = { ...r };
    if (m.popularity !== null && m.popularity !== undefined && m.popularity !== "") next.popularity = m.popularity;
    if (m.win_odds !== null && m.win_odds !== undefined && m.win_odds !== "") next.win_odds = m.win_odds;
    return next;
  });

  return base;
};


const CIRCLED = ["","①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];

const betNums = (value: any): number[] => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flat(Infinity).map(Number).filter((n:any)=>Number.isInteger(n)&&n>0&&n<=20);
  if (typeof value === "number") return Number.isInteger(value)&&value>0&&value<=20 ? [value] : [];
  const s = String(value);
  const out:number[] = [];
  for (let i=1;i<CIRCLED.length;i++) {
    let pos=0;
    while ((pos=s.indexOf(CIRCLED[i],pos))>=0) { out.push(i); pos+=CIRCLED[i].length; }
  }
  if (out.length) return out;
  for (const m of s.matchAll(/\d{1,2}/g)) {
    const n=Number(m[0]);
    if (n>=1&&n<=20) out.push(n);
  }
  return out;
};

const uniqNums = (v:any) => [...new Set(betNums(v))];
const horseMark = (n:any) => {
  const x=Number(n);
  return Number.isInteger(x)&&x>=1&&x<CIRCLED.length ? CIRCLED[x] : String(n ?? "");
};
const marks = (v:any, sep="・") => uniqNums(v).map(horseMark).join(sep);
const ticketType = (b:any) => String(b?.type ?? b?.ticket_type ?? "").trim();

const textGroups = (v:any): number[][] => {
  const s=String(v ?? "").trim();
  if (!s) return [];
  const parts = s.includes("→") ? s.split("→") : s.includes("－") ? s.split("－") : s.includes("-") ? s.split("-") : [];
  return (parts.length ? parts : [s]).map(betNums).filter((x:any[])=>x.length);
};

const explicitCombos = (b:any): number[][] => {
  if (!b || typeof b!=="object") return [];
  if (Array.isArray(b.combinations) && b.combinations.length) {
    return b.combinations.map((x:any)=>uniqNums(x)).filter((x:any[])=>x.length);
  }
  if (Array.isArray(b.selections) && b.selections.some((x:any)=>Array.isArray(x))) {
    return b.selections.map((x:any)=>uniqNums(x)).filter((x:any[])=>x.length);
  }
  return [];
};

const ticketGroups = (b:any): number[][] => {
  if (!b || typeof b!=="object") return [];
  if (Array.isArray(b.structure)) return b.structure.map((x:any)=>uniqNums(x)).filter((x:any[])=>x.length);
  if (typeof b.structure==="string") return textGroups(b.structure);
  if (typeof b.selection==="string") return textGroups(b.selection);
  if (b.first!==undefined || b.second!==undefined || b.third!==undefined) {
    return [uniqNums(b.first),uniqNums(b.second),uniqNums(b.third)].filter((x:any[])=>x.length);
  }
  if (b.axis!==undefined && (b.partners!==undefined || b.others!==undefined)) {
    return [uniqNums(b.axis),uniqNums(b.partners ?? b.others)].filter((x:any[])=>x.length);
  }
  const combos=explicitCombos(b);
  if (combos.length) return combos;
  const direct = b.horses ?? b.selections;
  return direct!==undefined ? [uniqNums(direct)].filter((x:any[])=>x.length) : [];
};

const formatBetText = (b:any) => {
  if (typeof b==="string") return b.trim();
  if (!b || typeof b!=="object") return String(b ?? "").trim();
  if (b.text || b.label) return String(b.text ?? b.label).trim();

  const type=ticketType(b) || "買い目";
  let choice="";

  if (typeof b.selection==="string" && b.selection.trim()) choice=b.selection.trim();
  else if (typeof b.structure==="string" && b.structure.trim()) choice=b.structure.trim();
  else if (explicitCombos(b).length) {
    const sep=(type.includes("馬単")||type.includes("3連単"))?"→":"－";
    choice=explicitCombos(b).map((x:any)=>marks(x,sep)).join(" / ");
  }
  else if (b.axis!==undefined && (b.partners!==undefined || b.others!==undefined)) {
    const a=marks(b.axis), p=marks(b.partners ?? b.others);
    choice=a&&p ? a+"－"+p : a||p;
  } else if (b.first!==undefined || b.second!==undefined || b.third!==undefined) {
    const labels=type.includes("3連単")?["1着","2着","3着"]:["1列目","2列目","3列目"];
    choice=[b.first,b.second,b.third].map((x:any,i:number)=>marks(x)?labels[i]+" "+marks(x):"").filter(Boolean).join(" / ");
  } else if (Array.isArray(b.structure)) {
    const labels=type.includes("3連単")?["1着","2着","3着"]:["1列目","2列目","3列目"];
    choice=b.structure.map((x:any,i:number)=>(labels[i] ?? ((i+1)+"列目"))+" "+marks(x)).join(" / ");
  } else {
    const g=ticketGroups(b);
    if (g.length===1) choice=marks(g[0]);
    else if (g.length>1) choice=g.map((x:any)=>marks(x)).join(type.includes("3連単")?" → ":"－");
  }

  const pts=Number(b.points);
  return (type + (choice ? "　"+choice : "") + (Number.isFinite(pts)&&pts>0 ? "　"+pts+"点" : "")).trim();
};

const displayBets = (bets:any[]) => (Array.isArray(bets)?bets:[]).map((b:any)=>typeof b==="object"&&b!==null ? {...b,text:formatBetText(b)} : b);

const payoutKeyForTicket = (b:any) => {
  const t=ticketType(b);
  if (t.includes("3連単")) return "trifecta";
  if (t.includes("3連複")) return "trio";
  if (t.includes("馬単")) return "exacta";
  if (t.includes("馬連")) return "quinella";
  if (t.includes("ワイド")) return "wide";
  if (t.includes("複勝")) return "place";
  if (t.includes("単勝")) return "win";
  if (t.includes("枠連")) return "bracket_quinella";
  return "";
};

const containsAll = (pool:number[], vals:number[]) => vals.every(n=>pool.includes(Number(n)));
const permutationCover = (groups:number[][], vals:number[]) => {
  if (groups.length < vals.length) return false;
  const used=Array(groups.length).fill(false);
  const dfs=(i:number):boolean=>{
    if (i>=vals.length) return true;
    for (let g=0;g<groups.length;g++) {
      if (used[g] || !groups[g].includes(Number(vals[i]))) continue;
      used[g]=true;
      if (dfs(i+1)) return true;
      used[g]=false;
    }
    return false;
  };
  return dfs(0);
};

const ticketCovers = (b:any, combo:number[]) => {
  const t=ticketType(b), nums=combo.map(Number), groups=ticketGroups(b), g0=groups[0] ?? [];
  if (!nums.length) return false;

  const combos=explicitCombos(b);
  if (combos.length) {
    return combos.some((a:any[])=>{
      return (t.includes("馬単")||t.includes("3連単"))
        ? a.length===nums.length && a.every((n:any,i:number)=>n===nums[i])
        : a.length===nums.length && containsAll(a,nums);
    });
  }

  if (t.includes("単勝")||t.includes("複勝")) return g0.includes(nums[0]);

  if (t.includes("馬連")||t.includes("ワイド")) {
    if (t.includes("BOX")||groups.length===1) return containsAll(g0,nums);
    if (b.axis!==undefined && (b.partners!==undefined||b.others!==undefined)) {
      const a=uniqNums(b.axis),p=uniqNums(b.partners ?? b.others);
      return (a.includes(nums[0])&&p.includes(nums[1]))||(a.includes(nums[1])&&p.includes(nums[0]));
    }
    return groups.length>=2 && permutationCover(groups.slice(0,2),nums);
  }

  if (t.includes("馬単")) {
    if (t.includes("BOX")||groups.length===1) return containsAll(g0,nums);
    return groups.length>=2 && groups[0].includes(nums[0]) && groups[1].includes(nums[1]);
  }

  if (t.includes("3連複")) {
    if (t.includes("BOX")||groups.length===1) return containsAll(g0,nums);
    if (t.includes("1頭軸") && b.axis!==undefined) {
      const a=uniqNums(b.axis),o=uniqNums(b.others ?? b.partners);
      return nums.some(n=>a.includes(n)) && nums.filter(n=>!a.includes(n)).every(n=>o.includes(n));
    }
    return groups.length>=3 && permutationCover(groups.slice(0,3),nums);
  }

  if (t.includes("3連単")) {
    if (t.includes("BOX")||groups.length===1) return containsAll(g0,nums);
    return groups.length>=3 && groups[0].includes(nums[0]) && groups[1].includes(nums[1]) && groups[2].includes(nums[2]);
  }

  return false;
};

const normalizeResultForDisplay = (result:any, bets:any[]) => {
  const base=result && typeof result==="object" ? {...result} : {};
  const payouts=base.payouts && typeof base.payouts==="object" ? {...base.payouts} : {};

  for (const [key,raw] of Object.entries(payouts)) {
    const arr=Array.isArray(raw)?raw:[raw];
    payouts[key]=arr.map((item:any)=>item&&typeof item==="object"
      ? {...item,yen:item.yen ?? item.payout_yen ?? item.payout ?? item.amount ?? null}
      : item);
  }

  const hits:any[]=[];
  for (const b of Array.isArray(bets)?bets:[]) {
    const key=payoutKeyForTicket(b);
    const raw=(payouts as any)[key];
    if (!key || !raw) continue;
    for (const item of (Array.isArray(raw)?raw:[raw])) {
      const combo=betNums(item?.combination ?? item?.horses ?? "");
      if (!combo.length || !ticketCovers(b,combo)) continue;
      const yen=Number(item?.yen ?? item?.payout_yen ?? item?.payout ?? item?.amount);
      hits.push({
        horses:[formatBetText(b)+(item?.combination?"（"+String(item.combination)+"的中）":"")],
        yen:Number.isFinite(yen)&&yen>0?yen:null
      });
    }
  }

  if (hits.length) (payouts as any)["🎯 推奨買い目的中"]=hits;
  base.payouts=payouts;
  return base;
};

const mapOfficial = (row: any, market: any = null, betPlan: any = null, fieldPayload: any = null) => {
  const saved = normalizeDisplayPayload(row.payload,row.protocol_version);
  const payload = enrichPayloadWithMarket(enrichPayloadWithField(saved, fieldPayload), market);
  assertPredictionMatch(saved, payload);
  if (betPlan?.payload && typeof betPlan.payload === "object") {
    payload.bets = displayBets(Array.isArray(betPlan.payload.bets) ? betPlan.payload.bets : []);
    payload.bet_strategy = betPlan.payload.bet_strategy ?? payload.bet_strategy ?? null;
  }
  return {
  id: row.id,
  race_date: row.race_date,
  track: row.track,
  race_no: row.race_no,
  race_name: row.race_name,
  circuit: row.circuit,
  post_time: row.post_time,
  protocol_version: row.protocol_version,
  model_label: row.model_label,
  source: row.source,
  status: row.status,
  predicted_at: row.predicted_at,
  frozen_at: row.frozen_at,
  payload,
  market_captured_at: market?.captured_at ?? null,
  bet_status: betPlan?.status ?? null,
  bet_decided_at: betPlan?.decided_at ?? null,
  integrity: {version:1, prediction_id:row.id, source:'OFFICIAL_SAVED', saved:predictionSnapshot(saved)},
  legacy: false,
  };
};

const mapLegacy = (row: any) => { const mapped = ({
  id: row.id,
  race_date: row.race_date,
  track: row.track,
  race_no: row.race_no,
  race_name: row.race_name,
  circuit: "LOCAL",
  post_time: null,
  protocol_version: "CHAT_PRE_RACE_LEGACY",
  model_label: "ChatGPT",
  source: row.source ?? "CHAT_PRE_RACE",
  status: "FROZEN",
  predicted_at: row.predicted_at,
  frozen_at: row.created_at,
  payload: {
    runners: [],
    top5: Array.isArray(row.picks) ? row.picks : [],
    eye: row.eye ?? null,
    bets: [],
    summary: row.note ?? null,
    legacy: true,
  },
  market_captured_at: null,
  legacy: true,
});
  validatePayload(mapped.payload, true, 'CHAT_PRE_RACE_LEGACY');
  return {...mapped, integrity:{version:1, prediction_id:row.id, source:'LEGACY_ADAPTER', saved:predictionSnapshot(mapped.payload)}};
};

const safeOfficial = (row:any, market:any=null, bet:any=null, field:any=null) => {
  try {
    if (isTestPrediction(row)) throw new Error('DATA ERROR: test prediction excluded');
    return mapOfficial(row,market,bet,field);
  } catch(e) {return dataErrorPrediction(row,e);}
};
const safeLegacy = (row:any) => {
  try {
    if (isTestPrediction(row)) throw new Error('DATA ERROR: test prediction excluded');
    return mapLegacy(row);
  } catch(e) {return dataErrorPrediction({...row,circuit:'LOCAL',protocol_version:'CHAT_PRE_RACE_LEGACY'},e);}
};

Deno.serve(async (req: Request) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(req.method)) return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "server_config" }, 500);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const action = String(url.searchParams.get("action") ?? body.action ?? "health").trim();

  if (action === "health") {
    return json({
      ok: true,
      service: "BAKEN LAB HUB 2.0",
      mode: "DISPLAY_ONLY",
      prediction_owner: "ChatGPT",
      hub_reorders_prediction: false,
      market_is_separate: true,
      race_registry: true,
      queue_ready: true,
      time: new Date().toISOString(),
    });
  }

  if (action === "list") {
    const date = asIsoDate(url.searchParams.get("date") ?? body.date);
    if (!date) return json({ ok: false, error: "invalid_date" }, 400);

    const { data: official, error } = await db
      .from("official_predictions")
      .select("id,race_date,track,race_no,race_name,circuit,post_time,protocol_version,model_label,source,status,predicted_at,frozen_at,payload")
      .eq("race_date", date)
      .order("circuit", { ascending: true })
      .order("track", { ascending: true })
      .order("race_no", { ascending: true });

    if (error) return json({ ok: false, error: "prediction_read_failed" }, 500);

    const [{ data: markets, error: marketsError }, { data: betPlans, error: betsError }, { data: raceFields, error: fieldsError }] = await Promise.all([
      db
        .from("official_market")
        .select("race_date,track,race_no,circuit,runners,source,captured_at")
        .eq("race_date", date),
      db
        .from("official_bet_plans")
        .select("race_date,track,race_no,circuit,status,payload,market_captured_at,decided_at")
        .eq("race_date", date),
      db
        .from("official_races")
        .select("race_date,track,race_no,circuit,field_payload")
        .eq("race_date", date)
    ]);

    if (marketsError || betsError || fieldsError) return json({ok:false,error:'SYSTEM ERROR: related_data_read_failed'},500);
    const marketByKey = new Map((markets ?? []).map((m: any) => [raceKey(m), m]));
    const betByKey = new Map((betPlans ?? []).map((b: any) => [raceKey(b), b]));
    const fieldByKey = new Map((raceFields ?? []).map((r: any) => [raceKey(r), r?.field_payload ?? null]));
    const officialMapped = (official ?? []).filter((r:any)=>!isTestPrediction(r)).map((r: any) =>
      safeOfficial(
        r,
        marketByKey.get(raceKey(r)) ?? null,
        betByKey.get(raceKey(r)) ?? null,
        fieldByKey.get(raceKey(r)) ?? null
      )
    );
    const existingKeys = new Set(officialMapped.map((r: any) => `${r.race_date}|${r.track}|${r.race_no}`));

    const { data: legacy, error: legacyError } = await db
      .from("chappy_predictions")
      .select("id,race_date,track,race_no,race_name,picks,eye,note,source,predicted_at,created_at")
      .eq("race_date", date)
      .order("track", { ascending: true })
      .order("race_no", { ascending: true });

    if (legacyError) return json({ok:false,error:'SYSTEM ERROR: legacy_prediction_read_failed'},500);
    const legacyMapped = (legacy ?? [])
      .filter((r:any)=>!isTestPrediction(r))
      .map(safeLegacy)
      .filter((r: any) => !existingKeys.has(`${r.race_date}|${r.track}|${r.race_no}`));

    const predictions = [...officialMapped, ...legacyMapped];
    const predictionByKey = new Map(predictions.map((p: any) => [raceKey(p), p]));

    const { data: registry, error: registryError } = await db
      .from("official_races")
      .select("race_date,track,race_no,circuit,race_name,post_time,source,field_status,prediction_status,market_status,result_status,prediction_attempts,market_attempts,result_attempts,updated_at")
      .eq("race_date", date)
      .order("circuit", { ascending: true })
      .order("track", { ascending: true })
      .order("race_no", { ascending: true });

    if (registryError) return json({ ok: false, error: "race_registry_read_failed" }, 500);

    const raceRows: any[] = (registry ?? []).map((r: any) => {
      const prediction = predictionByKey.get(raceKey(r)) ?? null;
      return {
        key: raceKey(r),
        race_date: r.race_date,
        track: r.track,
        race_no: r.race_no,
        race_name: r.race_name ?? prediction?.race_name ?? null,
        circuit: r.circuit,
        post_time: r.post_time ?? prediction?.post_time ?? null,
        source: r.source,
        field_status: r.field_status,
        prediction_status: prediction?.data_error ? "DATA_ERROR" : prediction ? "FROZEN" : r.prediction_status,
        data_error: prediction?.data_error ?? null,
        market_status: r.market_status,
        result_status: r.result_status,
        prediction_attempts: r.prediction_attempts,
        market_attempts: r.market_attempts,
        result_attempts: r.result_attempts,
        updated_at: r.updated_at,
        prediction,
      };
    });

    const registryKeys = new Set(raceRows.map((r: any) => r.key));
    for (const prediction of predictions) {
      const key = raceKey(prediction);
      if (registryKeys.has(key)) continue;
      raceRows.push({
        key,
        race_date: prediction.race_date,
        track: prediction.track,
        race_no: prediction.race_no,
        race_name: prediction.race_name,
        circuit: prediction.circuit,
        post_time: prediction.post_time,
        source: "PREDICTION_FALLBACK",
        field_status: "UNKNOWN",
        prediction_status: prediction.data_error ? "DATA_ERROR" : "FROZEN",
        data_error: prediction.data_error ?? null,
        market_status: prediction.market_captured_at ? "READY" : "PENDING",
        result_status: "PENDING",
        prediction_attempts: 0,
        market_attempts: 0,
        result_attempts: 0,
        updated_at: prediction.frozen_at,
        prediction,
      });
    }

    raceRows.sort((a, b) =>
      String(a.circuit).localeCompare(String(b.circuit), "ja") ||
      String(a.track).localeCompare(String(b.track), "ja") ||
      Number(a.race_no) - Number(b.race_no)
    );

    return json({
      ok: true,
      date,
      mode: "DISPLAY_ONLY",
      excluded_predictions: [...(official ?? []), ...(legacy ?? [])].filter((r:any)=>isTestPrediction(r)).map((r:any)=>({id:r.id,protocol_version:r.protocol_version ?? 'CHAT_PRE_RACE_LEGACY',reason:'TEST_DATA'})),
      predictions,
      races: raceRows,
      counts: {
        races: raceRows.length,
        frozen: raceRows.filter((r: any) => r.prediction_status === "FROZEN").length,
        pending: raceRows.filter((r: any) => r.prediction_status !== "FROZEN").length,
        market_ready: raceRows.filter((r: any) => r.market_status === "READY").length,
        result_ready: raceRows.filter((r: any) => r.result_status === "READY").length,
      },
    });
  }

  if (action === "prediction") {
    const date = asIsoDate(url.searchParams.get("date") ?? body.date);
    const track = String(url.searchParams.get("track") ?? body.track ?? "").trim();
    const raceNo = Number(url.searchParams.get("race_no") ?? body.race_no);

    if (!date || !track || !Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) {
      return json({ ok: false, error: "invalid_race" }, 400);
    }

    const { data: official, error } = await db
      .from("official_predictions")
      .select("id,race_date,track,race_no,race_name,circuit,post_time,protocol_version,model_label,source,status,predicted_at,frozen_at,payload")
      .eq("race_date", date)
      .eq("track", track)
      .eq("race_no", raceNo)
      .maybeSingle();

    if (error) return json({ ok: false, error: "prediction_read_failed" }, 500);

    if (official) {
      const { data: market, error: marketError } = await db
        .from("official_market")
        .select("race_date,track,race_no,circuit,runners,source,captured_at")
        .eq("race_date", date)
        .eq("track", track)
        .eq("race_no", raceNo)
        .eq("circuit", official.circuit)
        .maybeSingle();
      const { data: betPlan, error: betError } = await db
        .from("official_bet_plans")
        .select("race_date,track,race_no,circuit,status,payload,market_captured_at,decided_at")
        .eq("race_date", date)
        .eq("track", track)
        .eq("race_no", raceNo)
        .eq("circuit", official.circuit)
        .maybeSingle();
      const { data: raceField, error: fieldError } = await db
        .from("official_races")
        .select("field_payload")
        .eq("race_date", date)
        .eq("track", track)
        .eq("race_no", raceNo)
        .eq("circuit", official.circuit)
        .maybeSingle();
      if (marketError || betError || fieldError) return json({ok:false,error:'SYSTEM ERROR: related_data_read_failed'},500);
      return json({
        ok: true,
        prediction: safeOfficial(
          official,
          market ?? null,
          betPlan ?? null,
          raceField?.field_payload ?? null
        )
      });
    }

    const { data: legacy, error: legacyError } = await db
      .from("chappy_predictions")
      .select("id,race_date,track,race_no,race_name,picks,eye,note,source,predicted_at,created_at")
      .eq("race_date", date)
      .eq("track", track)
      .eq("race_no", raceNo)
      .maybeSingle();

    if (legacyError) return json({ok:false,error:'SYSTEM ERROR: legacy_prediction_read_failed'},500);
    if (legacy) return json({ ok: true, prediction: safeLegacy(legacy) });
    return json({ ok: false, error: "not_found" }, 404);
  }

  if (action === "market") {
    const date = asIsoDate(url.searchParams.get("date") ?? body.date);
    if (!date) return json({ ok: false, error: "invalid_date" }, 400);

    const { data, error } = await db
      .from("official_market")
      .select("race_date,track,race_no,circuit,runners,source,captured_at")
      .eq("race_date", date)
      .order("circuit", { ascending: true })
      .order("track", { ascending: true })
      .order("race_no", { ascending: true });

    if (error) return json({ ok: false, error: "market_read_failed" }, 500);
    return json({ ok: true, date, markets: data ?? [] });
  }

  if (action === "results") {
    const date = asIsoDate(url.searchParams.get("date") ?? body.date);
    if (!date) return json({ ok: false, error: "invalid_date" }, 400);

    const [
      { data, error },
      { data: markets, error: marketsError },
      { data: predictions, error: predictionsError },
      { data: races, error: racesError },
      { data: betPlans, error: betsError }
    ] = await Promise.all([
      db
        .from("official_results")
        .select("id,race_date,track,race_no,race_name,circuit,result,source,settled_at")
        .eq("race_date", date)
        .order("circuit", { ascending: true })
        .order("track", { ascending: true })
        .order("race_no", { ascending: true }),
      db
        .from("official_market")
        .select("race_date,track,race_no,circuit,runners,source,captured_at")
        .eq("race_date", date),
      db
        .from("official_predictions")
        .select("id,race_date,track,race_no,race_name,circuit,post_time,protocol_version,model_label,source,status,predicted_at,frozen_at,payload")
        .eq("race_date", date),
      db
        .from("official_races")
        .select("race_date,track,race_no,race_name,circuit,post_time,field_payload")
        .eq("race_date", date),
      db
        .from("official_bet_plans")
        .select("race_date,track,race_no,circuit,status,payload,market_captured_at,decided_at")
        .eq("race_date", date)
    ]);

    if (predictionsError || marketsError || racesError || betsError) return json({ok:false,error:'SYSTEM ERROR: related_prediction_read_failed'},500);
    if (error) return json({ ok: false, error: "result_read_failed:" + String(error.message || error.code || error) }, 500);

    const marketByKey = new Map((markets ?? []).map((m: any) => [raceKey(m), m]));
    const predictionByKey = new Map((predictions ?? []).map((p: any) => [raceKey(p), p]));
    const raceByKey = new Map((races ?? []).map((r: any) => [raceKey(r), r]));
    const betByKey = new Map((betPlans ?? []).map((b: any) => [raceKey(b), b]));

    const results = (data ?? []).map((r: any) => {
      const key = raceKey(r);
      const market = marketByKey.get(key) ?? null;
      const rawPrediction = predictionByKey.get(key) ?? null;
      const prediction = rawPrediction ? safeOfficial(rawPrediction,market,betByKey.get(key) ?? null,raceByKey.get(key)?.field_payload ?? null) : null;
      const race = raceByKey.get(key) ?? null;
      const betPlan = betByKey.get(key) ?? null;

      const displayResult = normalizeResultForDisplay(
        r.result,
        Array.isArray(betPlan?.payload?.bets) ? betPlan.payload.bets : []
      );

      return {
        ...r,
        result: displayResult,
        race_name: r.race_name ?? prediction?.race_name ?? race?.race_name ?? null,
        post_time: prediction?.post_time ?? race?.post_time ?? null,
        prediction_state: prediction?.data_error ? 'DATA_ERROR' : prediction ? 'FOUND' : 'NOT_FOUND',
        data_error: prediction?.data_error ?? null,
        prediction: prediction?.data_error ? null : prediction,
        market: market
          ? {
              runners: market.runners ?? [],
              source: market.source ?? null,
              captured_at: market.captured_at ?? null,
            }
          : null,
      };
    });

    return json({ ok: true, date, results });
  }

  return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    const message = String((e as any)?.message ?? e);
    const dataError = message.startsWith('DATA ERROR:');
    return json({ok:false,error:dataError ? message : 'SYSTEM ERROR: request_failed'}, dataError ? 422 : 500);
  }
});
