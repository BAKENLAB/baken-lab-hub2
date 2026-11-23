import { sign, verify } from 'node:crypto';
import { canonical, sha } from '../../../automation/jra-score-ledger/evidence/primitives.mjs';

const message = ({ issuer, request, document, expiresAt }) => Buffer.from(canonical({
  type: 'BAKEN_JRA_LIVE_READ_V1', issuer, request, documentHash: sha(canonical(document)), expiresAt
}));

// The broker owns the reader role and signing key. Nothing here trusts caller-supplied gates.
export function createLiveReadBroker({ authorizeExactSlot, readPrivateArchive, issuer, signingKey, now = Date.now }) {
  return async request => {
    const before = await authorizeExactSlot(request);
    if (!before || now() >= before.expiresAt) return [];
    const documents = await readPrivateArchive(before.lookup);
    if (documents.length !== 1) return [];
    const after = await authorizeExactSlot(request);
    if (!after || canonical(before) !== canonical(after) || now() >= after.expiresAt) return [];
    const packet = { issuer, request, document: documents[0], expiresAt: after.expiresAt };
    return [{ ...packet, signature: sign(null, message(packet), signingKey).toString('base64') }];
  };
}

export function createLiveReceiptVerifier({ authorities, now = Date.now }) {
  return (packet, request) => {
    try {
      const key = Object.hasOwn(authorities, packet.issuer) && authorities[packet.issuer];
      return Boolean(key && Number.isSafeInteger(packet.expiresAt) && now() < packet.expiresAt &&
        canonical(packet.request) === canonical(request) &&
        verify(null, message(packet), key, Buffer.from(packet.signature, 'base64')));
    } catch {
      return false;
    }
  };
}
