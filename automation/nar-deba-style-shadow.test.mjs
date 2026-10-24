import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';
const context={
  "race": {
    "race_date": "2026-08-14",
    "track": "笠松",
    "race_no": 11,
    "circuit": "LOCAL"
  },
  "runners": [
    {
      "horse_no": 6,
      "horse_name": "ウィステリアベル",
      "rank": 4,
      "grade": "B",
      "running_style_reference": [
        "?"
      ],
      "identity_refs": [
        "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901"
      ],
      "current_source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
      "recent_runs": []
    },
    {
      "horse_no": 5,
      "horse_name": "カーシュジアン",
      "rank": 1,
      "grade": "A",
      "running_style_reference": [
        "?"
      ],
      "identity_refs": [
        "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=88888888888"
      ],
      "current_source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
      "recent_runs": []
    }
  ]
};
const evidence=[
  {
    "source": "NAR_OFFICIAL_DEBA_PAST_COLUMN",
    "source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
    "identity_source_ref": "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901",
    "current_horse_no": 6,
    "horse_name": "ウィステリアベル",
    "slot": 1,
    "race_date": "2026-07-09",
    "early_pos": 2,
    "final_turn_pos": 2
  },
  {
    "source": "NAR_OFFICIAL_DEBA_PAST_COLUMN",
    "source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
    "identity_source_ref": "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901",
    "current_horse_no": 6,
    "horse_name": "ウィステリアベル",
    "slot": 2,
    "race_date": "2026-06-26",
    "early_pos": 1,
    "final_turn_pos": 1
  },
  {
    "source": "NAR_OFFICIAL_DEBA_PAST_COLUMN",
    "source_ref": "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11",
    "identity_source_ref": "https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901",
    "current_horse_no": 6,
    "horse_name": "ウィステリアベル",
    "slot": 3,
    "race_date": "2026-06-10",
    "early_pos": 1,
    "final_turn_pos": 1
  }
];
test('official card-owned past positions suggest 逃 for two first-position runs',()=>{assert.deepEqual(buildDebaRunningStyleShadow({context,priorEvidence:evidence}).runners[0].shadow_style,['逃']);});
test('never changes original rankings or source context',()=>{const before=JSON.stringify(context),out=buildDebaRunningStyleShadow({context,priorEvidence:evidence});assert.equal(JSON.stringify(context),before);assert.equal(out.ranking_changed,false);assert.equal(context.runners[0].rank,4);});
test('single position is not enough',()=>{assert.deepEqual(buildDebaRunningStyleShadow({context,priorEvidence:evidence.slice(0,1)}).runners[0].shadow_style,['?']);});
test('unmatched official horse identity is rejected',()=>{const rows=[{...evidence[0],identity_source_ref:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=99999999999'},...evidence.slice(1)];assert.equal(buildDebaRunningStyleShadow({context,priorEvidence:rows}).runners[0].evidence_status,'REJECTED_CONFLICT');});
test('disagreement with already verified passage rejects entirely',()=>{const c=structuredClone(context);c.runners[0].recent_runs=[{race_date:'2026-06-26',early_pos:5}];assert.equal(buildDebaRunningStyleShadow({context:c,priorEvidence:evidence}).runners[0].evidence_status,'REJECTED_CONFLICT');});
test('same-day or future race never enters',()=>{assert.equal(buildDebaRunningStyleShadow({context,priorEvidence:[{...evidence[0],race_date:'2026-08-14'},...evidence.slice(1)]}).runners[0].evidence_status,'REJECTED_CONFLICT');});
test('duplicate slot never silently joins',()=>{assert.equal(buildDebaRunningStyleShadow({context,priorEvidence:[evidence[0],{...evidence[1],slot:1}]}).runners[0].evidence_status,'REJECTED_CONFLICT');});
test('no horse2 contamination',()=>{assert.equal(buildDebaRunningStyleShadow({context,priorEvidence:evidence}).runners[1].verified_passage_count,0);});
