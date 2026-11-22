// Post-race read-only observations: research regression, never a retroactive
// score correction, source authenticity certificate, or new betting model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRecoveredBase30_38,compareRecoveredBase}
  from '../research/jra-scoring-integrity-20261121/claim-retention/recovered-base30-38-readonly.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../research/jra-scoring-integrity-20261121/observations/jra-base30-38-crossdate-readonly-20261123.json',import.meta.url),'utf8'));
test('recovered base 30+38 exact decimal arithmetic uses PostgreSQL numeric half-up rounding',()=>{
  for(const [rate,expected] of [['0',30],['1',68],['0.25',40],['0.75',59],['0.5',49],['0.00',30]]){
    assert.equal(calculateRecoveredBase30_38(rate),expected);
  }
  for(const invalid of [undefined,null,0.2,'-0.1','1.1','0.4xyz','','NaN']){
    assert.throws(()=>calculateRecoveredBase30_38(invalid));
  }
});
test('all 450 actual archived bases match the SQL independent arithmetic comparator',()=>{
  assert.equal(snapshot.classification,'READONLY_POSTRACE_BASE_RATE_COMPARISON_NOT_AUTHENTICATED_PRE_RACE_SNAPSHOT');
  assert.equal(snapshot.rows.length,450);
  for(const row of snapshot.rows){
    const arithmetic=compareRecoveredBase({rateText:row.current_base_rate,submittedBase:row.declared_base});
    assert.equal(arithmetic.calculated_base,row.current_formula_base,JSON.stringify(row));
    assert.equal(arithmetic.difference,row.declared_base-row.current_formula_base);
    assert.equal(arithmetic.asof_input_verified,false);
    assert.equal(arithmetic.official_original_verified,false);
    assert.equal(arithmetic.formal_scoring_allowed,false);
  }
});
test('exact 11/21 and 11/22 morning versus afternoon method discontinuity is preserved',()=>{
  const accum={};
  for(const row of snapshot.rows){
    const group=row.race_date==='2026-11-21'?'nov21':
      row.race_date==='2026-11-22'&&row.race_no<=3?'nov22_morning':
      row.race_date==='2026-11-22'&&row.race_no>=7?'nov22_afternoon':'invalid';
    assert.notEqual(group,'invalid');
    accum[group]??={horses:0,matching:0,races:new Set()};
    const x=accum[group];
    x.horses++;
    x.races.add(row.track+'-'+row.race_no);
    x.matching+=Number(row.declared_base===row.current_formula_base);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(accum).map(([key,x])=>
    [key,{horses:x.horses,matching:x.matching,races:x.races.size}])),{
    nov21:{horses:194,matching:194,races:13},
    nov22_morning:{horses:81,matching:81,races:6},
    nov22_afternoon:{horses:175,matching:15,races:12}
  });
});
test('mismatch never promotes recovered base to official scoring authority',()=>{
  const result=compareRecoveredBase({rateText:'0.25',submittedBase:39});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'NUMERIC_BASE_FORMULA_DRIFT');
  assert.equal(result.formal_scoring_allowed,false);
  assert.equal(compareRecoveredBase({rateText:'0.25',submittedBase:40}).reason,
    'NUMERIC_BASE_FORMULA_MATCH_NOT_ASOF_PROOF');
});
