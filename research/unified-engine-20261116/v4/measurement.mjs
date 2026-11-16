export const podium=x=>Number.isInteger(x)&&x>=1&&x<=3;
export function checkedResult(horseName,label){if(!label)throw Error('MISSING_LABEL_ROW');if(label.result_horse_name===null)return {finish:null,status:'NO_STORED_RESULT_NAME'};if(label.result_horse_name!==horseName)throw Error('LABEL_IDENTITY');return {finish:label.finish,status:'NAME_MATCHED'};}
