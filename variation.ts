import {at,split,type Cubic,type Point,type Contour} from './curves';
import {pathCurves} from './outline-union';

export function noise(seed:number,index:number,axis:number){let h=(seed*374761393+index*668265263+axis*1274126177)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295*2-1;}

// One smooth displacement field moves the entire outline, including its holes.
// Top and bottom stay fixed; there is no rotation, translation or scale term.
export function curveField(bounds:{left:number;top:number;width:number;height:number},temperature:number,seed:number,index:number,em=100){
 const [a,b,c,d,e]=[31,32,33,34,35].map((axis,i)=>noise(seed,index,axis)*(i===2?.5:1));
 const w=Math.max(bounds.width,em*.001),h=Math.max(bounds.height,em*.001),pi=Math.PI;
 const derivativeBound=Math.hypot(pi*(Math.abs(b)+2*Math.abs(c))/w,pi*(2*Math.abs(a)+Math.abs(b)+2*Math.abs(c))/h,pi*(2*Math.abs(d)+Math.abs(e))/w,pi*(Math.abs(d)+2*Math.abs(e))/h);
 // A displacement derivative norm below one keeps the continuous map injective.
 const amplitude=temperature*Math.min(em*.065,.65/(derivativeBound||1));
 return (p:Point)=>{
  const u=(p[0]-bounds.left)/w,v=(p[1]-bounds.top)/h;
  const su=Math.sin(pi*u),cu=Math.cos(pi*u),s2u=Math.sin(2*pi*u),c2u=Math.cos(2*pi*u);
  const sv=Math.sin(pi*v),cv=Math.cos(pi*v),s2v=Math.sin(2*pi*v),c2v=Math.cos(2*pi*v);
  const dx=amplitude*(a*s2v+b*cu*sv+c*c2u*s2v),dy=amplitude*(d*s2u*sv+e*su*s2v);
  return {point:[p[0]+dx,p[1]+dy] as Point,jacobian:[
   1+amplitude*pi*(-b*su*sv-2*c*s2u*s2v)/w,
   amplitude*pi*(2*a*c2v+b*cu*cv+2*c*c2u*c2v)/h,
   amplitude*pi*(2*d*c2u*sv+e*cu*s2v)/w,
   1+amplitude*pi*(d*s2u*cv+2*e*su*c2v)/h,
  ]};
 };
}

export function varyPath(path:string,temperature:number,seed:number,index:number,em=100):string {
 if(!temperature||!path)return path;
 const contours=pathCurves(path),points=contours.flatMap(c=>c.flatMap(s=>s));
 if(!points.length)return path;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const [x,y] of points){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const field=curveField({left,top,width:right-left,height:bottom-top},temperature,seed,index,em);
 return deformContours(contours,field,em);
}
export function deformPath(path:string,field:(p:Point)=>{point:Point;jacobian:number[]},em=100,maxSpan=Infinity):string {
 if(!path)return path;
 return deformContours(pathCurves(path),field,em,maxSpan);
}
export function deformContours(contours:Contour[],field:(p:Point)=>{point:Point;jacobian:number[]},em:number,maxSpan=Infinity):string {
 const fit=(c:Cubic,depth=0):Cubic[]=>{
  if(depth<14&&Math.max(Math.max(...c.map(p=>p[0]))-Math.min(...c.map(p=>p[0])),Math.max(...c.map(p=>p[1]))-Math.min(...c.map(p=>p[1])))>maxSpan){const [a,b]=split(c,.5);return [...fit(a,depth+1),...fit(b,depth+1)];}
  const start=field(c[0]),end=field(c[3]);
  const handle=(origin:Point,j:number[],v:Point):Point=>[origin[0]+j[0]*v[0]+j[1]*v[1],origin[1]+j[2]*v[0]+j[3]*v[1]];
  const result:Cubic=[start.point,handle(start.point,start.jacobian,[c[1][0]-c[0][0],c[1][1]-c[0][1]]),handle(end.point,end.jacobian,[c[2][0]-c[3][0],c[2][1]-c[3][1]]),end.point];
  const error=Math.max(...[.25,.5,.75].map(t=>{const actual=field(at(c,t)).point,approx=at(result,t);return Math.hypot(actual[0]-approx[0],actual[1]-approx[1]);}));
  if(error>em*.00015&&depth<8){const [a,b]=split(c,.5);return [...fit(a,depth+1),...fit(b,depth+1)];}
  return [result];
 };
 const point=(p:Point)=>p.map(n=>n.toFixed(5)).join(',');
 return contours.map(contour=>{const cs=contour.flatMap(c=>fit(c));return 'M'+point(cs[0][0])+cs.map(c=>'C'+point(c[1])+' '+point(c[2])+' '+point(c[3])).join('')+'Z';}).join('');
}
