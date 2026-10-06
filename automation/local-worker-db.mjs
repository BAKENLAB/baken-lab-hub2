// Inject an already authenticated supabase-js client. Only SELECT builders.
// No keys, new service, migration, or client dependency is introduced here.
const horseColumns = 'race_date,track,race_no,race_name,surface,distance,going,horse_no,horse_name,finish,margin,time_raw,early_pos,final_turn_pos,final3f,weight_carried,jockey';
const jraColumns = 'horse_no,horse_name,horse_ref,finish,margin,time_raw,early_pos,final_turn_pos,final3f,weight_carried,jockey,source_ref,source_kind,record_role,race:jra_lab_races!inner(race_date,track,race_no,race_name,surface,distance,going)';
function validate(options) {
  if (options.limit !== 5 || !/^\d{4}-\d{2}-\d{2}$/.test(options.before)) throw new Error('bounded pre-race read required');
}
export function createReadOnlyDb(client) {
  return {
    async readHorseRuns(runner, options, signal) {
      validate(options);
      const {data,error} = await client.from('horse_runs').select(horseColumns)
        .eq('horse_name',runner.horse_name).lt('race_date',options.before)
        .order('race_date',{ascending:false}).order('race_no',{ascending:false}).order('id',{ascending:false})
        .limit(5).abortSignal(signal);
      if (error) throw new Error('HORSE_RUNS_READ_FAILED');
      // Official source witness will be required by the collector; the table
      // alone has no stable horse identifier and does not prove same-name identity.
      return (data ?? []).map(r => ({...r,source:'NAR_OFFICIAL_HISTORY',data_origin:'DB_HORSE_RUNS',
        source_ref:JSON.stringify([r.race_date,r.track,r.race_no,r.horse_no])}));
    },
    async readOfficialHistory(runner, options, signal) {
      validate(options);
      let query = client.from('jra_lab_runs').select(jraColumns)
        .eq('horse_name',runner.horse_name).eq('record_role','full_runner')
        .eq('source_kind','jra_public_reference').lt('race.race_date',options.before);
      const refs = (runner.identity_refs ?? []).filter(r=>typeof r === 'string' && r.includes('/JRADB/'));
      if (refs.length) query = query.in('horse_ref',refs);
      const {data,error} = await query.order('race(race_date)',{ascending:false})
        .order('race(race_no)',{ascending:false})
        .order('id',{ascending:false}).limit(5).abortSignal(signal);
      if (error) throw new Error('OFFICIAL_HISTORY_READ_FAILED');
      return (data ?? []).map(({race,...r}) => ({...r,...race,source:'jra_public_reference',data_origin:'DB_OFFICIAL_HISTORY'}));
    }
  };
}

