import {executeFixture} from './adapter.mjs';
import {saveCompact} from './compact-store.mjs';
import {startPreview} from './mobile-preview.mjs';
const [fixture='FK34_FULL',root,port='8765']=process.argv.slice(2);
if(!root)throw Error('Specify isolated local archive directory');
const out=await saveCompact(root,await executeFixture(fixture));
const preview=await startPreview(out.root,out.manifestDigest,Number(port));
console.log(JSON.stringify({...out,url:preview.url,scope:'FIXTURE_ONLY'}));
