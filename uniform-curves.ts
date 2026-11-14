import {protectCounters} from './counter-guard';
import type {Contour,Cubic} from './curves';

// Compile the source coordinates and tangent directions once. A uniform blend
// does not need to sample a spatial field at every control point.
export function compileUniformCurves(groups:Contour[][],structured:boolean){
 const compiled=groups.map(group=>{
  const count=group[0].length,sources=group.length;
  const coords=new Float64Array(count*8*sources),handles=new Float64Array(count*6*sources);
  for(let i=0;i<count;i++)for(let k=0;k<sources;k++){
   const c=group[k][i];
   for(let j=0;j<4;j++){coords[(i*8+j*2)*sources+k]=c[j][0];coords[(i*8+j*2+1)*sources+k]=c[j][1];}
   for(let side=0;side<2;side++){
    const a=side===0?0:3,h=side===0?1:2,dx=c[h][0]-c[a][0],dy=c[h][1]-c[a][1],length=Math.hypot(dx,dy),index=(i*6+side*3)*sources+k;
    handles[index]=length>1e-9?dx/length:0;handles[index+sources]=length>1e-9?dy/length:0;handles[index+sources*2]=length;
   }
  }
  return {count,sources,coords,handles};
 });
 const contoursFor=(weights:number[],field?:((x:number,y:number)=>number[]))=>{
  const contours:Contour[]=[];
  for(const {count,sources,coords,handles} of compiled){
   const contour:Contour=[];
   for(let i=0;i<count;i++){
    const curve=[] as unknown as Cubic;
    for(let j=0;j<4;j++){
     let x=0,y=0;const index=(i*8+j*2)*sources;
     if(field){let mx=0,my=0;for(let k=0;k<sources;k++){mx+=coords[index+k]/sources;my+=coords[index+sources+k]/sources;}weights=field(mx,my);}
     for(let k=0;k<sources;k++){x+=coords[index+k]*weights[k];y+=coords[index+sources+k]*weights[k];}
     curve[j]=[x,y];
    }
    if(structured)for(let side=0;side<2;side++){
     let dx=0,dy=0,length=0;const index=(i*6+side*3)*sources;
     if(field){const a=(i*8+(side===0?0:6))*sources;let mx=0,my=0;for(let k=0;k<sources;k++){mx+=coords[a+k]/sources;my+=coords[a+sources+k]/sources;}weights=field(mx,my);}
     for(let k=0;k<sources;k++){dx+=handles[index+k]*weights[k];dy+=handles[index+sources+k]*weights[k];length+=handles[index+sources*2+k]*weights[k];}
     const norm=Math.hypot(dx,dy),a=side===0?0:3,h=side===0?1:2;
     if(norm>1e-9)curve[h]=[curve[a][0]+dx/norm*length,curve[a][1]+dy/norm*length];
    }
    contour.push(curve);
   }
   contours.push(contour);
  }
  return structured?protectCounters(contours):contours;
 };
 return {contours:contoursFor};
}
