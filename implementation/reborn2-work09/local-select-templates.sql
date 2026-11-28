-- LOCAL OPERATOR ONLY. Do not run via external connector, or before independent
-- source-scope, custody, retention and local processing approval.
-- These are parameterized SELECT templates, not a migration or RPC.
-- Execute within a read-only transaction in the authorized isolated environment.
-- Bind exact independently verified IDs and cutoff. No discovery or bulk scan.
-- Output is a DERIVED stored-row projection, NOT the official original.
-- Official original/version/row witness and signed Work08 descriptor still required.

-- A: JRA current race, $1=verified jra_live_races.id (uuid),
-- $2=approved cutoff timestamptz, $3=conservative post/start boundary timestamptz.
-- No market, past_runs, legacy grades or target outcome.
SELECT jsonb_build_object('race',jsonb_build_object(
 'cname',r.cname,'race_date',r.race_date,'track',r.track,'race_no',r.race_no,
 'surface',r.surface,'turn',r.turn,'distance',r.distance,'going',r.going,
 'class_name',r.class_name,'field_size',r.field_size,'post_time',r.post_time),
 'runners',a.rows) AS source_projection
FROM public.jra_live_races r
CROSS JOIN LATERAL (
 SELECT count(*) n,count(DISTINCT h.horse_no) distinct_no,
 count(*) FILTER(WHERE h.source_checked_at <= $2::timestamptz AND h.updated_at <= $2::timestamptz
 AND h.horse_ref ~ '^/JRADB/accessU[.]html[?]CNAME=pw01dud(00|10)[0-9]{10}/[0-9A-Fa-f]{2}$') eligible,
 jsonb_agg(jsonb_build_object('horse_no',h.horse_no,'horse_ref',h.horse_ref,'horse_name',h.horse_name,
 'draw',h.draw,'weight_carried',h.weight_carried,'body_weight',h.body_weight,
 'body_weight_diff',h.body_weight_diff,'sex_age',h.sex_age,'equipment',h.equipment) ORDER BY h.horse_no) rows
 FROM public.jra_live_runners h WHERE h.live_race_id=r.id
) a
WHERE r.id=$1::uuid AND $2::timestamptz<$3::timestamptz AND now()<$3::timestamptz
 AND r.source_checked_at<=$2::timestamptz AND r.updated_at<=$2::timestamptz
 AND r.race_date=($3::timestamptz AT TIME ZONE 'Asia/Tokyo')::date
 AND a.n>0 AND a.n=a.eligible AND a.n=a.distinct_no AND a.n=r.field_size;

-- B: JRA one exact historical race, $1=verified jra_lab_races.id,
-- $2=target date JST, $3=cutoff. Keep full historical roster, not just target horse.
-- All rows required to meet timing and strict native horse key shape; otherwise
-- no full-race export from this template. Do not silently drop incomplete rivals.
SELECT jsonb_build_object('race',jsonb_build_object(
 'source_ref',r.source_ref,'race_date',r.race_date,'track',r.track,'race_no',r.race_no,
 'surface',r.surface,'turn',r.turn,'distance',r.distance,'going',r.going,
 'class_name',r.class_name,'field_size',r.field_size,'halon_times',r.halon_times),
 'runners',a.rows) AS source_projection
FROM public.jra_lab_races r
CROSS JOIN LATERAL (
 SELECT count(*) n,count(DISTINCT h.horse_no) distinct_no,
 count(*) FILTER(WHERE h.updated_at<=$3::timestamptz AND h.created_at<=$3::timestamptz
 AND h.horse_ref ~ '^/JRADB/accessU[.]html[?]CNAME=pw01dud(00|10)[0-9]{10}/[0-9A-Fa-f]{2}$') eligible,
 jsonb_agg(jsonb_build_object('horse_no',h.horse_no,'horse_ref',h.horse_ref,'horse_name',h.horse_name,
 'draw',h.draw,'weight_carried',h.weight_carried,'body_weight',h.body_weight,
 'body_weight_diff',h.body_weight_diff,'sex_age',h.sex_age,'equipment',h.equipment,
 'finish',h.finish,'time_raw',h.time_raw,'margin',h.margin,'final3f',h.final3f,'corner_positions',h.corner_positions)
 ORDER BY h.horse_no) rows
 FROM public.jra_lab_runs h WHERE h.race_id=r.id AND h.record_role='full_runner'
) a
WHERE r.id=$1::uuid AND r.race_date<$2::date
 AND r.source_checked_at<=$3::timestamptz AND r.created_at<=$3::timestamptz AND r.updated_at<=$3::timestamptz
 AND a.n>0 AND a.n=a.eligible AND a.n=a.distinct_no AND a.n=r.field_size;
-- An incomplete event can still supply individual approved history through a
-- reviewed individual-row source adapter; this full-row template does not assert
-- official starter classification or fabricate absent rows. No date/name joins.

-- C: LOCAL one authorized snapshot ID ($1), cutoff ($2), target date ($3).
-- Original stored derived packet required for its payload hash; never alter
-- packet to pretend it is an original official document. Do not export until
-- the operator verifies the whole packet is in the approved disclosure scope.
SELECT jsonb_build_object('id',s.id,'circuit',s.circuit,'race_date',s.race_date,
 'track',s.track,'race_no',s.race_no,'official_post_time',s.official_post_time,
 'captured_at',s.captured_at,'as_of',s.as_of,'source_kind',s.source_kind,
 'source_version',s.source_version,'official_roster_digest',s.official_roster_digest,
 'payload_digest',s.payload_digest,'evidence',s.evidence) AS source_projection
FROM private.lab_preclaim_evidence_snapshots_v1 s
WHERE s.id::text=$1::text AND s.circuit='LOCAL' AND s.source_kind='LOCAL_OFFICIAL_CORNERS'
 AND s.source_version='LOCAL_CORNER_1' AND s.source_status='PARTIAL'
 AND s.race_date<=$3::date AND s.as_of<=s.captured_at AND s.captured_at<s.official_post_time
 AND s.captured_at<=$2::timestamptz;
-- No query for horse_runs enrichment: no native horse ID; official row witness
-- and an approved per-row projection adapter must precede use. No name join.
-- No LOCAL target card export: today's official_races roster has no native IDs;
-- approved original DebaTable/HorseMarkInfo extraction is needed.
