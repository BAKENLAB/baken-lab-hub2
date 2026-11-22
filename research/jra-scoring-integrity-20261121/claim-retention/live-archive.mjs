import { canonical, sha } from '../../../automation/jra-score-ledger/evidence/primitives.mjs';

// Supply two separate server-only connections with the roles in the candidate SQL.
export function createLiveArchive({ writer, reader }) {
  return {
    async retain(document, { signal } = {}) {
      signal?.throwIfAborted();
      const { bytes, raceId, fetchedAt, rawHash, ...metadata } = document;
      const key = sha(canonical(document));
      await writer.query(
        `INSERT INTO private.jra_live_card_archive_v1
          (receipt_key,race_id,fetched_at,raw_bytes,raw_sha256,card_metadata)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [key,raceId,fetchedAt,Buffer.from(bytes,'base64'),rawHash,
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
        if (sha(canonical(document)) !== row.receipt_key) throw Error('ARCHIVE_DIGEST_MISMATCH');
        return document;
      });
    }
  };
}
