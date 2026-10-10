"""Kochi 3R only, offline SHADOW extraction. Never determines READY."""
import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import re
import sys
from urllib.parse import parse_qs, urlsplit, urljoin

# Reuse the existing offline DOM primitives without executing its extractor.
sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'official-history-pilot'
spec = importlib.util.spec_from_file_location('collector_dom', SOURCE/'extract-evidence.py')
dom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dom)
RACE = {'race_date':'2026-10-10','track':'高知','race_no':3,'circuit':'LOCAL'}

class EvidenceError(ValueError): pass

class LocatedDOM(dom.DOM):
    def __init__(self, body):
        self.body = body
        self.offsets = [0]
        for line in body.splitlines(keepends=True): self.offsets.append(self.offsets[-1]+len(line))
        super().__init__(body)
    def source_offset(self):
        line,col = self.getpos()
        return self.offsets[line-1]+col
    def handle_starttag(self, tag, attrs):
        parent = self.stack[-1]
        super().handle_starttag(tag,attrs)
        node = parent.children[-1]
        node.source_start = self.source_offset()
        node.source_line,node.source_column = self.getpos()
        node.source_end = None
    def handle_endtag(self, tag):
        node = next((n for n in reversed(self.stack[1:]) if n.tag==tag),None)
        if node:
            end = self.body.find('>',self.source_offset())
            node.source_end = end+1 if end>=0 else None
        super().handle_endtag(tag)

def owns(node, tag, ancestor): return dom.ancestor(node.parent,tag) is ancestor
def direct(node, tags): return [n for n in node.children if isinstance(n,dom.Node) and n.tag in tags]
def location(node, table_index, row_index, cell_index):
    return {'table_index':table_index,'outer_row_index':row_index,'direct_cell_index':cell_index,
            'source_line':node.source_line,'source_column':node.source_column,
            'source_char_start':node.source_start,'source_char_end':node.source_end}

def collect(html_bytes, evidence, race=None):
    race = RACE if race is None else race
    if race!=RACE: raise EvidenceError('UNSUPPORTED_RACE')
    if not isinstance(evidence,dict): raise EvidenceError('INVALID_EVIDENCE')
    digest = hashlib.sha256(html_bytes).hexdigest()
    if digest!=evidence.get('sha256'): raise EvidenceError('HTML_SHA256_MISMATCH')
    if evidence.get('path')!='evidence/kochi3-card.html': raise EvidenceError('EVIDENCE_PATH_MISMATCH')
    url = evidence.get('url')
    try:
        u=urlsplit(url)
        query=parse_qs(u.query,keep_blank_values=True)
        if u.scheme!='https' or u.netloc!='www.keiba.go.jp' or u.fragment or u.path!='/KeibaWeb/TodayRaceInfo/DebaTable' or query!={'k_raceDate':['2026/10/10'],'k_raceNo':['3'],'k_babaCode':['31']}:
            raise EvidenceError('OFFICIAL_URL_MISMATCH')
        captured=dt.datetime.fromisoformat(evidence['download_completed_at'].replace('Z','+00:00'))
        if captured.tzinfo is None: raise EvidenceError('CAPTURE_TIME_UNVERIFIED')
    except (TypeError,KeyError,ValueError) as e: raise EvidenceError('INVALID_EVIDENCE_METADATA') from e
    try: html=html_bytes.decode('utf-8',errors='strict')
    except UnicodeError as e: raise EvidenceError('INVALID_UTF8') from e
    parsed=LocatedDOM(html); root=parsed.root
    headers=[dom.clean(h.text()).replace(' ','') for h in root.walk('h4')]
    expected='2026年10月10日'
    valid=[h for h in headers if expected in h and '高知第3競走' in h and '16:40発走' in h]
    if len(valid)!=1: raise EvidenceError('RACE_HEADER_MISMATCH')
    post=dt.datetime.fromisoformat('2026-10-10T16:40:00+09:00')
    if captured>=post: raise EvidenceError('CAPTURE_NOT_PRESTART')
    tables=list(root.walk('table'))
    real=[]
    for table in tables:
        if dom.ancestor(table,'section') is None or 'cardTable' not in dom.classes(dom.ancestor(table,'section')): continue
        outer=[r for r in table.walk('tr') if owns(r,'table',table)]
        anchors=[(i,c) for i,r in enumerate(outer) for c in dom.cells(r) if 'horseNum' in dom.classes(c) and c.attrs.get('rowspan')=='5' and re.fullmatch(r'\d+',dom.clean(c.text()))]
        if anchors: real.append((table,outer,anchors))
    if len(real)!=1: raise EvidenceError('REAL_TABLE_NOT_UNIQUE')
    table,outer,anchors=real[0]; table_index=tables.index(table)
    if not any('変更情報' in dom.clean(h.text()) and 'e' in dom.classes(h) for r in outer[:2] for h in direct(r,{'th'})):
        raise EvidenceError('CHANGE_HEADER_MISSING')
    horses=[]; seen=set(); refs=set()
    for index,(start,number) in enumerate(anchors):
        no=int(dom.clean(number.text()))
        if no in seen: raise EvidenceError('DUPLICATE_HORSE_NO')
        seen.add(no)
        end=anchors[index+1][0] if index+1<len(anchors) else len(outer)
        block=outer[start:end]
        if len(block)!=5: raise EvidenceError('HORSE_BLOCK_NOT_FIVE_ROWS')
        links=[a for c in dom.cells(block[0]) for a in c.walk('a') if 'horseName' in dom.classes(a)]
        if len(links)!=1 or not dom.clean(links[0].text()): raise EvidenceError('HORSE_IDENTITY_AMBIGUOUS')
        ref=urljoin(url,links[0].attrs.get('href',''))
        if not re.fullmatch(r'https://www\.keiba\.go\.jp/KeibaWeb/DataRoom/HorseMarkInfo\?k_lineageLoginCode=\d+',ref) or ref in refs:
            raise EvidenceError('HORSE_LINK_INVALID_OR_DUPLICATE')
        refs.add(ref)
        infos=[(i,j,c) for i,r in enumerate(block) for j,c in enumerate(dom.cells(r)) if 'info' in dom.classes(c)]
        expected_cell = infos[0] if len(infos)==1 and infos[0][:2]==(4,2) else None
        cell_record=None
        if expected_cell:
            i,j,cell=expected_cell
            if cell.source_end is None: raise EvidenceError('CHANGE_CELL_UNCLOSED')
            raw_text=cell.text(); normalized=dom.clean(raw_text)
            cell_record={'raw_text':raw_text,'normalized_text':normalized,
                'raw_html':html[cell.source_start:cell.source_end],
                'attributes':cell.attrs,'location':location(cell,table_index,start+i,j),
                'block_row':5,'direct_cell_number':3}
            extraction='PRESENT_EMPTY' if normalized=='' else 'PRESENT_NONEMPTY'
            reason='EMPTY_CHANGE_CELL' if normalized=='' else 'UNCONFIRMED_OFFICIAL_LABEL'
        else:
            extraction='MISSING' if not infos else 'AMBIGUOUS'
            reason='CHANGE_CELL_MISSING' if not infos else 'CHANGE_CELL_LAYOUT_AMBIGUOUS'
        # No confirmed current cancellation/exclusion/ACTIVE patterns exist in
        # this fixture. Nonempty labels remain UNKNOWN; no guessed allowlist.
        horses.append({'horse_no':no,'horse_name':dom.clean(links[0].text()),'horse_ref':ref,
            'entry_status':'UNKNOWN','status_at_capture':'UNKNOWN','latest_status':'UNKNOWN',
            'reason':reason,'change_info':{'existence_count':len(infos),'extraction_status':extraction,
                'cell':cell_record,'candidate_locations':[location(c,table_index,start+i,j) for i,j,c in infos]},
            'horse_anchor':location(number,table_index,start,dom.cells(block[0]).index(number))})
    if seen!=set(range(1,10)): raise EvidenceError('KOCHI3_FIELD_NOT_NINE_UNIQUE_HORSES')
    return {'schema':'LAB_SHADOW_COLLECTOR_V1_KOCHI3','parser_version':'KOCHI3_CHANGE_CELL_V1',
        'race':{**RACE,'post_time':'2026-10-10T16:40:00+09:00'},
        'source':{'evidence_json':evidence,'html_sha256':digest,'html_byte_length':len(html_bytes),
            'captured_at':evidence['download_completed_at'],'http_status':None,
            'http_status_reason':'NOT_RECORDED_IN_CARD_FETCH_JSON','source_kind':'SAVED_HTML',
            'origin_evidence':'../official-history-pilot/card-fetch.json',
            'origin_html':'../official-history-pilot/evidence/kochi3-card.html'},
        'official_status_patterns_confirmed':False,'production_dispatch_allowed':False,
        'ready_evaluated':False,'latest_status_checked':False,'horses':horses}

def main():
    html=(SOURCE/'evidence/kochi3-card.html').read_bytes()
    evidence=json.loads((SOURCE/'card-fetch.json').read_text())
    result=collect(html,evidence)
    output=ROOT/'kochi3-field-status.json'
    with output.open('x',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2); f.write('\n')
    print('Saved 9 horses, all UNKNOWN; no READY evaluation.')

if __name__=='__main__': main()
