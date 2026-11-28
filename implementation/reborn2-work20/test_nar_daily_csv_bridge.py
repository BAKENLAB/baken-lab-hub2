import json
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from nar_daily_csv_bridge import inspect_archive, build_historical_material, parse_corner_order

ZIP=Path(__file__).parents[3]/"upload"/"20261128_1795867330_race (1)(1).zip"
ACQUIRED="2026-11-28T21:07:34+09:00"

class NarDailyCsvBridgeTest(unittest.TestCase):
    def test_original_shape_and_bom(self):
        x=inspect_archive(ZIP,ACQUIRED)
        self.assertEqual(x["source_sha256"],"044931b45373025f5b5dc1fe30050dc8d82d3feb0fa64eddf7a68b9a9d7284c1")
        self.assertEqual(x["counts"],{"races":36,"horses":366,"race_columns":66,"horse_columns":36})
        self.assertEqual(x["encoding"],"UTF-8-SIG")

    def test_supported_flat_tracks_and_join(self):
        x=build_historical_material(ZIP,ACQUIRED,"2026-11-29T15:40:00+09:00")
        self.assertEqual(x["accepted_counts"],{"races":23,"horses":240,"finished_rows":234,"nonfinish_rows":6,
                         "native_horse_ids":0,"races_with_corner_orders":23,"races_with_laps":0})
        self.assertEqual(x["excluded_counts"]["unsupported_track_races"],12)
        self.assertEqual(x["excluded_counts"]["unsupported_track_horses"],114)
        self.assertEqual(x["excluded_counts"]["incomplete_result_races"],1)
        self.assertEqual(sum(len(r["runners"]) for r in x["races"]),240)

    def test_corner_order_groups_preserve_parenthesized_group(self):
        self.assertEqual(parse_corner_order("8,(2,6),9,7-3"),[[8],[2,6],[9],[7],[3]])
        x=build_historical_material(ZIP,ACQUIRED,"2026-11-29T15:40:00+09:00")
        kochi1=next(r for r in x["races"] if r["race"]["race_id"]=="NAR-高知-20261128-R01")
        h8=next(h for h in kochi1["runners"] if h["horse_no"]=="8")
        self.assertEqual(h8["corner_passages"][0]["order_group"],1)

    def test_same_day_prestart_cannot_use_postrace_archive(self):
        x=build_historical_material(ZIP,ACQUIRED,"2026-11-28T20:50:00+09:00")
        self.assertFalse(x["guards"]["pre_target_acquisition"])
        self.assertEqual(x["accepted_counts"]["races"],0)
        self.assertFalse(x["formal_analysis_ready"])

    def test_market_and_payback_never_enter_packet(self):
        x=build_historical_material(ZIP,ACQUIRED,"2026-11-29T15:40:00+09:00")
        s=json.dumps(x["races"],ensure_ascii=False).lower()
        for forbidden in ("人気","odds","popularity","payback","払戻"):
            self.assertNotIn(forbidden.lower(),s)
        self.assertFalse(x["guards"]["payback_loaded"])

    def test_identity_is_not_fabricated(self):
        x=build_historical_material(ZIP,ACQUIRED,"2026-11-29T15:40:00+09:00")
        runners=[h for r in x["races"] for h in r["runners"]]
        self.assertTrue(all(h["native_horse_id"] is None for h in runners))
        self.assertTrue(all(h["identity_status"]=="OFFICIAL_PROFILE_ID_REQUIRED" for h in runners))
        self.assertEqual(x["remaining_gate"],"NAR_PROFILE_ID_CROSSWALK_REQUIRED")

if __name__=="__main__": unittest.main()
