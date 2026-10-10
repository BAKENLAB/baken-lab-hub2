import copy
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import unittest
from collector import collect, EvidenceError, ROOT, SOURCE, RACE

HTML=(SOURCE/'evidence/kochi3-card.html').read_bytes()
EVIDENCE=json.loads((SOURCE/'card-fetch.json').read_text())

def fixture(text):
    # Synthetic negative fixtures only, in memory; never official confirmation.
    payload=text.encode('utf-8'); meta=copy.deepcopy(EVIDENCE)
    meta['sha256']=hashlib.sha256(payload).hexdigest()
    return collect(payload,meta)

def snapshots():
    base=ROOT.parent
    return {str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in base.rglob('*') if p.is_file() and ROOT not in p.parents and '__pycache__' not in p.parts}

class CollectorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.before=snapshots()
    @classmethod
    def tearDownClass(cls):
        if cls.before!=snapshots(): raise AssertionError('Existing evidence/RAW/output changed')
    def test_nine_unique_horses(self):
        out=collect(HTML,EVIDENCE)
        self.assertEqual([h['horse_no'] for h in out['horses']],list(range(1,10)))
        self.assertEqual(out['horses'][5]['horse_name'],'アルデヤーノ')
    def test_nine_empty_cells_unknown(self):
        for h in collect(HTML,EVIDENCE)['horses']:
            self.assertEqual(h['entry_status'],'UNKNOWN')
            self.assertEqual(h['change_info']['existence_count'],1)
            self.assertEqual(h['change_info']['extraction_status'],'PRESENT_EMPTY')
            self.assertEqual(h['change_info']['cell']['normalized_text'],'')
    def test_ardeyano_past_cancel_not_current(self):
        self.assertIn('取消',HTML.decode())
        h=collect(HTML,EVIDENCE)['horses'][5]
        self.assertEqual(h['entry_status'],'UNKNOWN')
        self.assertNotIn('取消',h['change_info']['cell']['raw_html'])
    def test_past_cancel_exclude_stop_independent(self):
        for word in ['除外','中止','取消取消']:
            out=fixture(HTML.decode().replace('取消',word))
            self.assertTrue(all(h['entry_status']=='UNKNOWN' for h in out['horses']))
            self.assertTrue(all(h['change_info']['extraction_status']=='PRESENT_EMPTY' for h in out['horses']))
    def test_missing_differs_from_empty(self):
        text=HTML.decode(); c=collect(HTML,EVIDENCE)['horses'][5]['change_info']['cell']
        out=fixture(text[:c['location']['source_char_start']]+text[c['location']['source_char_end']:])
        h=out['horses'][5]
        self.assertEqual(h['change_info']['extraction_status'],'MISSING')
        self.assertEqual(h['change_info']['existence_count'],0)
        self.assertIsNone(h['change_info']['cell']);self.assertEqual(h['entry_status'],'UNKNOWN')
    def test_other_horse_cell_not_used(self):
        text=HTML.decode(); c=collect(HTML,EVIDENCE)['horses'][4]['change_info']['cell']
        changed=c['raw_html'].replace('>','>他馬の変更（未確認）',1)
        out=fixture(text[:c['location']['source_char_start']]+changed+text[c['location']['source_char_end']:])
        self.assertEqual(out['horses'][4]['change_info']['cell']['normalized_text'],'他馬の変更(未確認)')
        self.assertEqual(out['horses'][5]['change_info']['cell']['normalized_text'],'')
    def test_unconfirmed_current_labels_unknown(self):
        text=HTML.decode(); c=collect(HTML,EVIDENCE)['horses'][5]['change_info']['cell']
        for label in ['取消','競走除外','ACTIVE','出走予定','取消 除外']:
            changed=c['raw_html'].replace('>','>'+label,1)
            h=fixture(text[:c['location']['source_char_start']]+changed+text[c['location']['source_char_end']:])['horses'][5]
            self.assertEqual(h['entry_status'],'UNKNOWN');self.assertEqual(h['reason'],'UNCONFIRMED_OFFICIAL_LABEL')
    def test_duplicate_info_ambiguous(self):
        text=HTML.decode(); c=collect(HTML,EVIDENCE)['horses'][5]['change_info']['cell']
        pos=c['location']['source_char_end']
        h=fixture(text[:pos]+'<td class="info">取消</td>'+text[pos:])['horses'][5]
        self.assertEqual(h['change_info']['existence_count'],2)
        self.assertEqual(h['change_info']['extraction_status'],'AMBIGUOUS')
        self.assertEqual(h['entry_status'],'UNKNOWN')
    def test_odds_cells_not_status(self):
        text=HTML.decode().replace('class="odds_weight" rowspan="2">','class="odds_weight" rowspan="2">取消',1)
        self.assertEqual(fixture(text)['horses'][0]['reason'],'EMPTY_CHANGE_CELL')
    def test_explanation_table_excluded(self):
        out=fixture(HTML.decode().replace('<sapn class="info">変更情報</sapn>','<sapn class="info">取消 除外</sapn>'))
        self.assertEqual(len(out['horses']),9)
        self.assertTrue(all(h['change_info']['existence_count']==1 for h in out['horses']))
    def test_wrong_date_header(self):
        with self.assertRaises(EvidenceError): fixture(HTML.decode().replace('2026年10月10日','2026年10月11日'))
    def test_wrong_r_header(self):
        with self.assertRaises(EvidenceError): fixture(HTML.decode().replace('第3競走','第4競走'))
    def test_wrong_requested_race(self):
        with self.assertRaises(EvidenceError): collect(HTML,EVIDENCE,{**RACE,'race_no':4})
    def test_sha_mismatch(self):
        with self.assertRaises(EvidenceError): collect(HTML+b' ',EVIDENCE)
    def test_url_mismatch(self):
        meta=copy.deepcopy(EVIDENCE);meta['url']=meta['url'].replace('k_raceNo=3','k_raceNo=4')
        with self.assertRaises(EvidenceError): collect(HTML,meta)
    def test_timestamp_invalid_or_poststart(self):
        for time in ['invalid','2026-10-10T07:11:00','2026-10-10T16:40:00+09:00']:
            meta=copy.deepcopy(EVIDENCE);meta['download_completed_at']=time
            with self.assertRaises(EvidenceError): collect(HTML,meta)
    def test_duplicate_horse_no(self):
        with self.assertRaises(EvidenceError): fixture(HTML.decode().replace('class="horseNum">9','class="horseNum">8'))
    def test_raw_html_and_positions_exact(self):
        text=HTML.decode()
        for h in collect(HTML,EVIDENCE)['horses']:
            c=h['change_info']['cell'];p=c['location']
            self.assertEqual(c['raw_html'],text[p['source_char_start']:p['source_char_end']])
            self.assertTrue(c['raw_html'].startswith('<td class="info"'))
            self.assertEqual(c['block_row'],5);self.assertEqual(c['direct_cell_number'],3)
    def test_persisted_output_and_no_ready(self):
        out=json.loads((ROOT/'kochi3-field-status.json').read_text())
        self.assertEqual(out,collect(HTML,EVIDENCE))
        self.assertFalse(out['ready_evaluated']);self.assertFalse(out['production_dispatch_allowed'])
        self.assertFalse(out['latest_status_checked']);self.assertIsNone(out['source']['http_status'])
        self.assertTrue(all(h['latest_status']=='UNKNOWN' for h in out['horses']))
    def test_existing_output_not_overwritten(self):
        p=ROOT/'kochi3-field-status.json';before=p.read_bytes()
        proc=subprocess.run([sys.executable,str(ROOT/'collector.py')],capture_output=True,text=True)
        self.assertNotEqual(proc.returncode,0);self.assertIn('FileExistsError',proc.stderr)
        self.assertEqual(p.read_bytes(),before)

if __name__=='__main__': unittest.main()
