/* Read-only daily aggregation. No network, storage, or prediction mutation. */
(function (root) {
  'use strict';
  const number = value => typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? Number(value) : NaN;
  const horse = value => Number.isInteger(number(value)) && number(value) > 0 ? number(value) : null;
  const key = row => row && /^\d{4}-\d{2}-\d{2}$/.test(row.race_date || '') && ['JRA', 'LOCAL'].includes(row.circuit) && typeof row.track === 'string' && row.track && horse(row.race_no) ? JSON.stringify([row.race_date, row.circuit, row.track, number(row.race_no)]) : null;
  const excluded = row => /CANCELLED|EXCLUDED|SCRATCHED|WITHDRAWN|取消|除外|中止|取止/i.test(String(row.status ?? row.entry_status ?? row.finish_status ?? ''));
  function inspect(row) {
    const p = row.prediction, payload = p?.payload;
    if (!key(row) || key(p) !== key(row) || p.status !== 'FROZEN' || p.source === 'LEGACY' || p.protocol_version === 'CHAT_PRE_RACE_LEGACY' || row.data_error || p.data_error || row.prediction_state === 'DATA_ERROR') return null;
    if (!row.settled_at || !Number.isFinite(Date.parse(row.settled_at)) || ['PENDING', 'PROVISIONAL', 'UNOFFICIAL', 'CANCELLED'].includes(String(row.result?.status ?? row.result_status ?? '').toUpperCase()) || row.result?.is_final === false) return null;
    if (!payload || !Array.isArray(payload.runners) || !payload.runners.length || !Array.isArray(payload.top5) || !payload.top5.length) return null;
    const runners = payload.runners, ids = runners.map(r => horse(r.horse_no)), top = payload.top5.map(r => horse(r.horse_no));
    if (ids.includes(null) || new Set(ids).size !== ids.length || top.includes(null) || new Set(top).size !== top.length || top.length !== Math.min(5, ids.length) || top.some(n => !ids.includes(n))) return null;
    const list = [row.result?.finishers, row.result?.runners, row.result?.placements, row.result?.results, row.result?.top3].find(Array.isArray);
    if (!list?.length) return null;
    const finishes = [], seen = new Set();
    for (const r of list) {
      const no = horse(r.horse_no ?? r.number ?? r.no), finish = number(r.finish ?? r.position ?? r.actual_finish ?? r.rank);
      if (no === null || seen.has(no)) return null;
      seen.add(no);
      if (excluded(r)) continue;
      if (!Number.isInteger(finish) || finish < 1) return null; // Never infer rank from array order.
      if (finish <= 3) {
        if (!ids.includes(no)) return null;
        const predicted = runners.find(x => horse(x.horse_no) === no);
        if (r.horse_name && predicted.horse_name && r.horse_name !== predicted.horse_name) return null;
        finishes.push({ no, finish });
      }
    }
    finishes.sort((a, b) => a.finish - b.finish);
    if (finishes.length < Math.min(3, ids.length) || finishes[0]?.finish !== 1) return null;
    for (let i = 0; i < finishes.length;) {
      const rank = finishes[i].finish;
      if (rank !== i + 1) return null; // Accept competition ranks, including ties.
      while (i < finishes.length && finishes[i].finish === rank) i++;
    }
    // Current FROZEN predictions identify ◎ by rank: 1; older ones may use mark: '◎'.
    // Never guess if the two formats conflict or if the rank is ambiguous.
    const marked = payload.top5.filter(x => x.mark === '◎');
    const rankedFirst = payload.top5.filter(x => number(x.rank) === 1);
    const hasRanks = payload.top5.some(x => x.rank !== null && x.rank !== undefined);
    const markedNo = marked.length === 1 ? horse(marked[0].horse_no) : null;
    const rankedNo = rankedFirst.length === 1 ? horse(rankedFirst[0].horse_no) : null;
    const favorite = marked.length > 1 ||
      (hasRanks && rankedFirst.length !== 1) ||
      (markedNo !== null && rankedNo !== null && markedNo !== rankedNo)
      ? null : (rankedNo ?? markedNo);
    const eye = payload.eye;
    const eyeValid = eye === null || (eye && typeof eye === 'object' && !Array.isArray(eye) && ids.includes(horse(eye.horse_no)) && !top.includes(horse(eye.horse_no)));
    return { finishes, top, favorite, eye: eye === null ? null : horse(eye?.horse_no), eyeValid: !!eyeValid };
  }
  function aggregate(rows, { date, circuit = 'ALL' } = {}) {
    const metrics = { win: { hits: 0, total: 0, complete: true }, place: { hits: 0, total: 0, complete: true }, top5: { hits: 0, total: 0, complete: true }, eye: { hits: 0, total: 0, complete: true } };
    const selected = (Array.isArray(rows) ? rows : []).filter(r => r?.race_date === date && (circuit === 'ALL' || r.circuit === circuit));
    const frequencies = new Map();
    selected.forEach(r => { const k = key(r); if (k) frequencies.set(k, (frequencies.get(k) || 0) + 1); });
    let matched = 0, skipped = 0;
    for (const row of selected) {
      const data = frequencies.get(key(row)) === 1 ? inspect(row) : null;
      if (!data) { skipped++; continue; }
      matched++;
      metrics.win.total++; metrics.place.total++;
      if (data.favorite === null) metrics.win.complete = metrics.place.complete = false;
      else {
        metrics.win.hits += Number(data.finishes.some(f => f.no === data.favorite && f.finish === 1));
        metrics.place.hits += Number(data.finishes.some(f => f.no === data.favorite));
      }
      metrics.top5.total += data.finishes.length;
      metrics.top5.hits += data.finishes.filter(f => data.top.includes(f.no)).length;
      if (!data.eyeValid) metrics.eye.complete = false;
      else if (data.eye !== null) { metrics.eye.total++; metrics.eye.hits += Number(data.finishes.some(f => f.no === data.eye)); }
    }
    return { matched, skipped, metrics };
  }
  function render(summary, phase = 'ready') {
    const labels = [['win', '◎ 1着'], ['place', '◎ 3着以内'], ['top5', 'TOP5 3着内捕捉'], ['eye', 'LAB 🧪EYE']];
    const cards = labels.map(([name, label]) => {
      const m = summary?.metrics?.[name], valid = phase === 'ready' && m?.complete && m.total > 0;
      const value = valid ? `${m.hits}<span>／${m.total}</span>` : '集計待ち';
      const percentage = valid ? `${(100 * m.hits / m.total).toFixed(1)}%` : (phase === 'loading' ? '読み込み中' : phase === 'error' ? '取得できませんでした' : name === 'eye' && summary?.matched && m?.complete ? '照合済みレースで選出なし' : '照合できるデータを待っています');
      return `<article class="daily-stat ${name === 'eye' ? 'daily-eye' : ''}"><h3>${label}</h3><div class="daily-value ${valid ? '' : 'daily-waiting'}">${value}</div><p>${percentage}</p></article>`;
    });
    return `<h2 class="daily-heading">当日の予想成績</h2><div class="daily-grid">${cards.join('')}</div><p class="daily-note">FROZEN予想と確定結果の照合済み ${summary?.matched || 0}レース。同着は実際の3着以内頭数で集計します。</p>`;
  }
  const api = { aggregate, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResultDailySummary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
