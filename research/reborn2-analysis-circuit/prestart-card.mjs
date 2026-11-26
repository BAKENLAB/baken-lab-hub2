import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function retainPrestartCard(path,{sourceUrl,expectedSourceUrl,fetchedAt,postTime,bytes}) {
  const fetched=Date.parse(fetchedAt), post=Date.parse(postTime);
  let url;
  try { url=new URL(sourceUrl); } catch { throw Error('INVALID_OFFICIAL_CARD'); }
  if (url.origin!=='https://www.keiba.go.jp' || url.pathname!=='/KeibaWeb/TodayRaceInfo/DebaTable' ||
      sourceUrl!==expectedSourceUrl || !Number.isFinite(fetched) || !Number.isFinite(post) || fetched>=post ||
      !(bytes instanceof Uint8Array) || !bytes.length || bytes.length>2_000_000) throw Error('INVALID_OFFICIAL_CARD');
  const body=Buffer.from(bytes);
  const envelope={sourceUrl,fetchedAt,postTime,raw_sha256:digest(body),body:body.toString('base64')};
  const text=JSON.stringify(envelope);
  await writeFile(path,text,{flag:'wx',mode:0o600});
  return digest(text);
}
export async function readPrestartCard(path,expectedDigest) {
  const text=await readFile(path,'utf8');
  if(digest(text)!==expectedDigest) throw Error('CARD_ENVELOPE_CHANGED');
  const card=JSON.parse(text), bytes=Buffer.from(card.body,'base64');
  if(digest(bytes)!==card.raw_sha256) throw Error('CARD_BYTES_CHANGED');
  return {...card,bytes};
}
