export type Motion='placed'|'cursor'|'bounce'|'ambient';
export interface Attractor {id:string;font:string;mode:Motion;x:number;y:number;radius:number;decay:number;vx:number;vy:number}
export interface Pole {source:number;x:number;y:number;radius:number;decay:number;ambient?:boolean}
export function attractionWeights(poles:Pole[],count:number,x:number,y:number){
 const weights=Array(count).fill(0);let total=0;
 const exact=poles.filter(p=>!p.ambient&&Math.hypot(x-p.x,y-p.y)<.001);
 if(exact.length){for(const p of exact)weights[p.source]+=1/exact.length;return weights;}
 for(const p of poles){const value=p.ambient?1:Math.exp(Math.max(-50,Math.min(50,p.decay*Math.log(p.radius/Math.max(.001,Math.hypot(x-p.x,y-p.y))))));weights[p.source]+=value;total+=value;}
 if(!total)return weights.map((_,i)=>i===0?1:0);
 return weights.map(w=>w/total);
}
export function bounceAxis(position:number,velocity:number,seconds:number,min:number,max:number){
 const length=max-min;if(length<=0)return {position:min,velocity};
 const raw=position+velocity*seconds-min,phase=((raw%(2*length))+2*length)%(2*length);
 return {position:min+(phase<=length?phase:2*length-phase),velocity:velocity*(phase<=length?1:-1)};
}
