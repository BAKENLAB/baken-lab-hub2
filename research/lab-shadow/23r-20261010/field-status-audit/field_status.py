"""SHADOW-only conservative archived-card parser. No network or DB access."""
import importlib.util, pathlib, re
from urllib.parse import urljoin
P=pathlib.Path(__file__).resolve().parent.parent/'official-history-pilot/extract-evidence.py'
spec=importlib.util.spec_from_file_location('pilot_dom',P); dom=importlib.util.module_from_spec(spec); spec.loader.exec_module(dom)

def status_from_current(texts, structural_proof):
    text=' '.join(texts)
    cancelled='取消' in text; excluded='除外' in text
    if cancelled and excluded: return 'UNVERIFIED'
    if (cancelled or excluded) and re.search(r'\d+(?:\.\d+)?\s*\(\d+人気\)',text): return 'UNVERIFIED'
    if cancelled: return 'CANCELLED'
    if excluded: return 'EXCLUDED'
    if '中止' in text or not structural_proof: return 'UNVERIFIED'
    return 'ACTIVE'

def parse_card(html, race):
    root=dom.DOM(html).root
    headers=[dom.clean(n.text()) for n in root.walk('h4')]
    compact=''.join(headers).replace(' ','')
    date=race['race_date'].split('-')
    if f'{int(date[0])}年{int(date[1])}月{int(date[2])}日' not in compact or f"{race['track']}第{race['race_no']}競走" not in compact:
        raise ValueError('OFFICIAL_RACE_HEADER_MISMATCH')
    output=[]; seen=set()
    for a in root.walk('a'):
        if 'horseName' not in dom.classes(a): continue
        tr=dom.ancestor(a,'tr'); table=dom.ancestor(tr,'table'); cs=dom.cells(tr)
        nums=[c for c in cs if 'horseNum' in dom.classes(c)]
        if len(nums)!=1 or not dom.clean(nums[0].text()).isdigit(): raise ValueError('HORSE_NO_UNVERIFIED')
        no=int(dom.clean(nums[0].text()))
        if no in seen or not 1<=no<=20: raise ValueError('HORSE_NO_CONFLICT')
        seen.add(no)
        outer=[r for r in table.walk('tr') if dom.ancestor(r.parent,'table') is table]; ix=outer.index(tr)
        end=next((i for i in range(ix+1,len(outer)) if any('horseNum' in dom.classes(c) for c in dom.cells(outer[i]))),len(outer))
        block=outer[ix:end]
        # Only named current odds/weight/change cells are status evidence.
        # Past raceInfo/result cells are never passed to the classifier.
        current=[dom.clean(c.text()) for r in block for c in dom.cells(r) if 'odds_weight' in dom.classes(c)]
        history=[dom.clean(n.text()) for r in block for n in r.walk('div') if 'raceInfo' in dom.classes(n)]
        links=urljoin(race['official_url'],a.attrs.get('href',''))
        jockey=[n for n in tr.walk('a') if 'jockeyName' in dom.classes(n)]
        attrs=[dom.clean(c.text()) for r in block[1:] for c in dom.cells(r) if not any('raceInfo' in dom.classes(n) for n in c.walk())]
        sex=any(re.fullmatch(r'(牡|牝|セ|セン|騸)\d+',t) for t in attrs)
        weight=any(re.match(r'^(?:[▲△☆◇]\s*)?\d{2}(?:\.\d+)?\s+(?:\d+\s*-\s*){3}\d+',t) for t in attrs)
        proof=bool(current and len(jockey)==1 and sex and weight and re.fullmatch(r'https://www\.keiba\.go\.jp/KeibaWeb/DataRoom/HorseMarkInfo\?k_lineageLoginCode=\d+',links))
        status=status_from_current(current,proof)
        output.append({'horse_no':no,'horse_name':dom.clean(a.text()),'archive_status':status,'current_status':None,'current_status_verification':'UNVERIFIED_NO_FRESH_FETCH','horse_ref':links,'current_status_cells':current,'structural_proof':proof,'past_status_mentions':[t for t in history if re.search('取消|除外|中止',t)],'dom_basis':{'horse_row_index':ix,'current_selector':'own block > direct td.odds_weight','ignored_selector':'div.raceInfo / nested result table'}})
    if not output: raise ValueError('FIELD_EMPTY')
    return output
