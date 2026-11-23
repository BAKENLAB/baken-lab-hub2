// Isolated storage adapter. The caller owns the private directory and database lifetime.
import { DatabaseSync } from 'node:sqlite';
import { sha } from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import { buildHistoryDocument } from '../final-provider/capture-history-document.mjs';

export function openResearchStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT');
  db.exec('CREATE TABLE IF NOT EXISTS history_documents (run_id TEXT, document_id TEXT, PRIMARY KEY(run_id, document_id)) STRICT');
  const link = db.prepare('INSERT OR IGNORE INTO history_documents VALUES (?, ?)');
  const lookup = db.prepare('SELECT document_id FROM history_documents WHERE run_id = ?');
  const insert = db.prepare('INSERT INTO records VALUES (?, ?) ON CONFLICT(id) DO NOTHING');
  const select = db.prepare('SELECT body FROM records WHERE id = ?');
  function read(id) {
    const row = select.get(id);
    if (!row || sha(row.body) !== id) throw Error('STORED_RECORD_MISSING_OR_CHANGED');
    return JSON.parse(row.body);
  }
  function put(record) {
    const body = JSON.stringify(record);
    const id = sha(body);
    insert.run(id, body);
    read(id);
    return id;
  }
  return {
    close: () => db.close(),
    async retain(input, signal) {
      const document = await buildHistoryDocument(input);
      signal?.throwIfAborted();
      db.exec('BEGIN IMMEDIATE');
      try {
        const id = put({ ...document, raw_bytes: Buffer.from(document.raw_bytes).toString('base64') });
        for (const runner of document.runners) link.run(runner.run_id, id);
        db.exec('COMMIT');
        return id;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    selectedDocument(row, observedAt) {
      if (row.source_kind !== 'DB' || !row.selected_run_id || !Number.isFinite(Date.parse(observedAt)))
        throw Error('NO_SELECTED_ARCHIVE_ID');
      const matches = lookup.all(row.selected_run_id).filter(({ document_id }) => {
        const d = read(document_id);
        return d.source_ref === row.selected_source_ref && d.race_id === row.selected_race_id &&
          Date.parse(d.fetched_at) <= Date.parse(observedAt) && d.runners.some(r =>
            r.run_id === row.selected_run_id && r.horse_id === row.selected_horse_id);
      });
      if (matches.length !== 1) throw Error('MISSING_OR_AMBIGUOUS_DOCUMENT');
      return { documentId: matches[0].document_id, sourceRef:row.selected_source_ref,
        raceId:row.selected_race_id, runId:row.selected_run_id, horseId:row.selected_horse_id };
    },
    read,
    putDecision: decision => put({ type: 'SUBMITTED_JUDGMENT', decision })
  };
}
