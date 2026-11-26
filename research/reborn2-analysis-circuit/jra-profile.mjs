import { analyzeJra0206 } from '../reborn2-evidence-01-12/jra-ability-input-02-06-v2.mjs';
import { extendArchive0206 } from '../reborn2-evidence-01-12/jra-archive-extension-02-06.mjs';
import { profile0206 } from '../reborn2-evidence-01-12/historical-condition-profile-02-06.mjs';

export function buildJraProfile({target,cardRows,archiveRows}) {
  const roster=target.roster.map(r=>r.horse_no);
  const card=analyzeJra0206({targetDate:target.target_date,roster,rows:cardRows});
  const extension=extendArchive0206({target,roster,rows:archiveRows,cardRows});
  return profile0206({target,card,extension});
}
