// Server-only PostgreSQL adapter. No secrets, driver, pool or production connection created here.
import { assertJraIdentity } from './jra-recovery.mjs';

const normalize = value => value instanceof Date ? value.toISOString()
  : Array.isArray(value) ? value.map(normalize)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)])) : value;

export function createJraRecoveryAdapter(pool, { officialHistorySourceKinds = [] } = {}) {
  // Source-kind trust must be configured from verified DB provenance, not guessed labels.
  const sourceKinds = [...officialHistorySourceKinds];
  const session = client => ({
    async readBundle(identity, { lock = false } = {}) {
      assertJraIdentity(identity);
      const params = [identity.race_date, identity.track, identity.race_no];
      const { rows } = await client.query(`SELECT race_date,track,race_no,circuit,race_name,post_time,
        field_payload,field_status,field_fetched_at,prediction_status,source
        FROM public.official_races
        WHERE race_date=$1 AND track=$2 AND race_no=$3 AND circuit='JRA' ${lock ? 'FOR UPDATE' : ''}`, params);
      if (rows.length !== 1) throw new Error('JRA_RACE_NOT_FOUND');
      const race = normalize(rows[0]);
      const { rows: existing } = await client.query(`SELECT id FROM public.official_predictions
        WHERE race_date=$1 AND track=$2 AND race_no=$3`, params);
      const { rows: clock } = await client.query('SELECT clock_timestamp() AS now');
      const { rows: runners } = await client.query(`SELECT lr.horse_no,lr.horse_name,lr.horse_ref,lr.draw,
        lr.sex_age,lr.weight_carried,lr.jockey,lr.trainer,lr.body_weight,lr.body_weight_diff,
        lr.equipment,lr.past_runs,lr.source_checked_at
        FROM public.jra_live_runners lr JOIN public.jra_live_races r ON r.id=lr.live_race_id
        WHERE r.race_date=$1 AND r.track=$2 AND r.race_no=$3 AND r.race_type='平地'
        ORDER BY lr.horse_no`, params);
      const safeRunners = [];
      for (const raw of runners) {
        const row = normalize(raw);
        const { rows: history } = await client.query(`SELECT r.race_date,r.track,r.race_no,r.race_name,
          r.race_type,r.surface,r.distance,r.going,r.field_size,r.source_ref,r.source_checked_at,
          x.horse_ref,x.horse_name,x.finish,x.final3f,x.early_pos,x.final_turn_pos,x.pos_change,
          x.weight_carried,x.jockey,x.time_raw,x.margin
          FROM public.jra_lab_runs x JOIN public.jra_lab_races r ON r.id=x.race_id
          WHERE x.horse_ref=$1 AND x.horse_name=$2 AND x.record_role='full_runner'
            AND r.race_date<$3 AND r.race_type='平地' AND r.surface IN ('芝','ダート')
            AND coalesce(r.race_name,'') NOT LIKE '%障害%'
            AND x.source_kind=ANY($4::text[]) AND r.source_kind=ANY($4::text[])
            AND r.source_checked_at <= $5 AND x.created_at <= $5 AND x.updated_at <= $5
            AND r.updated_at <= $5
          ORDER BY r.race_date DESC,r.race_no DESC LIMIT 5`,
        [row.horse_ref, row.horse_name, identity.race_date, sourceKinds, clock[0].now]);
        const live = (row.past_runs ?? []).map(h => ({ ...h,
          horse_ref: h.horse_ref ?? row.horse_ref, horse_name: h.horse_name ?? row.horse_name,
          source: 'LIVE_OFFICIAL', source_checked_at: h.source_checked_at ?? row.source_checked_at }));
        const { past_runs: ignored, ...attributes } = row;
        const { rows: activity } = await client.query(`SELECT r.race_date,r.source_ref,r.source_checked_at,
          x.horse_ref,x.horse_name FROM public.jra_lab_runs x JOIN public.jra_lab_races r ON r.id=x.race_id
          WHERE x.horse_ref=$1 AND x.horse_name=$2 AND x.record_role='full_runner' AND r.race_date<$3
            AND x.source_kind=ANY($4::text[]) AND r.source_kind=ANY($4::text[])
            AND r.source_checked_at <= $5 AND x.created_at <= $5 AND x.updated_at <= $5 AND r.updated_at <= $5
          ORDER BY r.race_date DESC LIMIT 1`,
        [row.horse_ref, row.horse_name, identity.race_date, sourceKinds, clock[0].now]);
        safeRunners.push({ ...attributes, history: [...live, ...normalize(history).map(h => ({ ...h, source: 'DB_OFFICIAL' }))],
          activity_history: normalize(activity).map(h => ({ ...h, source: 'DB_OFFICIAL' })) });
      }
      const { rows: finalClock } = await client.query('SELECT clock_timestamp() AS now');
      return { race, now: normalize(finalClock[0].now), existing: existing.length > 0, runners: safeRunners };
    },
    async insertPrediction(row) {
      assertJraIdentity(row);
      // Final deadline in PostgreSQL, not the application clock. No UPSERT/UPDATE/DELETE.
      const { rows } = await client.query(`INSERT INTO public.official_predictions
        (race_date,track,race_no,circuit,race_name,post_time,protocol_version,model_label,source,status,payload,predicted_at,frozen_at)
        SELECT r.race_date,r.track,r.race_no,'JRA',r.race_name,r.post_time,$4,'GPT-5.6 Sol','CHATGPT','FROZEN',$5::jsonb,
          clock_timestamp(),clock_timestamp()
        FROM public.official_races r
        WHERE r.race_date=$1 AND r.track=$2 AND r.race_no=$3 AND r.circuit='JRA'
          AND r.post_time>clock_timestamp() AND r.prediction_status IN ('PENDING','RETRY')
          AND r.field_payload->'race'->>'race_type'='平地'
          AND NOT EXISTS (SELECT 1 FROM public.official_predictions p
            WHERE p.race_date=r.race_date AND p.track=r.track AND p.race_no=r.race_no)
        RETURNING id`, [row.race_date, row.track, row.race_no, row.protocol_version, JSON.stringify(row.payload)]);
      if (rows.length !== 1) throw new Error('SAVE_FENCE_REJECTED');
      return rows[0];
    },
    async readPrediction(id) {
      const { rows } = await client.query(`SELECT id,race_date,track,race_no,circuit,protocol_version,
        model_label,source,status,payload,predicted_at,frozen_at FROM public.official_predictions
        WHERE id=$1 AND circuit='JRA'`, [id]);
      return normalize(rows[0]);
    },
  });
  return {
    async readBundle(identity) {
      assertJraIdentity(identity);
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout = '15s'");
        const bundle = await session(client).readBundle(identity);
        await client.query('COMMIT');
        return bundle;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await client.query("SET LOCAL statement_timeout = '15s'");
        await client.query("SET LOCAL lock_timeout = '5s'");
        const result = await fn(session(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}
