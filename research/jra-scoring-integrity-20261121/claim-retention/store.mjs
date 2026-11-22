// Isolated storage adapter. The caller owns the private directory and database lifetime.
import { DatabaseSync } from 'node:sqlite';
import { sha } from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import { buildHistoryDocument } from '../final-provider/capture-history-document.mjs';

export function openResearchStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT');
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
      return put({ ...document, raw_bytes: Buffer.from(document.raw_bytes).toString('base64') });
    },
    read,
    putDecision: decision => put({ type: 'SUBMITTED_JUDGMENT', decision })
  };
}
