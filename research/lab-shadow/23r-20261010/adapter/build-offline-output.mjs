// Explicit local CLI only. Existing artifacts and output files are never overwritten.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {convertDay} from './compact-v1-adapter.mjs';

export async function buildOfflineOutput() {
  const raw=JSON.parse(await readFile(new URL('../2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',import.meta.url),'utf8'));
  const output=convertDay(raw);
  await writeFile(new URL('./compact-v1-offline-output.json',import.meta.url),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  return output.summary;
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) console.log(await buildOfflineOutput());
