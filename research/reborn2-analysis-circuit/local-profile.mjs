import { parseExtendedNarProfile } from '../reborn2-evidence-01-12/nar-extended-profile-candidate.mjs';

export function collectLocalProfileHistory({targetDate,asOf,roster,profiles}) {
  const numbers=roster.map(h=>h.horse_no);
  if(new Set(numbers).size!==numbers.length || new Set(profiles.map(p=>p.horseNo)).size!==profiles.length ||
      profiles.some(p=>!numbers.includes(p.horseNo))) throw Error('PROFILE_ROSTER_MISMATCH');
  return roster.map(current=>{
    const source=profiles.find(p=>p.horseNo===current.horse_no);
    if(!source) return {horse_no:current.horse_no,runs:[],status:'PROFILE_UNAVAILABLE'};
    return {horse_no:current.horse_no,...parseExtendedNarProfile({profile:source.profile,current,targetDate,asOf})};
  });
}
