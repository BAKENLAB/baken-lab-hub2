"""Offline DOM extraction only. No network, DB, scoring or inferred facts."""
import json, pathlib, re, unicodedata, datetime, hashlib
from html.parser import HTMLParser
from urllib.parse import urljoin

ROOT = pathlib.Path(__file__).resolve().parent
class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def walk(self, tag=None):
        for c in self.children:
            if isinstance(c, Node):
                if tag is None or c.tag == tag: yield c
                yield from c.walk(tag)
    def text(self):
        return ''.join(c.text() if isinstance(c, Node) else c for c in self.children)
class DOM(HTMLParser):
    def __init__(self, body):
        super().__init__(convert_charrefs=True); self.root = Node(); self.stack = [self.root]; self.feed(body)
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.stack[-1]); self.stack[-1].children.append(n)
        if tag not in {'br','hr','img','input','meta','link','wbr','source','area','base','embed','param','col'}: self.stack.append(n)
        elif tag == 'br': n.children.append(' ')
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag == tag: self.stack = self.stack[:i]; break
    def handle_data(self, s): self.stack[-1].children.append(s)
def clean(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC',s)).strip()
def cells(tr): return [c for c in tr.children if isinstance(c,Node) and c.tag in {'td','th'}]
def classes(n): return n.attrs.get('class','').split()
def ancestor(n, tag):
    while n and n.tag != tag: n = n.parent
    return n

def extract():
    raw=json.loads((ROOT.parent/'2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json').read_text())
    race=next(r for r in raw['races'] if r['track']=='高知' and r['race_no']==3)
    card_path=ROOT/'evidence/kochi3-card.html'; card=DOM(card_path.read_text()).root
    log=json.loads((ROOT/'fetch-log.json').read_text()); runners=[]
    for h in race['runners']:
        if h['status'] != 'ACTIVE': continue
        links=[a for a in card.walk('a') if 'horseName' in classes(a) and clean(a.text())==h['horse_name']]
        entry={'raw':h,'profile':None,'current':None,'horse_link_evidence':None}
        if len(links)==1:
            a=links[0]; tr=ancestor(a,'tr'); table=ancestor(tr,'table'); trs=list(table.walk('tr')); ix=trs.index(tr)
            # Horse blocks consist of five outer rows; nested result tables are excluded.
            outer=[r for r in trs if ancestor(r.parent,'table') is table]; block=outer[outer.index(tr):outer.index(tr)+5]
            cs=cells(tr); no=[c for c in cs if 'horseNum' in classes(c)]
            owned=urljoin(race['official_url'],a.attrs['href'])
            if len(no)==1 and clean(no[0].text())==str(h['horse_no']) and owned==h['profile_url']:
                entry['horse_link_evidence']={'horse_no':h['horse_no'],'row_index':ix,'horse_cell_index':cs.index(ancestor(a,'td')),'deba_source_ref':race['official_url'],'horse_ref':owned}
                b2=cells(block[1]); b3=cells(block[2]); draws=[c for c in cs if 'courseNum' in classes(c)]
                sex=clean(b2[0].text()); weight_match=re.match(r'^(?:[☆★◇△▲]\s*)?(\d+(?:\.\d+)?)\s',clean(b2[3].text())+' ')
                wt=weight_match.group(1) if weight_match else ''
                if not draws:
                    oi=outer.index(tr)
                    for previous in reversed(outer[:oi]):
                        candidates=[c for c in cells(previous) if 'courseNum' in classes(c)]
                        if candidates:
                            if outer.index(previous)+int(candidates[0].attrs.get('rowspan','1'))>oi: draws=candidates
                            break
                jockey=[x for x in tr.walk('a') if 'jockeyName' in classes(x)]
                trainers=[x for x in block[2].walk('a') if 'TrainerMark' in x.attrs.get('href','')]
                odds=[clean(c.text()) for r in block for c in cells(r) if 'odds_weight' in classes(c)]
                entry['current']={'sex_age':sex if re.fullmatch(r'(牡|牝|セ|セン|騸)\d+',sex) else None,'weight_carried':float(wt) if re.fullmatch(r'\d+(\.\d+)?',wt) else None,'jockey':clean(jockey[0].text()) if len(jockey)==1 else None,'draw':int(clean(draws[0].text())) if len(draws)==1 and clean(draws[0].text()).isdigit() else None,'trainer':clean(trainers[0].text()) if len(trainers)==1 else None,'body_weight':None,'equipment':None,'status_text':odds}
        fetch=next(x for x in log if x['horse_no']==h['horse_no'])
        if fetch.get('status')==200:
            doc=DOM((ROOT/fetch['path']).read_text()).root
            entry['profile_html_sha256']=hashlib.sha256((ROOT/fetch['path']).read_bytes()).hexdigest()
            entry['profile']={'ok':True,'diagnostic_only':True,'url':fetch['url'],'fetched_at':fetch['fetched_at'],'truncated':False,'body':clean(doc.text()),'rows':[{'cells':[clean(c.text()) for c in cells(tr)]} for tr in doc.walk('tr')]}
        runners.append(entry)
    output={'race':{**{k:race[k] for k in ['race_date','track','race_no','official_url']},'circuit':'LOCAL','post_time':race['race_date']+'T'+race['scheduled_start']+':00+09:00'},'card':{'url':race['official_url'],'path':'evidence/kochi3-card.html','sha256':hashlib.sha256(card_path.read_bytes()).hexdigest(),'download_completed_at':json.loads((ROOT/'card-fetch.json').read_text())['download_completed_at']},'runners':runners,'ready_changed':False}
    return output

if __name__ == "__main__":
    import sys
    output=extract()
    if "--stdout" in sys.argv:
        print(json.dumps(output,ensure_ascii=False))
    else:
        with (ROOT/"extracted-evidence.json").open("x") as f:
            json.dump(output,f,ensure_ascii=False,indent=2); f.write("\n")
        print("Extracted",len(output["runners"]),"horses; not an admission verdict.")
