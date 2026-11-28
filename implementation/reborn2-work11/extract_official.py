"""Offline official HTML -> reviewable derived projection. No network, no DB.
Use only independently authorized local bytes; projection is NOT official original.
CLI: python extract_official.py metadata.json original.html output.json
metadata must be independently reviewed and pinned by the local operator.
Do not upload original or projection to GitHub/CI.
"""
import hashlib, json, re, sys, unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urljoin
from datetime import datetime, timedelta, timezone
NAR={'盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32','門別':'36'}
JRA=['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']
def need(x,msg):
    if not x: raise ValueError(msg)
def clean(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s)).strip()
def exact(x,ks): need(isinstance(x,dict) and set(x)==set(ks),'FIELDS')
def stamp(s):
    t=datetime.fromisoformat(s.replace('Z','+00:00'))
    need(t.tzinfo is not None,'TIME_OFFSET'); return t
class Node:
    def __init__(self,tag,attrs,parent=None): self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[];self.index=None
    def text(self): return ''.join(c.text() if isinstance(c,Node) else c for c in self.children)
    def all(self,tag=None):
        for c in self.children:
            if isinstance(c,Node):
                if tag is None or c.tag==tag: yield c
                yield from c.all(tag)
    def classes(self): return set(self.attrs.get('class','').split())
class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.root=Node('root',[]);self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        if tag in ('tr','td','th','li','p'):
            stop={'tr':{'table','tbody','thead','tfoot'},'td':{'tr'},'th':{'tr'},'li':{'ul','ol'},'p':set()}[tag]
            for i in range(len(self.stack)-1,0,-1):
                t=self.stack[i].tag
                if t in stop: break
                if t==tag or tag in ('td','th') and t in ('td','th'):
                    self.stack=self.stack[:i];break
        n=Node(tag,attrs,self.stack[-1]);self.stack[-1].children.append(n)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.stack.append(n)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if self.stack[-1].tag==tag:self.stack.pop()
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:self.stack=self.stack[:i];break
    def handle_data(self,s):
        if not any(n.tag in ('script','style') for n in self.stack):self.stack[-1].children.append(s)
def rows(root):
    out=[]
    for i,r in enumerate(root.all('tr')):
        cells=[n for n in r.children if isinstance(n,Node) and n.tag in ('td','th')]
        if cells: out.append((i,r,cells))
    return out
def txt(n):return clean(n.text())
def id_link(n,base,circuit):
    found=[]
    for a in n.all('a'):
        u=urlparse(urljoin(base,a.attrs.get('href','')))
        if u.scheme!='https' or u.netloc!=('www.jra.go.jp' if circuit=='JRA' else 'www.keiba.go.jp') or u.fragment:continue
        p=parse_qs(u.query,keep_blank_values=True)
        if circuit=='JRA':
            m=re.fullmatch(r'pw01dud(?:00|10)([0-9]{10})/[0-9A-Fa-f]{2}',(p.get('CNAME') or [''])[0])
            if u.path=='/JRADB/accessU.html' and set(p)=={'CNAME'} and len(p['CNAME'])==1 and m:found.append(m[1])
        elif u.path=='/KeibaWeb/DataRoom/HorseMarkInfo' and set(p)<= {'k_lineageLoginCode','k_activeCode'} and len(p.get('k_lineageLoginCode',[]))==1 and re.fullmatch(r'[0-9]{1,30}',p['k_lineageLoginCode'][0]) and (not 'k_activeCode' in p or len(p['k_activeCode'])==1 and re.fullmatch(r'[0-9]{1,3}',p['k_activeCode'][0])):
            found.append(p['k_lineageLoginCode'][0])
    found=set(found);need(len(found)==1,'HORSE_LINK_NOT_UNIQUE');return next(iter(found))
def field(value,row,col,**extra):return {'literal':value,'pointer':{'row':row,'column':col,**extra}}
def urlcheck(meta,path,keys):
    u=urlparse(meta['sourceRef']);need(u.scheme=='https' and u.netloc=='www.keiba.go.jp' and u.path==path and not u.fragment,'NAR_URL')
    p=parse_qs(u.query,keep_blank_values=True);need(set(p)==set(keys) and all(len(v)==1 for v in p.values()) and all(p[k]==[v] for k,v in keys.items()),'NAR_QUERY')
def nar_card(root,meta):
    urlcheck(meta,'/KeibaWeb/TodayRaceInfo/DebaTable',{'k_babaCode':meta['venueId'],'k_raceDate':meta['dateJst'].replace('-','/'),'k_raceNo':str(meta['raceNo'])})
    rs=rows(root);main=[]
    for i,r,cs in rs:
        vs=[txt(c) for c in cs]
        for j,c in enumerate(cs):
            links=[a for a in c.all('a') if '/HorseMarkInfo' in a.attrs.get('href','')]
            if not links:continue
            if any(re.search(r'\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}',s) for s in vs[:j]):continue
            nums=[(k,int(s)) for k,s in enumerate(vs[:j]) if re.fullmatch(r'\d{1,2}',s)]
            if not nums or j+1>=len(cs) or not re.fullmatch(r'.+[（(][^）)]+[）)]',vs[j+1]):continue
            no=nums[-1][1];need(1<=no<=20,'HORSE_NO')
            main.append((i,j,cs,vs,no,id_link(c,meta['sourceRef'],'LOCAL'),nums))
    need(main and len(main)<=20 and len({x[0] for x in main})==len(main),'CARD_ROW_LAYOUT')
    body=clean(root.text());lead=body.split(main[0][3][main[0][1]],1)[0]
    m=re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日\s*(?:\([^)]*\))?\s*'+re.escape(meta['track'])+r'\s*第\s*(\d+)競走',lead)
    need(m and [int(m[1]),int(m[2]),int(m[3])]==list(map(int,meta['dateJst'].split('-'))) and int(m[4])==meta['raceNo'],'CARD_HEADER')
    times=re.findall(r'発走\s*(?:時刻)?\s*[:：]?\s*(\d{1,2})[:時](\d{2})(?:分)?',lead)
    need(len(set(times))==1,'POST_HEADER')
    hh,mm=times[0];post=datetime.fromisoformat(meta['dateJst']+'T'+hh.zfill(2)+':'+mm+':00+09:00')
    need(post==stamp(meta['scheduledPost']),'POST_MISMATCH')
    ef={}
    course=re.findall(r'(ダート|芝)\s*(\d{3,4})\s*m(?:\s*\((右|左|直)[^)]*\))?',lead)
    if len(set(course))==1:
        a,b,c=course[0];ef['surfaceLiteral']=field(a,'header','course');ef['distanceM']=field(b,'header','course')
        if c:ef['directionLiteral']=field('直線' if c=='直' else c,'header','course')
    going=re.findall(r'馬場\s*[:：]?\s*(不良|稍重|良|重)',lead)
    if len(set(going))==1:ef['goingLiteral']=field(going[0],'header','going')
    # Count and class must be explicit in the original, never inferred from rows.
    count=re.findall(r'(?:出走頭数|出走馬)\s*[:：]?\s*(\d{1,2})頭',lead)
    if len(set(count))==1:ef['declaredCount']=field(count[0],'header','declaredCount')
    output=[]
    for idx,(i,j,cs,vs,no,hid,nums) in enumerate(main):
        # Current row only; past rows/market never copied. A status applies
        # only to the independently reviewed full numbered card.
        current=[]
        for k,s in enumerate(vs):
            if re.search(r'\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}',s):break
            current.append((k,s))
        status=[(k,'CANCELLED' if '取消' in s else 'EXCLUDED') for k,s in current if '取消' in s or '除外' in s]
        need(len({v for _,v in status})<=1,'STATUS_CONFLICT')
        ff={'displayName':field(vs[j],i,j),'status':field(status[0][1] if status else 'ACTIVE',i,status[0][0] if status else 'numbered_current_row')}
        # A frame number is only used if it is explicitly in this row.
        if len(nums)==2 and 1<=nums[0][1]<=8:ff['gate']=field(str(nums[0][1]),i,nums[0][0])
        end=main[idx+1][0] if idx+1<len(main) else i+8
        for ri,rr,ac in rs:
            if not i<=ri<end:continue
            ats=[txt(c) for c in ac]
            if any(re.search(r'\d{2,4}[./年-]\d{1,2}[./月-]\d{1,2}',s) for s in ats):continue
            for k,s in enumerate(ats):
                if re.fullmatch(r'(?:牡|牝|セ|セン|騸|騙)\d+',s):
                    val=re.sub(r'^(?:セン|騸|騙)','セ',s)
                    if 'sexAge' not in ff:ff['sexAge']=field(val,ri,k)
                    else:need(ff['sexAge']['literal']==val,'SEX_AGE_CONFLICT')
                w=re.match(r'^(?:[▲△☆◇]\s*)?(\d{2}(?:\.\d+)?)\s+(?:\d+\s*-\s*){3}\d+(?:\s|$)',s)
                if w and 40<=float(w[1])<=70:
                    if 'weightG' not in ff:ff['weightG']=field(w[1],ri,k)
                    else:need(ff['weightG']['literal']==w[1],'WEIGHT_CONFLICT')
        output.append({'horseId':hid,'horseNo':no,'displayName':vs[j],'fields':ff})
    need(len({h['horseNo'] for h in output})==len(output) and len({h['horseId'] for h in output})==len(output),'CARD_DUPLICATE')
    return ef,output
HEADER=['年月日','競馬場','R','競走名','格組','距離','天候・馬場','頭数','枠','馬番','人気','着順','タイム','差','上3F','体重','騎手(所属)','重量','調教師','収得賞金','1着馬または(2着馬)']
def nar_history(root,meta):
    u=urlparse(meta['sourceRef']);p=parse_qs(u.query,keep_blank_values=True)
    need(u.scheme=='https' and u.netloc=='www.keiba.go.jp' and u.path=='/KeibaWeb/DataRoom/HorseMarkInfo' and not u.fragment and set(p)<= {'k_lineageLoginCode','k_activeCode'} and p.get('k_lineageLoginCode')==[meta['horseId']] and re.fullmatch(r'\d{1,30}',meta['horseId']) and (not 'k_activeCode' in p or len(p['k_activeCode'])==1 and re.fullmatch(r'\d{1,3}',p['k_activeCode'][0])),'PROFILE_URL')
    need(meta['dateJst']<meta['targetDateJst'],'HISTORY_CUTOFF')
    lead=clean(root.text()).split('年月日',1)[0]
    need(meta['displayName'] in lead and re.search(r'(?:牡|牝|セ|セン|騸)\d+\s+(?:現役|抹消)',lead),'PROFILE_HEADER')
    rs=rows(root);heads=[i for i,r,cs in rs if [txt(c) for c in cs]==HEADER];need(len(heads)==1,'PROFILE_LAYOUT')
    hits=[]
    for i,r,cs in rs:
        if i<=heads[0]:continue
        v=[txt(c) for c in cs]
        if not v or v[0]!=meta['dateJst'].replace('-','/') or len(v)<3 or v[1]!=meta['track'] or v[2]!=str(meta['raceNo']):continue
        need(len(v)==23 and v[11]==str(meta['horseNo']),'PROFILE_ROW_MISMATCH');hits.append((i,v))
    need(len(hits)==1,'PROFILE_ROW_UNIQUE');i,v=hits[0]
    ef={}
    for k,col in [('classLiteral',4),('goingLiteral',7),('declaredCount',9)]:
        # expanded official layout: head count column position must be
        # verified separately; don't assign it from an uncertain column.
        if k!='declaredCount' and v[col]:ef[k]=field(v[col],i,col)
    dm=re.fullmatch(r'(芝|ダート|ダ)?(\d+)',v[5])
    if dm:
        ef['distanceM']=field(dm[2],i,5)
        if dm[1]:ef['surfaceLiteral']=field(dm[1],i,5)
    ff={}
    for k,col in [('finish',13),('finishClockLiteral',14),('officialMarginLiteral',15),('final600Ms',16),('bodyWeightKg',17),('weightG',19)]:
        if v[col]:ff[k]=field(v[col],i,col)
    return ef,[{'horseId':meta['horseId'],'horseNo':meta['horseNo'],'displayName':meta['displayName'],'fields':ff}]
def jra_corners(root,meta):
    u=urlparse(meta['sourceRef']);p=parse_qs(u.query,keep_blank_values=True)
    need(u.scheme=='https' and u.netloc=='www.jra.go.jp' and u.path=='/JRADB/accessS.html' and not u.fragment and set(p)=={'CNAME'} and len(p['CNAME'])==1,'JRA_RESULT_URL')
    m=re.fullmatch(r'pw01sde(?:01|10)(\d{2})(\d{4})\d{4}(\d{2})(\d{8})/[0-9A-Fa-f]{2}',p['CNAME'][0])
    need(m and m[1]==meta['venueId'] and m[2]==meta['dateJst'][:4] and int(m[3])==meta['raceNo'] and m[4]==meta['dateJst'].replace('-','') and JRA[int(m[1])-1]==meta['track'] and meta['dateJst']<meta['targetDateJst'],'JRA_RESULT_TUPLE')
    rs=rows(root);groups=[]
    for i,r,cs in rs:
        if len(cs)!=2 or cs[0].tag!='th':continue
        mm=re.fullmatch(r'(?:第)?([1-4])コーナー',txt(cs[0]))
        if not mm:continue
        s=txt(cs[1]);need(re.fullmatch(r'[\d,() *+\-=]+',s),'CORNER_GROUP_LAYOUT')
        # Parentheses are a printed group, not precise internal position.
        tokens=re.findall(r'\([^()]+\)|\d+',s);flat=[];ranges={}
        for tok in tokens:
            ns=list(map(int,re.findall(r'\d+',tok)));need(ns and all(1<=n<=24 for n in ns),'GROUP_HORSE_NO')
            low=len(flat)+1;flat.extend(ns);high=len(flat)
            for n in ns:need(n not in ranges,'DUPLICATE_GROUP_NUMBER');ranges[n]=[low,high]
        need(flat,'EMPTY_GROUP');groups.append((int(mm[1]),i,s,ranges))
    labels=[g[0] for g in groups]
    need(labels and labels==sorted(set(labels)),'CORNER_LABEL_ORDER')
    output=[]
    for i,r,cs in rs:
        by={}
        for k,c in enumerate(cs):
            for name in ('num','horse','corner'):
                if name in c.classes():need(name not in by,'DUPLICATE_CELL');by[name]=(k,c)
        if not {'num','horse','corner'}<=set(by):continue
        no=txt(by['num'][1]);need(re.fullmatch(r'\d{1,2}',no),'JRA_HORSE_NO');no=int(no)
        h=by['horse'][1];hid=id_link(h,meta['sourceRef'],'JRA');literal=txt(by['corner'][1])
        if not re.fullmatch(r'\d{1,2}(?:[\s,-]+\d{1,2})*',literal):continue
        positions=list(map(int,re.findall(r'\d+',literal)))
        # Explicit label table and every horse's membership and range must
        # agree. Number of tokens alone is never enough.
        if len(positions)!=len(groups) or any(no not in g[3] or not g[3][no][0]<=pos<=g[3][no][1] for g,pos in zip(groups,positions)):continue
        ff={'cornerPositionsLiteral':field(literal,i,by['corner'][0],cornerLabels=labels,groupRows=[{'row':g[1],'label':g[0],'literal':g[2],'positionRange':g[3][no]} for g in groups])}
        output.append({'horseId':hid,'horseNo':no,'displayName':txt(h),'fields':ff})
    need(output and len({h['horseId'] for h in output})==len(output) and len({h['horseNo'] for h in output})==len(output),'JRA_CORNER_ROWS')
    return {},output
def main():
    need(len(sys.argv)==4,'ARGUMENTS')
    meta=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    base=['format','sourceRef','originalSha256','encoding','nativeRaceId','dateJst','venueId','track','raceNo','checkedAt','targetDateJst']
    mode=meta.get('format');extra={'NAR_DEBA_HTML_PROJECTION_1':['scheduledPost'],'NAR_HISTORY_HTML_PROJECTION_1':['horseId','horseNo','displayName'],'JRA_CORNER_HTML_PROJECTION_1':[]}
    need(mode in extra,'FORMAT');exact(meta,base+extra[mode]);need(re.fullmatch(r'\d{4}-\d\d-\d\d',meta['dateJst']) and re.fullmatch(r'\d{4}-\d\d-\d\d',meta['targetDateJst']),'DATE');stamp(meta['checkedAt'])
    if mode.startswith('NAR'):need(NAR.get(meta['track'])==meta['venueId'],'VENUE')
    raw=Path(sys.argv[2]).read_bytes();need(0<len(raw)<=16*1024*1024 and hashlib.sha256(raw).hexdigest()==meta['originalSha256'],'ORIGINAL_HASH')
    need(meta['encoding'] in ('utf-8','cp932','shift_jis'),'ENCODING')
    t=Tree();t.feed(raw.decode(meta['encoding'],errors='strict'));t.close()
    ef,hs={'NAR_DEBA_HTML_PROJECTION_1':nar_card,'NAR_HISTORY_HTML_PROJECTION_1':nar_history,'JRA_CORNER_HTML_PROJECTION_1':jra_corners}[mode](t.root,meta)
    result={'metadata':meta,'eventFields':ef,'rows':hs}
    with open(sys.argv[3],'x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(json.dumps({'rows':len(hs),'eventFields':len(ef),'scope':'DERIVED_PROJECTION_REQUIRES_INDEPENDENT_REVIEW'}))
if __name__=='__main__':main()
