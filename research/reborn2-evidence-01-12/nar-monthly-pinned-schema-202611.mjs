// Research schema metadata from Work's nar_monthly_csv_validation_202611.json (2026-11-26).
// Column labels only; no raw race data. Independently pinned to reported sample, not an independent raw-byte replay.
// Future schema changes must be reviewed; no silent fallback. Payback is outside ability analysis.
import { supplyNarMonthly } from './nar-monthly-materials.mjs';
export const NAR_MONTHLY_HEADERS_202611 = Object.freeze({
  races: Object.freeze(["競馬場","競走年月日","レース番号","発走時刻","競走種類名称","レース名","副賞名1","副賞名2","副賞名3","副賞名4","副賞名5","副賞名6","副賞名7","副賞名8","副賞名9","副賞名10","副賞名11","副賞名12","副賞名13","副賞名14","副賞名15","芝ダート区分","回り","距離","天候","馬場","頭数","条件","1着賞金(円)","2着賞金(円)","3着賞金(円)","4着賞金(円)","5着賞金(円)","上がり4F","上がり3F","ハロンタイム1","ハロンタイム2","ハロンタイム3","ハロンタイム4","ハロンタイム5","ハロンタイム6","ハロンタイム7","ハロンタイム8","ハロンタイム9","ハロンタイム10","ハロンタイム11","ハロンタイム12","ハロンタイム13","ハロンタイム14","ハロンタイム15","コーナー名称1","コーナー名称2","コーナー名称3","コーナー名称4","コーナー名称5","コーナー名称6","コーナー名称7","コーナー名称8","コーナー通過順1","コーナー通過順2","コーナー通過順3","コーナー通過順4","コーナー通過順5","コーナー通過順6","コーナー通過順7","コーナー通過順8"]),
  horses: Object.freeze(["競馬場","競走年月日","レース番号","枠番","帽色","馬番","馬名","性","齢","毛色","生年月日","父馬名","母馬名","母父馬名","騎手名","騎手所属","負担重量","騎手成績","調教師","調教師所属","馬主氏名","生産牧場名","馬体重","馬体重増減","全成績","ダート左成績","ダート右成績","当競馬場成績","うち当距離成績","最高タイム","最高タイム良馬場","着順","タイム","着差","上がり3F","人気"])
});
export function supplyPinnedNarMonthly(input) {
  if (input == null || typeof input !== 'object') throw Error('INVALID_INPUT');
  if (Object.hasOwn(input,'headers')) throw Error('CALLER_HEADER_OVERRIDE_FORBIDDEN');
  return supplyNarMonthly({...input,headers:NAR_MONTHLY_HEADERS_202611});
}
