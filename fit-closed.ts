import type {Point,Cubic} from './curves';

// Fit an arc-length sampled closed contour with shared tangents at every join.
// Recursive subdivision bounds sampled error without fitting-library objects.
export function fitClosed(points:Point[],tolerance:number):Cubic[]{
 const count=points.length;if(count<3)return [];
 const point=(i:number)=>points[(i+count)%count];
 const tangent=(i:number):Point=>{const a=point(i-1),b=point(i+1);return [(b[0]-a[0])/2,(b[1]-a[1])/2];};
 const result:Cubic[]=[];
 const fit=(from:number,to:number)=>{
  const a=point(from),b=point(to),ta=tangent(from),tb=tangent(to),span=to-from;
  const c:Cubic=[a,[a[0]+ta[0]*span/3,a[1]+ta[1]*span/3],[b[0]-tb[0]*span/3,b[1]-tb[1]*span/3],b];
  let error=0;
  for(let i=from+1;i<to;i++){
   const t=(i-from)/span,u=1-t,p=point(i);
   const x=u*u*u*a[0]+3*u*u*t*c[1][0]+3*u*t*t*c[2][0]+t*t*t*b[0];
   const y=u*u*u*a[1]+3*u*u*t*c[1][1]+3*u*t*t*c[2][1]+t*t*t*b[1];
   error=Math.max(error,(x-p[0])**2+(y-p[1])**2);
  }
  if(span>1&&error>tolerance*tolerance){const mid=(from+to)>>1;fit(from,mid);fit(mid,to);}else result.push(c);
 };
 for(let i=0;i<count;i+=32)fit(i,Math.min(count,i+32));
 return result;
}
