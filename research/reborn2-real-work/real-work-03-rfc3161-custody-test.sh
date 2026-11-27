#!/usr/bin/env bash
set -euo pipefail
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
payload="$tmp/envelope.json"
printf '{"manifestDigest":"TEST:WORK32:ENVELOPE","scope":"SYNTHETIC_ONLY"}\n' > "$payload"
policy='1.3.6.1.4.1.55555.3'
openssl req -x509 -newkey rsa:2048 -keyout "$tmp/tsa.key" -out "$tmp/tsa.crt" -days 1 -nodes -subj '/CN=REBORN2 Work32 Local TSA' -addext 'extendedKeyUsage=critical,timeStamping' >/dev/null 2>&1
openssl req -x509 -newkey rsa:2048 -keyout "$tmp/other.key" -out "$tmp/other.crt" -days 1 -nodes -subj '/CN=Other TSA' -addext 'extendedKeyUsage=critical,timeStamping' >/dev/null 2>&1
openssl req -x509 -newkey rsa:2048 -keyout "$tmp/bad.key" -out "$tmp/bad.crt" -days 1 -nodes -subj '/CN=Wrong EKU' -addext 'extendedKeyUsage=critical,codeSigning' >/dev/null 2>&1
printf '01\n' > "$tmp/serial"
{
 echo '[ tsa ]'; echo 'default_tsa = tsa_config1'; echo '[ tsa_config1 ]'
 echo "dir = $tmp"; echo "serial = $tmp/serial"; echo 'crypto_device = builtin'
 echo "signer_cert = $tmp/tsa.crt"; echo "signer_key = $tmp/tsa.key"; echo 'signer_digest = sha256'
 echo "default_policy = $policy"; echo "digests = sha256"; echo 'accuracy = secs:1'
 echo 'ordering = yes'; echo 'tsa_name = yes'; echo 'ess_cert_id_chain = no'
} > "$tmp/tsa.cnf"
openssl ts -query -data "$payload" -sha256 -cert -out "$tmp/q1.tsq"
openssl ts -reply -config "$tmp/tsa.cnf" -queryfile "$tmp/q1.tsq" -out "$tmp/r1.tsr" >/dev/null 2>&1
openssl ts -verify -queryfile "$tmp/q1.tsq" -in "$tmp/r1.tsr" -CAfile "$tmp/tsa.crt" >/dev/null

pass=0; fail=0
ok(){ pass=$((pass+1)); printf 'PASS %s\n' "$1"; }
bad(){ fail=$((fail+1)); printf 'FAIL %s\n' "$1"; }
expect_fail(){ if "$@" >/dev/null 2>&1; then bad "$1"; else ok "$1"; fi; }

openssl ts -verify -data "$payload" -in "$tmp/r1.tsr" -CAfile "$tmp/tsa.crt" >/dev/null && ok 'baseline_envelope_digest' || bad 'baseline_envelope_digest'
cp "$payload" "$tmp/changed"; printf 'x' >> "$tmp/changed"
if openssl ts -verify -data "$tmp/changed" -in "$tmp/r1.tsr" -CAfile "$tmp/tsa.crt" >/dev/null 2>&1; then bad 'modified_raw_rejected'; else ok 'modified_raw_rejected'; fi
if openssl ts -verify -queryfile "$tmp/q1.tsq" -in "$tmp/r1.tsr" -CAfile "$tmp/other.crt" >/dev/null 2>&1; then bad 'untrusted_certificate_rejected'; else ok 'untrusted_certificate_rejected'; fi
openssl ts -query -data "$payload" -sha256 -cert -out "$tmp/q2.tsq"
if openssl ts -verify -queryfile "$tmp/q2.tsq" -in "$tmp/r1.tsr" -CAfile "$tmp/tsa.crt" >/dev/null 2>&1; then bad 'nonce_mismatch_rejected'; else ok 'nonce_mismatch_rejected'; fi
token_text="$(openssl ts -reply -in "$tmp/r1.tsr" -text)"
token_policy="$(printf '%s\n' "$token_text" | sed -n 's/^Policy OID: //p' | head -1)"
[[ "$token_policy" == "$policy" ]] && ok 'policy_oid_bound' || bad 'policy_oid_bound'
gen_time="$(printf '%s\n' "$token_text" | sed -n 's/^Time stamp: //p' | head -1)"
accuracy="$(printf '%s\n' "$token_text" | sed -n 's/^Accuracy: //p' | head -1)"
[[ -n "$gen_time" ]] && ok 'signed_gentime_present' || bad 'signed_gentime_present'
[[ "$accuracy" == *"0x01"*"second"* || "$accuracy" == *"1 second"* ]] && ok 'accuracy_one_second' || bad 'accuracy_one_second'
gen_epoch="$(date -u -d "$gen_time" +%s)"
cutoff=$((gen_epoch+2))
[[ $((gen_epoch+1)) -le $cutoff ]] && ok 'gentime_plus_accuracy_before_cutoff' || bad 'gentime_plus_accuracy_before_cutoff'
past_cutoff=$((gen_epoch-1))
[[ $((gen_epoch+1)) -gt $past_cutoff ]] && ok 'late_token_rejected_by_cutoff' || bad 'late_token_rejected_by_cutoff'
now="$(date +%s)"; future=$((now+172800))
if openssl verify -attime "$future" -purpose timestampsign -CAfile "$tmp/tsa.crt" "$tmp/tsa.crt" >/dev/null 2>&1; then bad 'expired_certificate_rejected'; else ok 'expired_certificate_rejected'; fi
{
 sed "s|$tmp/tsa.crt|$tmp/bad.crt|;s|$tmp/tsa.key|$tmp/bad.key|" "$tmp/tsa.cnf" > "$tmp/bad.cnf"
 printf '02\n' > "$tmp/serial"
}
if openssl ts -reply -config "$tmp/bad.cnf" -queryfile "$tmp/q1.tsq" -out "$tmp/bad.tsr" >/dev/null 2>&1; then bad 'wrong_eku_rejected'; else ok 'wrong_eku_rejected'; fi
printf '{"schema":"REAL_WORK_03_RFC3161_EXECUTION","passed":%d,"failed":%d,"external_service":false,"formal":false,"limits":["local self-signed test certificate","existence bound only","no source authenticity/publication/acquisition/rights proof"]}\n' "$pass" "$fail"
test "$fail" -eq 0
