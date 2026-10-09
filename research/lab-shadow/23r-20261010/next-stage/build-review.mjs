// Explicit offline CLI; never modifies original evidence or production objects.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {analyzePackage} from './history-review.mjs';

export async function buildReview() {
  const raw=JSON.parse(await readFile(new URL('../2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json',import.meta.url),'utf8'));
  const result=analyzePackage(raw);
  await writeFile(new URL('./history-review-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result.counts;
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) console.log(await buildReview());
