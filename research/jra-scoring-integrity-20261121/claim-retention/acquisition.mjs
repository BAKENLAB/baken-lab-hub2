// Install only inside the existing acquisition worker. Resolver is owned by the server.
export function createHistoryWriter({store, readPersistedRuns}) {
  return async function write({rawBytes,decodedText,sourceUrl,sourceRef,fetchedAt,extractorId,raceId,parsedRefs,signal}) {
    signal?.throwIfAborted();
    const rows = await readPersistedRuns({raceId,sourceRef,signal});
    if (!Array.isArray(rows) || !parsedRefs.length || rows.length !== parsedRefs.length)
      throw Error('ARCHIVE_FIELD_MISMATCH');
    // A count match alone is insufficient: [A,A] may otherwise map twice to
    // persisted [A,B], falsely claiming B was archived. Require a bijection.
    const usedRuns = new Set();
    const runners = parsedRefs.map(ref => {
      const matches = rows.filter(r => r.race_id === raceId && r.source_ref === sourceRef &&
        r.horse_name === ref.horse_name && ref.horse_ref && r.horse_ref === ref.horse_ref);
      if (matches.length !== 1) throw Error('AMBIGUOUS_ARCHIVE_IDENTITY');
      const row = matches[0];
      if (!row.run_id || !row.horse_id) throw Error('ARCHIVE_IDENTITY_INCOMPLETE');
      const identity = JSON.stringify([row.race_id, row.run_id, row.horse_id]);
      if (usedRuns.has(identity)) throw Error('DUPLICATE_ARCHIVE_IDENTITY');
      usedRuns.add(identity);
      return row;
    });
    if (usedRuns.size !== rows.length) throw Error('ARCHIVE_FIELD_MISMATCH');
    signal?.throwIfAborted();
    return store.retain({rawBytes,decodedText,sourceUrl,sourceRef,fetchedAt,extractorId,raceId,runners},signal);
  };
}
