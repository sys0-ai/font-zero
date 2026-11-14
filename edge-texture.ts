import {noise,deformContours,varyPath} from './variation';
import {pathCurves} from './outline-union';
import type {Point} from './curves';
function grain(t:number,seed:number,axis:number){
 const i=Math.floor(t),u=t-i,a=noise(seed,i,axis),b=noise(seed,i+1,axis);
 return {value:a+(b-a)*u*u*(3-2*u),derivative:(b-a)*6*u*(1-u)};
}
export function edgeField(amount:number,scale:number,seed:number,em=100,origin:Point=[0,0]){
 const cell=em*.026*scale,amplitude=em*.0055*amount/100*scale;
 const angles=[0,Math.PI/2,.61];
 return (point:Point)=>{
  let p:Point=[point[0]-origin[0],point[1]-origin[1]],j=[1,0,0,1];
  for(let k=0;k<angles.length;k++){
   const x=Math.cos(angles[k]),y=Math.sin(angles[k]),nx=-y,ny=x,t=(p[0]*nx+p[1]*ny)/cell;
   let value=0,derivative=0;
   for(const [frequency,weight]of [[1,.65],[2,.25],[4,.1]]){const n=grain(t*frequency,seed,71+k*3+frequency);value+=n.value*weight;derivative+=n.derivative*weight*frequency/cell;}
   const d=amplitude*derivative,a=1+x*nx*d,b=x*ny*d,c=y*nx*d,e=1+y*ny*d;
   j=[a*j[0]+b*j[2],a*j[1]+b*j[3],c*j[0]+e*j[2],c*j[1]+e*j[3]];
   p=[p[0]+x*amplitude*value,p[1]+y*amplitude*value];
  }
  return {point:[p[0]+origin[0],p[1]+origin[1]] as Point,jacobian:j};
 };
}
export function texturePath(path:string,amount:number,scale:number,seed:number,em=100){
 if(amount===0||!path)return path;
 if(!Number.isFinite(amount)||!Number.isFinite(scale)||scale<=0)throw new Error('Invalid edge texture settings');
 const contours=pathCurves(path);if(!contours.length)return path;
 const origin:Point=[Infinity,Infinity];for(const contour of contours)for(const segment of contour)for(const point of segment){origin[0]=Math.min(origin[0],point[0]);origin[1]=Math.min(origin[1],point[1]);}
 return deformContours(contours,edgeField(amount,scale,seed,em,origin),em,em*.026*scale/8);
}
export function finishPath(path:string,s:{temperature:number;edgeRoughness:number;edgeScale:number;seed:number},index:number,em=100){
 return texturePath(varyPath(path,s.temperature,s.seed,index,em),s.edgeRoughness,s.edgeScale,s.seed,em);
}
