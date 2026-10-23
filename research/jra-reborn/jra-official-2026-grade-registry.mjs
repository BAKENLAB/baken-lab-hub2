/**
 * LAB REBORN: authoritative 2026 JRA graded-race overlay.
 * Source: https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html
 * Verified race DATE + TRACK + NAME together; no grade from "S"/"ステークス"
 * alone, no post-race result or horse performance data.
 *
 * LIMITED CURATED SET, not a full official registry (especially 2024/2025).
 * Do not infer unknown as "ungraded": return null and lower evidence confidence.
 */
export const gradedRaces2026=[
 ["2026-02-14","東京",5,"クイーン","GIII"],
 ["2026-04-12","阪神",7,"桜花賞","GI"],
 ["2026-05-24","東京",7,"オークス","GI","優駿牝馬"],
 ["2026-08-02","新潟",5,"アイビスサマーダッシュ","GIII"],
 ["2026-08-09","新潟",5,"レパード","GIII"],
 ["2026-08-16","札幌",6,"札幌記念","GII"],
 ["2026-08-16","中京",5,"中京記念","GIII"],
 ["2026-08-23","新潟",5,"新潟2歳","GIII"],
 ["2026-08-23","札幌",5,"キーンランド","GIII"],
 ["2026-08-30","新潟",5,"新潟記念","GIII"],
 ["2026-08-30","中京",5,"中京2歳","GIII"],
 ["2026-09-05","中山",5,"京成杯オータム","GIII"],
 ["2026-09-05","札幌",5,"札幌2歳","GIII"],
 ["2026-09-06","中山",6,"紫苑","GII"],
 ["2026-09-06","阪神",6,"セントウル","GII"],
 ["2026-09-12","阪神",5,"チャレンジ","GIII"],
 ["2026-09-13","中山",6,"セントライト","GII"],
 ["2026-09-13","阪神",6,"ローズ","GII"],
 ["2026-09-20","中山",6,"オールカマー","GII"],
 ["2026-09-21","阪神",6,"神戸新聞杯","GII"],
 ["2026-09-26","阪神",5,"シリウス","GIII"],
 ["2026-09-27","中山",7,"スプリンターズ","GI"],
 ["2026-10-04","東京",6,"毎日王冠","GII"],
 ["2026-10-04","京都",6,"京都大賞典","GII"],
 ["2026-10-10","東京",5,"サウジアラビアロイヤル","GIII"],
 ["2026-10-11","東京",6,"アイルランド","GII"],
 ["2026-10-12","京都",6,"スワン","GII"],
 ["2026-10-17","東京",6,"富士","GII"],
 ["2026-10-18","京都",7,"秋華賞","GI"],
 ["2026-10-24","東京",5,"アルテミス","GIII"],
 ["2026-10-25","京都",7,"菊花賞","GI"],
];
export function official2026Grade(raceDate,track,raceName){
 if(typeof raceName!=="string"||!raceName.trim()||
    typeof raceDate!=="string"||typeof track!=="string")return null;
 const name=raceName.replace(/[\s（）()\u3000]/g,"");
 const matched=gradedRaces2026.filter(([date,t,,term,,,alias])=>
    date===raceDate&&t===track&&
    (name.includes(term)||(typeof alias==="string"&&name.includes(alias))));
 if(matched.length!==1)return null;
 const [date,t,level,term,label]=matched[0];
 return {level,label,official_date:date,official_track:t,
   evidence_kind:"OFFICIAL_JRA_2026_DATE_TRACK_NAME_MATCH",
   match_term:term,not_performance_data:true};
}
