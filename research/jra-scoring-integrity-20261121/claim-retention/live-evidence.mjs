import { horseId } from '../../../automation/jra-score-ledger/evidence/primitives.mjs';
import { createHash } from 'node:crypto';
import { sha } from '../../../automation/jra-score-ledger/declared-ledger.mjs';

const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
export function createLiveWriter({ retain }) {
  return async ({ capture, raceId, cname, runners, signal }) => {
    signal?.throwIfAborted();
    if (!raceId || !/^pw01dde\d+\/[a-f\d]+$/i.test(cname) ||
        !(capture.bytes instanceof Uint8Array) || !capture.bytes.length ||
        capture.bytes.length > 512 * 1024 || !Number.isFinite(Date.parse(capture.at)))
      throw Error('INVALID_CARD_CAPTURE');
    const bytes = Buffer.from(capture.bytes);
    return retain({
      schema: 'JRA_LIVE_CARD_CAPTURE_V1', raceId, cname,
      sourceUrl: 'https://www.jra.go.jp/JRADB/accessD.html?CNAME=' + encodeURIComponent(cname),
      fetchedAt: capture.at, bytes: bytes.toString('base64'), rawHash: hashBytes(bytes),
      runners: runners.map(r => ({
        horseNo: r.horse_no, horseId: horseId(r.horse_ref), checkedAt: r.source_checked_at,
        histories: r.past_runs.map(sha)
      }))
    }, { signal });
  };
}

export async function verifyLiveSlot({ contextHash, jobId, horseNo, slot, observedAt, leaseUntil, saveCutoff },
  { readAuthorized, verifyReceipt, parsePinnedCard, now = Date.now }) {
  const deadline = Math.min(Date.parse(leaseUntil), Date.parse(saveCutoff));
  if (slot?.source_kind !== 'LIVE' || slot.selection_tied || !slot.live_input ||
      !Number.isFinite(deadline) || now() >= deadline) return null;
  const id = horseId(slot.horse_ref);
  if (!id || !slot.live_race_id) return null;
  const historyHash = sha(slot.live_input);
  const request = { jobId, contextHash, horseNo, horseId:id, raceId:slot.live_race_id,
    checkedAt:slot.source_checked_at, historyHash };
  const packets = await readAuthorized(request);
  if (packets?.length !== 1) return null;
  const packet = packets[0], doc = packet.document;
  if (!await verifyReceipt(packet, request) || doc.schema !== 'JRA_LIVE_CARD_CAPTURE_V1' ||
      doc.raceId !== request.raceId || !(Date.parse(doc.fetchedAt) <= Date.parse(request.checkedAt) &&
        Date.parse(request.checkedAt) <= Date.parse(observedAt) && Date.parse(observedAt) <= now())) return null;
  const bytes = Buffer.from(doc.bytes, 'base64');
  if (!bytes.length || bytes.length > 512*1024 || hashBytes(bytes) !== doc.rawHash) return null;
  const roster = doc.runners.filter(h => h.horseNo === horseNo && h.horseId === id &&
    h.checkedAt === request.checkedAt && h.histories.filter(x => x === historyHash).length === 1);
  if (roster.length !== 1) return null;
  const parsed = await parsePinnedCard(bytes, doc);
  const horses = parsed.filter(h => h.horse_no === horseNo && horseId(h.horse_ref) === id);
  if (horses.length !== 1 || horses[0].past_runs.filter(run => sha(run) === historyHash).length !== 1 ||
      now() >= deadline) return null;
  return { horseNo, historyHash, rawHash: doc.rawHash, fetchedAt: doc.fetchedAt };
}
