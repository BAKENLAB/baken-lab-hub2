// Candidate only: extracted from jra-result-refresh v7 race loop; no selection/auth changes.
export async function processResultRaces({races,db,now,cnameByKey,date,resolveResultCname,parseResult,fetchHtml,clock=Date}) {
  const Date=clock;
  const report=[];
    for (const race of races??[]) {
      let stage='RESULT_FETCH', resultSaved=false, ledgerUpdated=false, returnedError=false;
      try {
      const postMs=race.post_time?new Date(race.post_time).getTime():NaN;
      const after=Number.isFinite(postMs)?Math.round((now-postMs)/60000):null;
      if (race.result_status==="READY") {report.push({track:race.track,race_no:race.race_no,skipped:"already_ready"});continue;}
      if (after===null||after<10) {report.push({track:race.track,race_no:race.race_no,skipped:"too_early"});continue;}

      const cardCname=cnameByKey.get(race.track+"|"+race.race_no);
      if(!cardCname){
        stage="LEDGER_UPDATE";
      const {error:ledgerError}=await db.from("official_races").update({
          result_status:"RETRY",result_attempts:Number(race.result_attempts||0)+1,
          result_last_error:"JRA_CARD_CNAME_NOT_FOUND",updated_at:new Date().toISOString()
        }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");
      if(ledgerError){returnedError=true;throw new Error("LEDGER_UPDATE_FAILED");}
      ledgerUpdated=true;
        report.push({track:race.track,race_no:race.race_no,ok:false,result_saved:false,ledger_updated:ledgerUpdated,partial_failure:false,error:"no_card_cname"});continue;
      }

      let resultCname=null, parsed;
      try {
        resultCname=await resolveResultCname(String(cardCname));
        if(!resultCname) throw new Error("JRA_RESULT_CNAME_NOT_FOUND");
        parsed=parseResult(await fetchHtml("/JRADB/accessS.html",resultCname));
      } catch(e) { parsed={ready:false,error:String(e?.message||e)}; }

      if(!parsed.ready){
        stage="LEDGER_UPDATE";
      const {error:ledgerError}=await db.from("official_races").update({
          result_status:"RETRY",result_attempts:Number(race.result_attempts||0)+1,
          result_last_error:parsed.error||"JRA_RESULT_NOT_READY",updated_at:new Date().toISOString()
        }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");
      if(ledgerError){returnedError=true;throw new Error("LEDGER_UPDATE_FAILED");}
      ledgerUpdated=true;
        report.push({track:race.track,race_no:race.race_no,ok:false,result_saved:false,ledger_updated:ledgerUpdated,partial_failure:false,error:parsed.error,result_cname:resultCname});continue;
      }

      const result={finishers:parsed.finishers,non_finishers:parsed.non_finishers||[],payouts:parsed.payouts||{},metadata:parsed.metadata||{}};
      stage="RESULT_SAVE";
      const {error:upErr}=await db.from("official_results").upsert({
        race_date:date,track:race.track,race_no:race.race_no,
        race_name:parsed.race_name||race.race_name,circuit:"JRA",
        result,source:"JRA_OFFICIAL",settled_at:new Date().toISOString()
      },{onConflict:"race_date,track,race_no"});
      if(upErr){returnedError=true;throw new Error("RESULT_SAVE_FAILED");}
      resultSaved=true;

      stage="LEDGER_UPDATE";
      const {error:ledgerError}=await db.from("official_races").update({
        result_status:"READY",result_attempts:Number(race.result_attempts||0)+1,
        result_last_error:null,updated_at:new Date().toISOString()
      }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");
      if(ledgerError){returnedError=true;throw new Error("LEDGER_UPDATE_FAILED");}
      ledgerUpdated=true;

      report.push({track:race.track,race_no:race.race_no,ok:true,result_saved:resultSaved,ledger_updated:ledgerUpdated,partial_failure:false,finishers:parsed.finishers.length,payout_types:Object.keys(parsed.payouts||{}).length});
      } catch(e) {
        report.push({track:race.track,race_no:race.race_no,ok:false,
          result_saved:resultSaved,ledger_updated:ledgerUpdated,partial_failure:resultSaved&&!ledgerUpdated,
          error:stage+"_FAILED",failure_kind:returnedError?"RETURNED_ERROR":"EXCEPTION"});
      }
    }

  return {report,success_count:report.filter(r=>r.ok===true).length,
    failure_count:report.filter(r=>r.ok===false).length,
    partial_failure_count:report.filter(r=>r.partial_failure===true).length,
    skipped_count:report.filter(r=>r.skipped).length};
}

