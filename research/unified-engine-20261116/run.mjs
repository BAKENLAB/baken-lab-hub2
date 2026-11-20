// Offline files only. No network, MCP, DB or save path.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluateRace} from './engine.mjs';import {compareCohort,unavailableReport} from './compare.mjs';
export function runFiles(inputPath,resultPath,outputPath){
 let report;
 if(!inputPath)report=unavailableReport();
 else{const dataset=JSON.parse(readFileSync(inputPath,'utf8'));const evaluations=dataset.races.map(evaluateRace);
  const result= resultPath?JSON.parse(readFileSync(resultPath,'utf8')):{races:[]};
  report={evaluations,comparison:compareCohort(evaluations,result.races,{captureDefinition:dataset.capture_definition,referenceRaceIds:dataset.reference_race_ids})};
 }
 writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
 const output=get('--output');if(!output)throw Error('Use --output path [--inputs locked-inputs.json --results official-results.json]');
 const r=runFiles(get('--inputs'),get('--results'),output);console.log(JSON.stringify({output,status:r.status??r.comparison.status}));
}
