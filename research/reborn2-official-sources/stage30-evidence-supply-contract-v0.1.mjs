import crypto from 'node:crypto';

const ALLOWED_HOSTS = new Set([
  'www.jra.go.jp', 'jra.go.jp', 'www.keiba.go.jp', 'keiba.go.jp', 'ppr.keiba.go.jp'
]);
const RIGHTS = ['capture', 'retain', 'cloud_ai', 'derived_publication', 'commercial'];
const ALLOWED_RIGHTS = new Set(['ALLOWED', 'UNCONFIRMED', 'PERMISSION_REQUIRED', 'PROHIBITED', 'NOT_APPLICABLE']);

export function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function validateEvidencePacket(packet, {purpose = 'INTERNAL_RESEARCH'} = {}) {
  const reasons = [];
  if (!packet || typeof packet !== 'object') return {ok:false, reasons:['PACKET_MISSING']};
  let u;
  try { u = new URL(packet.source_url); } catch { reasons.push('SOURCE_URL_INVALID'); }
  if (u && (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname))) reasons.push('SOURCE_NOT_APPROVED_OFFICIAL_HOST');
  if (!(packet.raw_bytes instanceof Uint8Array) || packet.raw_bytes.length === 0) reasons.push('RAW_BYTES_REQUIRED');
  if (!packet.captured_at || Number.isNaN(Date.parse(packet.captured_at))) reasons.push('CAPTURE_TIME_REQUIRED');
  if (!packet.source_published_at || Number.isNaN(Date.parse(packet.source_published_at))) reasons.push('SOURCE_PUBLICATION_TIME_REQUIRED');
  if (!packet.source_version) reasons.push('SOURCE_VERSION_REQUIRED');
  if (!packet.parser_version) reasons.push('PARSER_VERSION_REQUIRED');
  if (!packet.identity?.event_id) reasons.push('EVENT_ID_REQUIRED');
  if (packet.scope !== 'EVENT' && !packet.identity?.horse_id) reasons.push('HORSE_ID_REQUIRED');
  if (!packet.rights || typeof packet.rights !== 'object') reasons.push('RIGHTS_MATRIX_REQUIRED');
  for (const r of RIGHTS) {
    if (!packet.rights || !ALLOWED_RIGHTS.has(packet.rights[r])) reasons.push(`RIGHT_${r.toUpperCase()}_INVALID`);
  }
  const needed = purpose === 'PUBLIC_DERIVED_OUTPUT'
    ? ['capture','retain','cloud_ai','derived_publication']
    : purpose === 'COMMERCIAL_OUTPUT'
      ? ['capture','retain','cloud_ai','derived_publication','commercial']
      : ['capture','retain','cloud_ai'];
  for (const r of needed) if (packet.rights?.[r] !== 'ALLOWED') reasons.push(`RIGHT_${r.toUpperCase()}_NOT_ALLOWED`);
  if (packet.target_cutoff && Date.parse(packet.source_published_at) > Date.parse(packet.target_cutoff)) reasons.push('PUBLISHED_AFTER_TARGET_CUTOFF');
  if (packet.target_cutoff && Date.parse(packet.captured_at) > Date.parse(packet.target_cutoff)) reasons.push('CAPTURED_AFTER_TARGET_CUTOFF');
  if (packet.contains_target_outcome && packet.mode === 'PRE_RACE') reasons.push('TARGET_OUTCOME_FORBIDDEN');
  if (packet.measurement_scope === 'INDIVIDUAL' && packet.material_type === 'RACE_LEADER_LAPS') reasons.push('RACE_LAPS_MISLABELED_INDIVIDUAL');
  if (packet.material_type === 'CORNER_GROUP_ORDER' && packet.measurement_unit && packet.measurement_unit !== 'ORDER_GROUP') reasons.push('CORNER_GROUP_UNIT_INVALID');
  if (packet.identity?.join_method === 'HORSE_NAME_ONLY') reasons.push('NAME_ONLY_IDENTITY_FORBIDDEN');
  if (packet.raw_bytes instanceof Uint8Array && packet.raw_sha256 !== sha256(packet.raw_bytes)) reasons.push('RAW_SHA256_MISMATCH');
  return {ok: reasons.length === 0, reasons:[...new Set(reasons)].sort(), formal:false};
}

export function buildTypedObservation(packet, field, value, unit) {
  const gate = validateEvidencePacket(packet);
  if (!gate.ok) return {status:'HELD', value:null, reasons:gate.reasons, formal:false};
  if (value === undefined || value === null || value === '') return {status:'MISSING', value:null, reasons:['VALUE_NOT_PUBLISHED'], formal:false};
  return {
    status:'RESEARCH_ONLY', field, value, unit:unit ?? null,
    event_id:packet.identity.event_id,
    horse_id:packet.scope === 'EVENT' ? null : packet.identity.horse_id,
    source_url:packet.source_url,
    source_version:packet.source_version,
    captured_at:packet.captured_at,
    published_at:packet.source_published_at,
    raw_sha256:packet.raw_sha256,
    parser_version:packet.parser_version,
    rights:{...packet.rights},
    formal:false
  };
}
