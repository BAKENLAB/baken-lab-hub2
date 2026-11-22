// Install only inside the existing acquisition worker. Resolver is owned by the server.
export function createHistoryWriter({store, readPersistedRuns}) {
  return async function write({rawBytes,decodedText,sourceUrl,sourceRef,fetchedAt,extractorId,raceId,parsedRefs,signal}) {
    signal?.throwIfAborted();
    const rows = await readPersistedRuns({raceId,sourceRef,signal});
    if (!Array.isArray(rows) || !parsedRefs.length || rows.length !== parsedRefs.length)
      throw Error('ARCHIVE_FIELD_MISMATCH');
    const runners = parsedRefs.map(ref => {
      const matches = rows.filter(r => r.race_id === raceId && r.source_ref === sourceRef &&
        r.horse_name === ref.horse_name && ref.horse_ref && r.horse_ref === ref.horse_ref);
      if (matches.length !== 1) throw Error('AMBIGUOUS_ARCHIVE_IDENTITY');
      return matches[0];
    });
    signal?.throwIfAborted();
    return store.retain({rawBytes,decodedText,sourceUrl,sourceRef,fetchedAt,extractorId,raceId,runners},signal);
  };
}
