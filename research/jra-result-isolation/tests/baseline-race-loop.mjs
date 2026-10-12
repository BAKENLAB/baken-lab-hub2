export async function baseline({races,db,now,cnameByKey,date,resolveResultCname,parseResult,fetchHtml,clock=Date}){const Date=clock,report=[];
    for (const race of races??[]) {
      const postMs=race.post_time?new Date(race.post_time).getTime():NaN;
      const after=Number.isFinite(postMs)?Math.round((now-postMs)/60000):null;
      if (race.result_status==="READY") {report.push({track:race.track,race_no:race.race_no,skipped:"already_ready"});continue;}
      if (after===null||after<10) {report.push({track:race.track,race_no:race.race_no,skipped:"too_early"});continue;}

      const cardCname=cnameByKey.get(race.track+"|"+race.race_no);
      if(!cardCname){
        await db.from("official_races").update({
          result_status:"RETRY",result_attempts:Number(race.result_attempts||0)+1,
          result_last_error:"JRA_CARD_CNAME_NOT_FOUND",updated_at:new Date().toISOString()
        }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");
        report.push({track:race.track,race_no:race.race_no,ok:false,error:"no_card_cname"});continue;
      }

      let resultCname=null, parsed;
      try {
        resultCname=await resolveResultCname(String(cardCname));
        if(!resultCname) throw new Error("JRA_RESULT_CNAME_NOT_FOUND");
        parsed=parseResult(await fetchHtml("/JRADB/accessS.html",resultCname));
      } catch(e) { parsed={ready:false,error:String(e?.message||e)}; }

      if(!parsed.ready){
        await db.from("official_races").update({
          result_status:"RETRY",result_attempts:Number(race.result_attempts||0)+1,
          result_last_error:parsed.error||"JRA_RESULT_NOT_READY",updated_at:new Date().toISOString()
        }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");
        report.push({track:race.track,race_no:race.race_no,ok:false,error:parsed.error,result_cname:resultCname});continue;
      }

      const result={finishers:parsed.finishers,non_finishers:parsed.non_finishers||[],payouts:parsed.payouts||{},metadata:parsed.metadata||{}};
      const {error:upErr}=await db.from("official_results").upsert({
        race_date:date,track:race.track,race_no:race.race_no,
        race_name:parsed.race_name||race.race_name,circuit:"JRA",
        result,source:"JRA_OFFICIAL",settled_at:new Date().toISOString()
      },{onConflict:"race_date,track,race_no"});
      if(upErr) throw upErr;

      await db.from("official_races").update({
        result_status:"READY",result_attempts:Number(race.result_attempts||0)+1,
        result_last_error:null,updated_at:new Date().toISOString()
      }).eq("race_date",date).eq("track",race.track).eq("race_no",race.race_no).eq("circuit","JRA");

      report.push({track:race.track,race_no:race.race_no,ok:true,finishers:parsed.finishers.length,payout_types:Object.keys(parsed.payouts||{}).length});
    }

return {report};}

