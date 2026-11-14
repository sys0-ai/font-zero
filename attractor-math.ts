export type Motion='placed'|'cursor'|'bounce'|'ambient';
export interface Attractor {id:string;font:string;mode:Motion;x:number;y:number;radius:number;decay:number;vx:number;vy:number}
export interface Pole {source:number;x:number;y:number;radius:number;decay:number;ambient?:boolean}
export function backgroundWeights(poles:Pole[],count:number){
 const weights=Array(count).fill(0),ambient=poles.filter(p=>p.ambient);
 if(ambient.length)for(const p of ambient)weights[p.source]+=1/ambient.length;
 else if(count)weights[0]=1;
 return weights;
}
export function attractionWeights(poles:Pole[],count:number,x:number,y:number){
 const weights=backgroundWeights(poles,count);let total=1;
 const exact=poles.filter(p=>!p.ambient&&Math.hypot(x-p.x,y-p.y)<.001);
 if(exact.length){weights.fill(0);for(const p of exact)weights[p.source]+=1/exact.length;return weights;}
 for(const p of poles){
  if(p.ambient)continue;
  const t=Math.hypot(x-p.x,y-p.y)/p.radius;if(t>=1)continue;
  const influence=Math.pow((1-t)*(1-t)*(1+2*t),p.decay),value=influence/Math.max(1e-12,1-influence);
  weights[p.source]+=value;total+=value;
 }
 return weights.map(w=>w/total);
}
export function bounceAxis(position:number,velocity:number,seconds:number,min:number,max:number){
 const length=max-min;if(length<=0)return {position:min,velocity};
 const raw=position+velocity*seconds-min,phase=((raw%(2*length))+2*length)%(2*length);
 return {position:min+(phase<=length?phase:2*length-phase),velocity:velocity*(phase<=length?1:-1)};
}
