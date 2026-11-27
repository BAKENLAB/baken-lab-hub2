#!/usr/bin/env bash
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'REBORN2 LOCAL TEST ONLY\n' > "$tmp/payload.bin"
openssl req -x509 -newkey rsa:2048 -keyout "$tmp/tsa.key" -out "$tmp/tsa.crt" -days 1 -nodes -subj '/CN=REBORN2 Local Test TSA' -addext 'extendedKeyUsage=critical,timeStamping' >/dev/null 2>&1
printf '01\n' > "$tmp/serial"
{
  echo '[ tsa ]'
  echo 'default_tsa = tsa_config1'
  echo '[ tsa_config1 ]'
  echo "dir = $tmp"
  echo "serial = $tmp/serial"
  echo 'crypto_device = builtin'
  echo "signer_cert = $tmp/tsa.crt"
  echo "signer_key = $tmp/tsa.key"
  echo 'signer_digest = sha256'
  echo 'default_policy = 1.3.6.1.4.1.55555.1'
  echo 'digests = sha256'
  echo 'accuracy = secs:1'
  echo 'ordering = yes'
  echo 'tsa_name = yes'
  echo 'ess_cert_id_chain = no'
} > "$tmp/tsa.cnf"
openssl ts -query -data "$tmp/payload.bin" -sha256 -cert -out "$tmp/query.tsq"
openssl ts -reply -config "$tmp/tsa.cnf" -queryfile "$tmp/query.tsq" -out "$tmp/reply.tsr" >/dev/null 2>&1
openssl ts -verify -queryfile "$tmp/query.tsq" -in "$tmp/reply.tsr" -CAfile "$tmp/tsa.crt" >/dev/null
openssl ts -reply -in "$tmp/reply.tsr" -text | grep -q 'Status: Granted.'
echo 'RFC3161_LOCAL_SIGNATURE_VERIFY=PASS'
echo 'LIMIT=existence of digest before signed token time only; not official origin, publication time, acquisition time, or truth'
