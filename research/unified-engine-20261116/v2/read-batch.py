"""Read exactly one <=5-race archive member. Does not access DB or network."""
import argparse,base64,hashlib,io,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('path',type=Path);p.add_argument('role',choices=['features','labels']);a=p.parse_args()
x=json.loads(a.path.read_text());b=base64.b64decode(x['archive_base64'],validate=True)
if hashlib.sha256(b).hexdigest()!=x['archive_sha256']:raise ValueError('Archive hash mismatch')
name='features.json' if a.role=='features' else 'official-results.json'
with zipfile.ZipFile(io.BytesIO(b)) as z:
 manifest=json.loads(z.read('manifest.json'));record=next(f for f in manifest['files'] if f['path']==name);raw=z.read(name)
 if len(raw)!=record['bytes'] or hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Member hash mismatch')
 rows=json.loads(raw)['rows'];ids={'/'.join(str(r[k]) for k in ['race_date','track','race_no']) for r in rows}
 if len(ids)>5 or len(ids)!=x['races'] or len(rows)!=x['horses']:raise ValueError('At most 5 races per run')
 print(json.dumps({'rows':rows,'archive_sha256':x['archive_sha256'],'member_sha256':record['sha256']},ensure_ascii=False))
