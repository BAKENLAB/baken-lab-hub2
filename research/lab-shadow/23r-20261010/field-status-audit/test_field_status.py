import pathlib, unittest, json, hashlib
from field_status import parse_card, status_from_current
ROOT=pathlib.Path(__file__).resolve().parent.parent
class StatusTest(unittest.TestCase):
    def test_listing_alone_does_not_establish_active(self): self.assertEqual(status_from_current([''],False),'UNVERIFIED')
    def test_active_structural_evidence(self): self.assertEqual(status_from_current([''],True),'ACTIVE')
    def test_current_cancel(self): self.assertEqual(status_from_current(['取消'],True),'CANCELLED')
    def test_current_excluded(self): self.assertEqual(status_from_current(['競走除外'],True),'EXCLUDED')
    def test_current_stopped_unknown(self): self.assertEqual(status_from_current(['中止'],True),'UNVERIFIED')
    def test_conflicting_markers(self): self.assertEqual(status_from_current(['取消 除外'],True),'UNVERIFIED')
    def test_cancel_positive_odds(self): self.assertEqual(status_from_current(['取消 2.1 (1人気)'],True),'UNVERIFIED')
    def test_wrong_race(self):
        with self.assertRaises(ValueError): parse_card(self.html(),{'race_date':'2026-10-10','track':'佐賀','race_no':3})
    def html(self): return (ROOT/'official-history-pilot/evidence/kochi3-card.html').read_text()
    def race(self): return {'race_date':'2026-10-10','track':'高知','race_no':3,'official_url':'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2026%2F10%2F10&k_raceNo=3&k_babaCode=31'}
    def test_archived_nine_horses(self):
        rows=parse_card(self.html(),self.race());self.assertEqual(len(rows),9);self.assertTrue(all(r['archive_status']=='ACTIVE' for r in rows));self.assertTrue(all(r['current_status'] is None for r in rows))
    def test_ardeyano_past_cancel_ignored(self):
        row=next(r for r in parse_card(self.html(),self.race()) if r['horse_no']==6)
        self.assertEqual(row['archive_status'],'ACTIVE');self.assertTrue(any('取消' in t for t in row['past_status_mentions']));self.assertFalse(any('取消' in t for t in row['current_status_cells']))
    def test_past_exclusion_stoppage_never_current(self):
        for word in ['除外','中止']:
            row=next(r for r in parse_card(self.html().replace('取消',word),self.race()) if r['horse_no']==6);self.assertEqual(row['archive_status'],'ACTIVE')
    def test_report_does_not_upgrade_any_latest_status(self):
        data=json.loads((pathlib.Path(__file__).parent/'audit-results.json').read_text());self.assertEqual(len(data['races']),23);self.assertTrue(all(r['latest_verification']=='UNVERIFIED' for r in data['races']));self.assertTrue(all(h['current_status'] is None for r in data['races'] for h in r['horses']));self.assertFalse(data['ready_changed'])
if __name__=='__main__': unittest.main()
