import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const names=['stage17-allrunner-replay-candidate-index-v1.5.json','stage17-jra-history-locator-audit-v1.4.json','stage17-local-history-locator-audit-v1.4.json','stage17-jra-relation-locator-audit-v1.4.json','stage17-card-peer-locator-audit-v1.5.json'];
const shas=['73afbb0b2f99f655228e3c0e639c7722d4f70ab8','4fb9129da9283ebb2b689828d2b27b0d2159ec8f','067c816cf65987aead56ffa0320221243aa75a23','fdba923dfa16f4efff15f74245e095f7e999f5d2','21d09e5ccec15973bb786a94cc0c1810c335eab9'];
export function readWork17(){return names.map((n,i)=>{const b=readFileSync(new URL('./work17-pinned/'+n,import.meta.url));const sha=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');if(sha!==shas[i])throw Error('WORK17_BLOB');return JSON.parse(b);});}
const require=(b,m)=>{if(!b)throw Error(m);};
export function inspectWork17([idx,j,l,r,c]){
 require(idx.permission==='NOT_CLEARED'&&!idx.formal_replay_eligible&&idx.formal_admissions===0&&!idx.source_values_external_transfer,'SCOPE');
 const js=j.runners.flatMap(h=>h.histories.map(x=>({...x,no:h.current_no}))),ls=l.runners.flatMap(h=>h.histories.map(x=>({...x,no:h.current_no})));
 const strict=js.filter(x=>x.full_numeric&&x.update_before_cutoff&&x.lap_shape&&x.lap_sum_matches_winner&&x.corners_valid&&!x.checkpoint_conflict&&x.duplicate_n===1);
 const map=new Map(js.map(x=>[x.row_id,x])),sm=new Set(strict.map(x=>x.row_id));
 require(map.size===147&&strict.length===119&&j.runners.length===18&&l.runners.length===12&&ls.length===29&&new Set(ls.map(x=>x.witness_ordinal)).size===29,'COUNTS');
 require(idx.JRA.runners.every(h=>j.runners.some(y=>y.current_no===h.current_no&&y.horse_id_candidate===h.horse_id_candidate)&&h.history_refs.every(id=>map.get(id)?.no===h.current_no)&&h.strict_history_refs.length>0&&h.strict_history_refs.every(id=>sm.has(id)&&map.get(id)?.no===h.current_no)),'JRA_LINK');
 require(idx.LOCAL.runners.every(h=>h.current_card===null&&!h.formal_usable&&l.runners.some(y=>y.current_no===h.current_no&&y.horse_id_candidate===h.horse_id_candidate)&&h.history_witness_refs.every(id=>ls.some(x=>x.witness_ordinal===id&&x.no===h.current_no))),'LOCAL_LINK');
 require(Date.parse(l.as_of)<Date.parse(l.post)&&Date.parse(l.current_card_capture)>Date.parse(l.post)&&l.current_card_admitted===false,'LOCAL_TIME');
 require(js.every(x=>x.formal_usable===false&&x.publication_at===null)&&ls.every(x=>x.formal_usable===false&&x.publication_at===null),'HELD');
 const bind=(id,no,race)=>map.get(id)?.no===no&&map.get(id)?.race_id===race;
 require(r.direct_rows.length===13&&r.direct_rows.every(x=>bind(x.a_row,x.a_no,x.race_id)&&bind(x.b_row,x.b_no,x.race_id)),'DIRECT');
 require(r.common_sample.length===89&&r.common_sample.every(x=>x.a_race!==x.b_race&&bind(x.a_row,x.a_no,x.a_race)&&bind(x.b_row,x.b_no,x.b_race)&&x.a_peer_row&&x.b_peer_row),'INDIRECT');
 require(r.later_sample.length===22&&r.later_sample.every(x=>bind(x.a_row,x.a_no,x.reference_race)&&bind(x.b_row,x.b_no,x.reference_race)&&bind(x.candidate_row,x.peer_no,x.candidate_event)&&x.candidate_date>map.get(x.a_row).event[0]),'LATER');
 const cards=c.JRA.runners.flatMap(h=>h.histories),matched=cards.filter(x=>x.archive_identity_match&&x.finish_clock_match),classes=matched.filter(x=>x.class_label_match);
 require(cards.length===69&&matched.length===43&&classes.length===30,'CARD');
 require(idx.JRA.runners.every(h=>!h.formal_usable)&&idx.LOCAL.runners.every(h=>!h.formal_usable),'FORMAL');
 return {JRA:{runners:18,histories:js.length,strict:strict.length,card:cards.length,matched:matched.length,class_matched:classes.length,unmatched:cards.length-matched.length,direct:r.direct_rows.length,indirect:r.common_sample.length,later:r.later_sample.length,horse3_card_matches:c.JRA.runners.find(x=>x.no===3).histories.filter(x=>x.archive_identity_match&&x.finish_clock_match).length,horse3_strict:idx.JRA.runners.find(x=>x.current_no===3).strict_history_refs.length},LOCAL:{runners:12,histories:ls.length,card:'EXCLUDED_POSTSTART',direct:idx.LOCAL.direct_pairs.length,peer:c.LOCAL.relations.length},eligible_records:[],held_records:[...js.map(x=>x.row_id),...ls.map(x=>x.witness_ordinal)],official_replay_eligible:0,formal:false};
}
// No locator is itself evidence. An independently authenticated scoped
// record must first pass existing official common admission in a future
// authorized adapter. This function never grants rights or invokes DB.
export function routeWork17(packet){const diagnostic=inspectWork17(packet);return {diagnostic,common_input:null,held_reason:['PERMISSION_NOT_CLEARED','NATIVE_ID_AND_PUBLICATION_NOT_PROVEN','NO_PERFORMANCE_PAYLOAD'],formal:false};}
