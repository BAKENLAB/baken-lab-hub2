// Candidate diagnostic guard. No fetch, DB, claim or write. Keeps valid CNAME unchanged.
export function readOfficialQueueCname({queue,error,target}){
 if(error)throw Error('JRA_OFFICIAL_QUEUE_QUERY_FAILED');
 if(!queue?.cname)throw Error('JRA_OFFICIAL_QUEUE_MISSING');
 if(!target||queue.race_date!==target.race_date||queue.track!==target.track||queue.race_no!==target.race_no)throw Error('JRA_OFFICIAL_QUEUE_TARGET_MISMATCH');
 return String(queue.cname);
}
