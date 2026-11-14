import type {Weights} from './weights';
export interface TextStyle {
 weights:Weights;size:number;wght:number;wdth:number;slnt:number;tracking:number;leading:number;smoothing:number;temperature:number;edgeRoughness:number;edgeScale:number;
 color:string;opacity:number;outline:number;outlineColor:string;shadowX:number;shadowY:number;shadowBlur:number;shadowOpacity:number;shadowColor:string;glow:number;glowColor:string;blur:number;
}
export interface TextStop {id:number;at:number;style:TextStyle;ease:'linear'|'smooth'|'hold'}
export const defaultStyle=(weights:Weights):TextStyle=>({weights:[...weights],size:32,wght:450,wdth:100,slnt:0,tracking:0,leading:1.45,smoothing:.6,temperature:0,edgeRoughness:0,edgeScale:1,color:'#232321',opacity:1,outline:0,outlineColor:'#232321',shadowX:0,shadowY:4,shadowBlur:0,shadowOpacity:0,shadowColor:'#252142',glow:0,glowColor:'#aa66ff',blur:0});
export const cloneStyle=(s:TextStyle):TextStyle=>({...s,weights:[...s.weights]});
export function mixColor(a:string,b:string,t:number){const rgb=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));return '#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');}
export function mixStyle(a:TextStyle,b:TextStyle,t:number):TextStyle{
 const out=cloneStyle(a);
 for(const key of Object.keys(a) as (keyof TextStyle)[]){if(key==='weights')out.weights=a.weights.map((v,i)=>v+(b.weights[i]-v)*t);else if(typeof a[key]==='number')(out as any)[key]=(a[key] as number)+((b[key] as number)-(a[key] as number))*t;else (out as any)[key]=mixColor(a[key] as string,b[key] as string,t);}
 return out;
}
export function routeSpan(stops:TextStop[],position:number){
 let i=0;while(i<stops.length-2&&position>=stops[i+1].at)i++;
 const a=stops[i],b=stops[i+1],u=Math.max(0,Math.min(1,(position-a.at)/(b.at-a.at||1))),t=a.ease==='hold'?(u===1?1:0):a.ease==='smooth'?u*u*(3-2*u):u;
 return {a,b,t,index:i};
}
export function routeStyle(stops:TextStop[],position:number){const {a,b,t}=routeSpan(stops,position);return mixStyle(a.style,b.style,t);}
export function insertStop(stops:TextStop[],at:number,id:number):TextStop[]{
 if(stops.some(s=>s.at===at))throw new Error('There is already a stop at that character.');
 return [...stops,{id,at,style:routeStyle(stops,at),ease:'smooth' as const}].sort((a,b)=>a.at-b.at);
}
export function effectAttributes(s:TextStyle){
 const filters:string[]=[];
 if(s.shadowOpacity>0){const c=s.shadowColor,opacity=Math.round(s.shadowOpacity*255).toString(16).padStart(2,'0');filters.push(`drop-shadow(${s.shadowX.toFixed(2)}px ${s.shadowY.toFixed(2)}px ${s.shadowBlur.toFixed(2)}px ${c}${opacity})`);}
 if(s.glow>0)filters.push(`drop-shadow(0px 0px ${s.glow.toFixed(2)}px ${s.glowColor})`);
 if(s.blur>0)filters.push(`blur(${s.blur.toFixed(2)}px)`);
 return `fill="${s.color}" opacity="${s.opacity.toFixed(3)}" stroke="${s.outlineColor}" stroke-width="${s.outline.toFixed(3)}" paint-order="stroke fill" stroke-linejoin="round" style="filter:${filters.join(' ')||'none'}"`;
}
