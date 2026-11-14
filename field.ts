import {protectCounters} from './counter-guard';
import {at,type Contour,type Cubic,type Point} from './curves';
import type {Weights} from './weights';
export type TransitionSampling='letter'|'continuous';
export interface FlowContext {letterOffset:number;letterTotal:number;cellOffset:number;cellTotal:number}
export function flowProgress(position:number,total:number){const t=Math.max(0,Math.min(1,total>0?position/total:0));return t*t*(3-2*t);}
export function flowWeights(start:Weights,end:Weights,position:number,total:number):Weights{const t=flowProgress(position,total);if(t===0)return [...start];if(t===1)return [...end];return start.map((w,i)=>w+(end[i]-w)*t) as Weights;}

// Evaluate the field at points on the actual corresponding source curves.
// A varying field is not a cubic: adaptively fit cubic pieces to that function.
export function blendFieldPath(groups:Contour[][],field:(x:number,y:number)=>number[],tolerance=.01):string {
 const chunks:string[]=[],contours:Contour[]=[],fmt=(p:Point)=>p.map(x=>x.toFixed(5)).join(',');
 for(const group of groups){
  const fitted:Cubic[]=[];
  for(let index=0;index<group[0].length;index++){
   const curves=group.map(c=>c[index]);
   const evaluate=(t:number,derivative=false):{point:Point;tangent:Point}=>{
    const points=curves.map(c=>at(c,t)),mid=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length] as Point,[0,0] as Point),weights=field(...mid);
    const point=points.reduce((p,q,i)=>[p[0]+q[0]*weights[i],p[1]+q[1]*weights[i]] as Point,[0,0] as Point);
    if(!derivative)return {point,tangent:[0,0] as Point};
    const ds=curves.map(c=>[3*((1-t)**2*(c[1][0]-c[0][0])+2*(1-t)*t*(c[2][0]-c[1][0])+t*t*(c[3][0]-c[2][0])),3*((1-t)**2*(c[1][1]-c[0][1])+2*(1-t)*t*(c[2][1]-c[1][1])+t*t*(c[3][1]-c[2][1]))] as Point);
    const dm=ds.reduce((p,q)=>[p[0]+q[0]/ds.length,p[1]+q[1]/ds.length] as Point,[0,0] as Point),h=.001;
    const xp=field(mid[0]+h,mid[1]),xm=field(mid[0]-h,mid[1]),yp=field(mid[0],mid[1]+h),ym=field(mid[0],mid[1]-h);
    const tangent=ds.reduce((p,d,i)=>{const dw=((xp[i]-xm[i])*dm[0]+(yp[i]-ym[i])*dm[1])/(2*h);return [p[0]+weights[i]*d[0]+dw*points[i][0],p[1]+weights[i]*d[1]+dw*points[i][1]] as Point;},[0,0] as Point);
    return {point,tangent};
   };
   const fit=(from:number,to:number,depth=0):void=>{
    const a=evaluate(from,true),b=evaluate(to,true),dt=(to-from)/3;
    const c:Cubic=[a.point,[a.point[0]+a.tangent[0]*dt,a.point[1]+a.tangent[1]*dt],[b.point[0]-b.tangent[0]*dt,b.point[1]-b.tangent[1]*dt],b.point];
    const error=Math.max(...[.25,.5,.75].map(t=>{const exact=evaluate(from+(to-from)*t).point,approx=at(c,t);return Math.hypot(exact[0]-approx[0],exact[1]-approx[1]);}));
    if(error>tolerance&&depth<8){const mid=(from+to)/2;fit(from,mid,depth+1);fit(mid,to,depth+1);}else fitted.push(c);
   };
   fit(0,1);
  }
  if(fitted.length)contours.push(fitted);
 }
 for(const contour of protectCounters(contours)){chunks.push('M'+fmt(contour[0][0]));for(const c of contour)chunks.push('C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3]));chunks.push('Z');}
 return chunks.join('');
}
