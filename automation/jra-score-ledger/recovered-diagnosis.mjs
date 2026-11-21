// Exact rational port of recovered private.jra_segmented_diagnosis_score.
// NOT proven to generate current FROZEN. No conversion from base_rate, no new coefficients.
const rows={NEW:[65,0,0,10,25],MAIDEN:[38,17,15,12,18],CLASS1:[32,18,25,15,10],CLASS2_3:[36,22,20,12,10],OPEN_GRADED:[40,25,15,10,10],STANDARD:[45,20,15,10,10]};
export const AXES=Object.freeze(['today_ability','win_power','top3_stability','pace_fit','change_score']);
export const WEIGHTS=Object.freeze(Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,Object.freeze(v)])));
const gcd=(a,b)=>b?gcd(b,a%b):a<0n?-a:a;
const reduce=(n,d)=>{const g=gcd(n,d);return[n/g,d/g];};
function decimal(x){if(x===null)return null;if(typeof x!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(x))throw Error('EXACT_DECIMAL_REQUIRED');const [a,b='']=x.replace(/^\+/,'').split('.');return reduce(BigInt(a+b),10n**BigInt(b.length));}
export function recoveredDiagnosis({segment,axes,class_delta=null,days_since_last=null}){
 if(!axes||AXES.some(k=>!(k in axes)))throw Error('EXPLICIT_NULL_OR_VALUE_REQUIRED');
 const selected=Object.hasOwn(WEIGHTS,segment)?segment:'STANDARD',weights=WEIGHTS[selected];
 let n=0n,d=1n,den=0n;const ledger=[];
 AXES.forEach((k,i)=>{const v=decimal(axes[k]),w=BigInt(weights[i]);if(v){[n,d]=reduce(n*v[1]+v[0]*w*d,d*v[1]);den+=w;}
 ledger.push({factor:k,input:axes[k],weight_percent:weights[i],included:axes[k]!==null});});
 if(class_delta!==null&&!Number.isSafeInteger(class_delta)||days_since_last!==null&&!Number.isSafeInteger(days_since_last))throw Error('INTEGER_CONDITION_REQUIRED');
 const penalty=(class_delta??0)>0&&(days_since_last??0)>120?7:0;
 const value=den?reduce(n-BigInt(penalty)*d*den,d*den):null;
 return {schema:'RECOVERED_JRA_SEGMENT_DIAGNOSIS_V1',classification:'RECOVERED_DIAGNOSTIC_NOT_CURRENT_OFFICIAL_ENGINE',segment:selected,
  weights_denominator:Number(den),ledger,penalty,exact:value?{numerator:String(value[0]),denominator:String(value[1])}:null,
  diagnostic_value:value?Number(value[0])/Number(value[1]):null,
  rounding:'NONE_IN_RECOVERED_SQL',clamp:'NONE_IN_RECOVERED_SQL',formal_score:null,production_allowed:false};
}
