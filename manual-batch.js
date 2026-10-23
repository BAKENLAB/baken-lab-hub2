// BAKEN LAB | Manual all-race ChatGPT handoff (free API path).
// Pure eligibility snapshot; final claim/save MUST be independently revalidated
// by each official MCP. This file never calls a paid model or writes FROZEN.
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const statusAllowed = new Set(['PENDING', 'RETRY']);
  const circuitAllowed = new Set(['LOCAL', 'JRA']);
  function jstDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const get = type => parts.find(p => p.type === type)?.value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function selectEligible({ date, races, now = new Date() }) {
    if (!Array.isArray(races) || !(now instanceof Date) || !Number.isFinite(now.getTime()))
      throw new Error('BATCH_INVALID_INPUT');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== jstDate(now))
      throw new Error('BATCH_TODAY_ONLY');
    const skipped = {notReady:0, savedOrClosed:0, cutoff:0, invalid:0, duplicate:0};
    const sorted = [], seen = new Set();
    for (const r of races) {
      if (!r || !circuitAllowed.has(r.circuit) || r.race_date !== date ||
          !Number.isInteger(Number(r.race_no)) || Number(r.race_no)<1 ||
          Number(r.race_no)>12 || typeof r.track !== 'string' || !r.track.trim()) {
        skipped.invalid++;continue;
      }
      const key = [date, r.circuit, r.track.trim(), Number(r.race_no)].join('|');
      if (seen.has(key)) {skipped.duplicate++;continue}
      seen.add(key);
      if (r.prediction || !statusAllowed.has(r.prediction_status) || r.data_error) {
        skipped.savedOrClosed++;continue;
      }
      if (r.circuit === 'LOCAL' ? r.field_status !== 'READY' : !['BASIC_READY', 'READY'].includes(r.field_status)) {skipped.notReady++;continue}
      const t = Date.parse(r.post_time ?? '');
      if (!Number.isFinite(t)) {skipped.invalid++;continue}
      const minutes = (t - now.getTime())/60000;
      // Candidate ranges mirror current guarded claim RPCs, not a promise of a save.
      // LOCAL ordinary worker: 20..150m; RESCUE: 10..70m -> union 10..150m.
      // JRA manual claim: strictly >3m and <=70m before post.
      // The official MCP rechecks all conditions at execution time.
      if (r.circuit === 'LOCAL' ? (minutes < 10 || minutes > 150) : (minutes <= 3 || minutes > 70)) {
        skipped.cutoff++;continue;
      }
      sorted.push({
        race_date: date, circuit: r.circuit, track: r.track.trim(),
        race_no: Number(r.race_no), race_name:String(r.race_name||'').slice(0,80),
        post_time:r.post_time, minutes_to_post:Math.floor(minutes)
      });
    }
    sorted.sort((a,b)=> Date.parse(a.post_time)-Date.parse(b.post_time) ||
      a.track.localeCompare(b.track,'ja') || a.race_no-b.race_no);
    return {
      date,checked_at:now.toISOString(),eligible:sorted,
      count:sorted.length,skipped,total:races.length,
      byCircuit:{LOCAL:sorted.filter(x=>x.circuit==='LOCAL').length,
                 JRA:sorted.filter(x=>x.circuit==='JRA').length}
    };
  }
  function makePrompt(batch) {
    if(!batch || !Array.isArray(batch.eligible))throw new Error('BATCH_INVALID');
    const details=batch.eligible.map(r=>r.circuit+' '+r.track+r.race_no+'R ('+
      new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'})
        .format(new Date(r.post_time))+')');
    return [
      '【BAKEN LAB｜HUB無料・手動一括保存依頼】',
      'HUBの一括ボタンを押した時点（'+batch.checked_at+'）で、'+batch.date+
        ' の保存候補は '+batch.count+'R（LOCAL '+batch.byCircuit.LOCAL+
        'R、JRA '+batch.byCircuit.JRA+'R）。画面で選択中の競馬場に関係なく全場を対象にした。',
      '候補一覧：'+details.join('、'),
      'この一覧は候補であり、保存許可の確定結果ではない。実行直前に公式時刻、出馬表READY、未保存、既存FROZENなし、正規CLAIM可能性を必ずMCPと本番DBで再確認し、発走後・期限内不可・情報不足・CLAIM不可は除外。',
      'LOCALとJRAはそれぞれ独立の正規MCP、現行の検証済みプロトコルを使う。LOCALは全頭の独立評価、TOP5外EYEの肯定因子監査、保存時bets=[]・bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY。JRAはJRA専用の現行手順に従う。',
      '発走後の保存、既存FROZENの更新、後付け順位修正、Cron再開、有料OpenAI API・課金経路、外部予想丸写しは禁止。',
      '全候補を発走順に確認し、この会話の中で実際に処理できる分だけCLAIM→全頭評価→正規FROZEN保存→DBでDONE/FROZEN確認を進める。完了を偽らず、保存件数と未処理理由を報告。チャット外での無人継続は約束しない。'
    ].join('\n');
  }
  root.BAKENManualBatch = Object.freeze({jstDate,selectEligible,makePrompt});
})(globalThis);
