#!/usr/bin/env python3
"""Read-only NAR daily CSV bridge for historical race material.

The source ZIP is never modified.  Payback, popularity and odds are never
loaded into analysis material.  A daily result archive may only become past
race material for a target whose cutoff is later than the archive acquisition.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

RACE_SUFFIX = "_racelist.csv"
HORSE_SUFFIX = "_horselist.csv"
PAYBACK_SUFFIX = "_payback.csv"
SUPPORTED_TRACKS = frozenset({"高知", "佐賀"})

RACE_FIELDS = {
    "競馬場":"track", "競走年月日":"race_date", "レース番号":"race_no",
    "発走時刻":"scheduled_time", "競走種類名称":"race_type", "レース名":"race_name",
    "芝ダート区分":"surface", "回り":"turn", "距離":"distance_m", "天候":"weather",
    "馬場":"going", "頭数":"reported_finish_field_size", "条件":"class_condition",
    "1着賞金(円)":"first_prize_yen", "2着賞金(円)":"second_prize_yen",
    "3着賞金(円)":"third_prize_yen", "4着賞金(円)":"fourth_prize_yen",
    "5着賞金(円)":"fifth_prize_yen", "上がり4F":"race_last4f", "上がり3F":"race_last3f",
}
for i in range(1, 16): RACE_FIELDS[f"ハロンタイム{i}"] = f"race_lap_{i}"
for i in range(1, 9):
    RACE_FIELDS[f"コーナー名称{i}"] = f"corner_name_{i}"
    RACE_FIELDS[f"コーナー通過順{i}"] = f"corner_order_{i}"

HORSE_FIELDS = {
    "競馬場":"track", "競走年月日":"race_date", "レース番号":"race_no",
    "枠番":"frame_no", "帽色":"cap_color", "馬番":"horse_no", "馬名":"horse_name",
    "性":"sex", "齢":"age", "毛色":"color", "生年月日":"birth_date",
    "父馬名":"sire", "母馬名":"dam", "母父馬名":"damsire", "騎手名":"jockey_name",
    "騎手所属":"jockey_affiliation", "負担重量":"carried_weight", "騎手成績":"jockey_record_literal",
    "調教師":"trainer_name", "調教師所属":"trainer_affiliation", "馬主氏名":"owner_name",
    "生産牧場名":"breeder_name", "馬体重":"body_weight", "馬体重増減":"body_weight_change",
    "全成績":"career_record_literal", "ダート左成績":"dirt_left_record_literal",
    "ダート右成績":"dirt_right_record_literal", "当競馬場成績":"track_record_literal",
    "うち当距離成績":"track_distance_record_literal", "最高タイム":"best_time_literal",
    "最高タイム良馬場":"best_good_time_literal", "着順":"finish_literal", "タイム":"time_literal",
    "着差":"reported_gap_literal", "上がり3F":"final3f_literal",
}

FORBIDDEN_SOURCE_COLUMNS = frozenset({"人気"})
FORBIDDEN_MATERIAL_TOKENS = ("odds", "popularity", "payback", "払戻", "人気")

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""): h.update(block)
    return h.hexdigest()

def _iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def _read_csv(zf: zipfile.ZipFile, member: str) -> tuple[list[str], list[dict[str,str]]]:
    raw = zf.read(member)
    if not raw.startswith(b"\xef\xbb\xbf"): raise ValueError(f"UTF8_BOM_REQUIRED:{member}")
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    rows = list(reader)
    return list(reader.fieldnames or []), rows

def _member(zf: zipfile.ZipFile, suffix: str) -> str:
    matches = [x.filename for x in zf.infolist() if x.filename.endswith(suffix)]
    if len(matches) != 1: raise ValueError(f"EXACTLY_ONE_{suffix}:{len(matches)}")
    name = matches[0]
    if name.startswith("/") or ".." in Path(name).parts: raise ValueError("UNSAFE_ZIP_PATH")
    return name

def _race_key(row: dict[str,str]) -> str:
    return f"NAR-{row['競馬場']}-{row['競走年月日']}-R{int(row['レース番号']):02d}"

def _project(row: dict[str,str], mapping: dict[str,str]) -> dict:
    return {dest: row.get(src, "").strip() or None for src, dest in mapping.items()}

def parse_corner_order(raw: str | None) -> list[list[int]]:
    """Preserve bracketed simultaneous groups without inventing exact gaps."""
    if not raw: return []
    groups=[]
    for match in re.finditer(r"\(([0-9,]+)\)|([0-9]+)",raw):
        text=match.group(1) or match.group(2)
        groups.append([int(x) for x in text.split(",")])
    return groups

def inspect_archive(zip_path: str | Path, acquired_at: str) -> dict:
    path = Path(zip_path)
    with zipfile.ZipFile(path) as zf:
        race_member, horse_member = _member(zf, RACE_SUFFIX), _member(zf, HORSE_SUFFIX)
        payback_member = _member(zf, PAYBACK_SUFFIX)  # existence only; content is never read
        race_header, race_rows = _read_csv(zf, race_member)
        horse_header, horse_rows = _read_csv(zf, horse_member)
    if len(race_header) != 66: raise ValueError(f"RACELIST_COLUMNS:{len(race_header)}")
    if len(horse_header) != 36: raise ValueError(f"HORSELIST_COLUMNS:{len(horse_header)}")
    if not FORBIDDEN_SOURCE_COLUMNS.issubset(horse_header): raise ValueError("POPULARITY_COLUMN_EXPECTED_FOR_REJECTION")
    return {
        "schema":"REBORN2_NAR_DAILY_CSV_ARCHIVE_1", "source_sha256":_sha256(path),
        "acquired_at":acquired_at, "encoding":"UTF-8-SIG", "source_kind":"NAR_DAILY_RESULT_CSV",
        "members":{"racelist":race_member,"horselist":horse_member,"payback_excluded":payback_member},
        "counts":{"races":len(race_rows),"horses":len(horse_rows),"race_columns":len(race_header),"horse_columns":len(horse_header)},
        "track_counts":{"races":dict(Counter(x["競馬場"] for x in race_rows)),"horses":dict(Counter(x["競馬場"] for x in horse_rows))},
        "_race_rows":race_rows, "_horse_rows":horse_rows,
    }

def build_historical_material(zip_path: str | Path, acquired_at: str, target_post: str,
                              supported_tracks=SUPPORTED_TRACKS) -> dict:
    archive = inspect_archive(zip_path, acquired_at)
    cutoff = _iso(target_post)
    acquired = _iso(acquired_at)
    pre_target_acquisition = acquired < cutoff
    races, horses = [], []
    excluded = Counter()
    raw_horses=archive.pop("_horse_rows")
    raw_by_race=defaultdict(list)
    for src in raw_horses: raw_by_race[_race_key(src)].append(src)
    recognized_nonfinish={"出走取消":"CANCELLED","競走除外":"EXCLUDED","競走中止":"DID_NOT_FINISH","失格":"DISQUALIFIED"}
    complete_race_ids=set()
    for race_id,rows in raw_by_race.items():
        if all((x["着順"].strip().isdigit() or x["着差"].strip() in recognized_nonfinish) for x in rows):
            complete_race_ids.add(race_id)
    for src in archive.pop("_race_rows"):
        if src["競馬場"] not in supported_tracks:
            excluded["unsupported_track_races"] += 1
            continue
        item = _project(src, RACE_FIELDS)
        item["race_id"] = _race_key(src)
        item["evidence"] = {"source_sha256":archive["source_sha256"],"acquired_at":acquired_at,"member":archive["members"]["racelist"]}
        before_target=src["競走年月日"] < cutoff.strftime("%Y%m%d")
        complete=_race_key(src) in complete_race_ids
        item["result_publication_complete"] = complete
        item["historical_eligible"] = pre_target_acquisition and before_target and complete
        if pre_target_acquisition and before_target and not complete: excluded["incomplete_result_races"] += 1
        races.append(item)
    eligible_races={r["race_id"]:r for r in races if r["historical_eligible"]}
    race_ids=set(eligible_races)
    for src in raw_horses:
        if src["競馬場"] not in supported_tracks:
            excluded["unsupported_track_horses"] += 1
            continue
        race_id = _race_key(src)
        if race_id not in race_ids:
            excluded["not_historical_at_cutoff"] += 1
            continue
        item = _project(src, HORSE_FIELDS)
        literal=src["着差"].strip()
        if src["着順"].strip().isdigit():
            item["result_status"]="FINISHED"
        else:
            item["result_status"]=recognized_nonfinish.get(literal,"RESULT_NOT_PUBLISHED")
            item["finish_literal"]=None; item["time_literal"]=None
            item["reported_gap_literal"]=None; item["final3f_literal"]=None
            item["nonfinish_reason_literal"]=literal or None
        item["race_id"] = race_id
        item["native_horse_id"] = None
        item["identity_candidate"] = {k:item[k] for k in ("horse_name","birth_date","sire","dam","damsire")}
        item["identity_status"] = "OFFICIAL_PROFILE_ID_REQUIRED"
        race=eligible_races[race_id]
        passages=[]
        horse_no=int(item["horse_no"])
        for i in range(1,9):
            raw=race.get(f"corner_order_{i}")
            groups=parse_corner_order(raw)
            for group_index,group in enumerate(groups,1):
                if horse_no in group:
                    passages.append({"corner_name":race.get(f"corner_name_{i}"),"order_group":group_index,
                                     "group_size":len(group),"tied_with":[x for x in group if x!=horse_no],"raw":raw})
                    break
        item["corner_passages"]=passages
        item["evidence"] = {"source_sha256":archive["source_sha256"],"acquired_at":acquired_at,"member":archive["members"]["horselist"]}
        horses.append(item)
    by_race = defaultdict(list)
    for h in horses: by_race[h["race_id"]].append(h)
    joined = [{"race":r,"runners":sorted(by_race[r["race_id"]],key=lambda x:int(x["horse_no"] or 0))}
              for r in races if r["historical_eligible"]]
    packet = {
        "schema":"REBORN2_NAR_HISTORICAL_MATERIAL_1", "fixed_engine":"V48",
        "source":{"sha256":archive["source_sha256"],"acquired_at":acquired_at,"kind":archive["source_kind"],"encoding":archive["encoding"]},
        "target":{"post_time":target_post},
        "guards":{"pre_target_acquisition":pre_target_acquisition,"target_result_used":False,"popularity_used":False,
                  "odds_used":False,"payback_loaded":False,"production_changed":False},
        "archive_counts":archive["counts"], "track_counts":archive["track_counts"],
        "accepted_counts":{"races":len(joined),"horses":len(horses),
                           "finished_rows":sum(x["result_status"]=="FINISHED" for x in horses),
                           "nonfinish_rows":sum(x["result_status"]!="FINISHED" for x in horses),
                           "native_horse_ids":sum(bool(x["native_horse_id"]) for x in horses),
                           "races_with_corner_orders":sum(any(r["race"].get(f"corner_order_{i}") for i in range(1,9)) for r in joined),
                           "races_with_laps":sum(any(r["race"].get(f"race_lap_{i}") for i in range(1,16)) for r in joined)},
        "excluded_counts":dict(excluded), "races":joined,
        "formal_analysis_ready":pre_target_acquisition and bool(joined) and all(h["native_horse_id"] for h in horses),
        "remaining_gate":"NAR_PROFILE_ID_CROSSWALK_REQUIRED" if horses else "NO_ELIGIBLE_HISTORY"
    }
    material_encoded=json.dumps(packet["races"],ensure_ascii=False)
    if any(token.lower() in material_encoded.lower() for token in FORBIDDEN_MATERIAL_TOKENS):
        raise AssertionError("FORBIDDEN_FIELD_LEAK")
    return packet

if __name__ == "__main__":
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument("zip_path"); p.add_argument("--acquired-at",required=True); p.add_argument("--target-post",required=True)
    a=p.parse_args()
    print(json.dumps(build_historical_material(a.zip_path,a.acquired_at,a.target_post),ensure_ascii=False,indent=2))
