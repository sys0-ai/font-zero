import paper from 'paper';
import {fitClosed} from './fit-closed';
import type {Contour, Cubic, Point} from './curves';
const scope=new paper.PaperScope();
scope.setup(new scope.Size(1,1));
scope.settings.insertItems=false;

export function unifiedContours(pathData:string):Contour[]{
 if(!pathData)return [];
 const source=new scope.CompoundPath({pathData,insert:false,fillRule:'nonzero'});
 const united=source.unite(source,{insert:false});
 const paths=united instanceof scope.CompoundPath?united.children:[united];
 // Boolean union can leave microscopic closed slivers at coincident edges.
 // They are numerical debris, not extra letter bodies or counters.
 const areaScale=Math.max(0,...paths.map((path:any)=>Math.abs(path.area)));
 const contours=paths.filter((path:any)=>Math.abs(path.area)>areaScale*1e-7).map((path:any)=>path.curves.map((curve:any)=>{
  const v=curve.getValues();return [[v[0],v[1]],[v[2],v[3]],[v[4],v[5]],[v[6],v[7]]] as Cubic;
 }) as Contour).filter(c=>c.length>0);
 source.remove();united.remove();return contours;
}

// Smooth a vector contour in arc length, then fit cubic curves back to it.
// The caller fades this to zero at each source pole.
export function smoothPath(pathData:string,amount:number,em=100):string {
 if(!pathData||amount<.001)return pathData;
 const source=new scope.CompoundPath({pathData,insert:false,fillRule:'nonzero'});
 const result:string[]=[];
 for(const child of source.children as paper.Path[]){
  const length=child.length;if(length<em*.001)continue;
  const count=Math.max(24,Math.min(1600,Math.ceil(length/(em*.005))));
  const curves=child.curves;let curve=0,offset=0;
  const points=Array.from({length:count},(_,i)=>{
   const distance=i*length/count;
   while(curve<curves.length-1&&offset+curves[curve].length<distance){offset+=curves[curve].length;curve++;}
   return curves[curve].getPointAt(Math.min(curves[curve].length,Math.max(0,distance-offset)));
  });
  // Limit smoothing to the contour itself, including tiny disappearing details.
  const sigma=Math.min(em*.018*amount,length*.08)/(length/count),radius=Math.ceil(sigma*3);
  const kernel=Array.from({length:radius*2+1},(_,i)=>Math.exp(-((i-radius)**2)/(2*sigma*sigma)));
  const filtered=points.map((p,i)=>{
   let x=0,y=0,total=0;
   for(let k=-radius;k<=radius;k++){const w=kernel[k+radius],q=points[((i+k)%count+count)%count];x+=q.x*w;y+=q.y*w;total+=w;}
   return [x/total,y/total] as Point;
  });
  const fitted=fitClosed(filtered,Math.min(em*.00015,length*.0005)),fmt=(p:Point)=>p.map(v=>v.toFixed(5)).join(',');
  result.push('M'+fmt(fitted[0][0])+fitted.map(c=>'C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3])).join('')+'Z');
 }
 source.remove();return result.join('');
}

export function pathCurves(pathData:string):Contour[]{
 if(!pathData)return [];
 const source=new scope.CompoundPath({pathData,insert:false});
 const result=source.children.map((p:any)=>p.curves.map((c:any)=>{const v=c.getValues();return [[v[0],v[1]],[v[2],v[3]],[v[4],v[5]],[v[6],v[7]]] as Cubic;}));
 source.remove();return result;
}

export interface GeometryMeasures {crossings:number;counters:number;inkArea:number;stroke:number;counterArea:number}
export function measureGeometry(pathData:string):GeometryMeasures {
 if(!pathData)return {crossings:0,counters:0,inkArea:0,stroke:0,counterArea:0};
 const source=new scope.CompoundPath({pathData,insert:false,fillRule:'nonzero'});
 const crossings=source.getIntersections().filter((p:any)=>p.isCrossing()).length;
 const united=source.unite(source,{insert:false});
 const paths=(united instanceof scope.CompoundPath?united.children:[united]) as paper.Path[];
 const largest=paths.reduce((best,p)=>Math.abs(p.area)>Math.abs(best?.area??0)?p:best,paths[0]);
 const holes=paths.filter(p=>Math.abs(p.area)>.02&&p.area*(largest?.area??0)<0);
 const counters=holes.length,counterArea=holes.length?Math.min(...holes.map(p=>Math.abs(p.area))):0;
 const widths:number[]=[];
 const bounds=united.bounds;
 for(const t of [.3,.4,.5,.6,.7]){
  const y=bounds.top+bounds.height*t;
  const ray=new scope.Path.Line({from:[bounds.left-1,y],to:[bounds.right+1,y],insert:false});
  const xs=united.getIntersections(ray).map((p:any)=>p.point.x).sort((a:number,b:number)=>a-b).filter((v:number,i:number,a:number[])=>!i||v-a[i-1]>.001);
  // Two or more ink spans distinguish side stems from a bowl's crossbar.
  if(xs.length>=4)for(let i=0;i+1<xs.length;i+=2)widths.push(xs[i+1]-xs[i]);
  ray.remove();
 }
 widths.sort((a,b)=>a-b);
 const result={crossings,counters,counterArea,inkArea:Math.abs(united.area),stroke:widths.length?widths[Math.floor(widths.length/2)]:0};
 source.remove();united.remove();return result;
}
