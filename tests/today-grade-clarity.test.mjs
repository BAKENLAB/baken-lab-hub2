import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../today.html',import.meta.url),'utf8');
const start=html.indexOf('function displayGrade(g)');
const end=html.indexOf('function oneDecimal(v)',start);
assert.ok(start>0&&end>start,'expected grade presentation helper region');
const ui=runInNewContext(html.slice(start,end)+'\n({displayGrade,gradeSaturationNotice,gradeBadgeText})');
const sample=(s,n=18)=>Array.from({length:n},(_,i)=>({rank:i+1,grade:i<s?'S':'A',score:100-i}));
test('S saturation is flagged only for JRA when a majority of horses are S',()=>{
 const rows=sample(14);
 assert.deepEqual(JSON.parse(JSON.stringify(ui.gradeSaturationNotice(rows,'JRA'))),{n:18,s:14});
 assert.equal(ui.gradeSaturationNotice(rows,'LOCAL'),null);
 assert.equal(ui.gradeSaturationNotice(sample(9),'JRA'),null);
 assert.equal(ui.gradeSaturationNotice(sample(5),'JRA'),null);
});
test('display retains original scores and underlying grade strings',()=>{
 const rows=sample(14),snapshot=JSON.stringify(rows);
 assert.equal(ui.gradeBadgeText(rows[0],true),'100点');
 assert.equal(ui.gradeBadgeText(rows[17],true),'83点');
 assert.equal(ui.gradeBadgeText(rows[0],false),'S');
 assert.equal(JSON.stringify(rows),snapshot);
});
test('missing or nonnumeric score is never converted to false zero',()=>{
 assert.equal(ui.gradeBadgeText({score:null,grade:'S'},true),'—');
 assert.equal(ui.gradeBadgeText({grade:'S'},true),'—');
 assert.equal(ui.gradeBadgeText({score:101,grade:'S'},true),'—');
});
test('the warning is display-only and render uses saturation guard',()=>{
 assert.ok(html.includes("const payload=p.payload||{},rawRunners="));
 assert.ok(html.includes("saturation=gradeSaturationNotice(runners,p.circuit)"));
 assert.ok(html.includes("gradeBadgeText(r,!!saturation)"));
 assert.ok(html.includes("順位・点数・元グレード・FROZENは変更していません"));
});
