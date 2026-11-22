import { canonical, sha } from '../../../automation/jra-score-ledger/evidence/primitives.mjs';
import {createHash} from 'node:crypto';

const originalDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Research-only byte integrity. Signed issuer/CLAIM/lease authenticity is
// independently required; a matching self-declared hash is not JRA provenance.
function inspectOriginalBytes(document) {
  if(!document||typeof document!=='object'||typeof document.raceId!=='string'||
    !document.raceId.trim()||typeof document.fetchedAt!=='string'||
    !Number.isFinite(Date.parse(document.fetchedAt))||
    typeof document.bytes!=='string'||typeof document.rawHash!=='string'||
    !/^[0-9a-f]{64}$/.test(document.rawHash)||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(document.bytes))
    throw Error('ORIGINAL_BYTES_DOCUMENT_INVALID');
  const raw=Buffer.from(document.bytes,'base64');
  if(!raw.length||raw.length>512*1024||
    raw.toString('base64')!==document.bytes||
    originalDigest(raw)!==document.rawHash)
    throw Error('ORIGINAL_BYTES_SHA256_MISMATCH');
  return raw;
}

// Supply two separate server-only connections with the roles in the candidate SQL.
export function createLiveArchive({ writer, reader }) {
  return {
    async retain(document, { signal } = {}) {
      signal?.throwIfAborted();
      // Validate the real binary against the incoming SHA before retaining a
      // receipt. Previously a forged hash and bytes could both be persisted.
      const raw=inspectOriginalBytes(document);
      const { bytes, raceId, fetchedAt, rawHash, ...metadata } = document;
      const key = sha(canonical(document));
      await writer.query(
        `INSERT INTO private.jra_live_card_archive_v1
          (receipt_key,race_id,fetched_at,raw_bytes,raw_sha256,card_metadata)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [key,raceId,fetchedAt,raw,rawHash,
          JSON.stringify({ ...metadata, fetchedAt })]
      );
      return key;
    },
    async readPrivateArchive({ raceId, receiptKey }) {
      const { rows } = await reader.query(
        `SELECT receipt_key,race_id,raw_bytes,raw_sha256,card_metadata
         FROM private.jra_live_card_archive_v1 WHERE race_id=$1 AND receipt_key=$2`,
        [raceId,receiptKey]
      );
      return rows.map(row => {
        const document = { ...row.card_metadata, raceId:row.race_id,
          bytes:Buffer.from(row.raw_bytes).toString('base64'), rawHash:row.raw_sha256 };
        inspectOriginalBytes(document);
        if (sha(canonical(document)) !== row.receipt_key) throw Error('ARCHIVE_DIGEST_MISMATCH');
        return document;
      });
    }
  };
}
