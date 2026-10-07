# Production rollback validation — NOT EXECUTED

Only SQL creation, static review and JavaScript tests are authorized in this change.
No Supabase SQL execution, migration, configuration changes or deployment occurred.

`production-rollback-validation.sql` embeds the existing proposal DDL unchanged,
except that its outer transaction ends in rollback. It refuses to run if any
target schema/function name already exists (any overload), or assertions are disabled.
Only new SHADOW tables receive test writes; existing prediction/receipt tables are read.
The legacy isolated DB test writes production-shaped fixtures and remains prohibited
on production. Never concatenate or run that legacy test as part of this validation.

Checks prepared: snapshot capture, identical transport resend, reused snapshot with
distinct attempt, changed input snapshot, genuine-revision conflict, three hash
constraints, capture/receive time constraints, immutable row/truncate triggers,
effective role privileges and PUBLIC ACL, service invoker RPC, denied anon/auth RPC
and schema access, RLS catalog/policies, and exact link-table immutable guards.
The link-table structural fixture is SHADOW-only and does not prove a real FROZEN link.

An existing prediction/receipt cannot recover the original context. New receipt time
also cannot precede historical frozen_at. Successful real FROZEN link is deliberately
reported FROZEN_LINK_REAL_DB_UNVERIFIED; no timestamp backdating or constraint bypass.
Invalid-event rejection can be checked without any production fixture.

## Transaction execution requirements (future approval required)

Terminal rollback is present, but SQL alone cannot guarantee that a client sends or
reaches it after cancellation, connection loss or an earlier statement error.
Use a dedicated connection that continues to terminal rollback after SQL errors;
on cancellation/error, explicitly rollback on that connection or close it immediately.
Disconnect causes server rollback. Never leave the transaction open or reuse it.
Run production-rollback-postcheck.sql separately from a different connection afterward.
All three absence booleans must be true. A failure requires investigation, not cleanup
of existing objects. Never run the proposal's outer transaction on production here.

No durable DDL/row changes are intended. Transactional DDL still takes locks, consumes
resources, can trigger existing DDL event triggers and generate logs; zero runtime
impact is not claimed. Future review must check event triggers and execution timeout.
Creating RPCs inside a rollback transaction is not visible to other connections,
so PostgREST/Data API execution and the Supabase security advisor cannot validate
these temporary objects. service_role may bypass RLS; ACL and policy checks are not
proof of row filtering under a bypass role. Concurrent retry tests and worker runtime
FAIL-OPEN also require separate isolated validation.

Run static tests: node research/local-input-archive/tests/production-validation.test.mjs
