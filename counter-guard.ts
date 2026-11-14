import type {Contour,Point} from './curves';
const sample=(c:Contour)=>c.flatMap(s=>{const p=s[0],q=s[1],r=s[2],t=s[3];return [p,[(p[0]+3*q[0]+3*r[0]+t[0])/8,(p[1]+3*q[1]+3*r[1]+t[1])/8] as Point];});
const signed=(ps:Point[])=>ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2;
function inside(p:Point,poly:Point[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function protectCounters(contours:Contour[]):Contour[]{
 if(contours.length<2)return contours;
 const polygons=contours.map(sample),areas=polygons.map(signed),largest=areas.reduce((best,a,i)=>Math.abs(a)>Math.abs(areas[best])?i:best,0);
 const outers=polygons.filter((_,i)=>areas[i]*areas[largest]>0);
 const contains=(p:Point)=>outers.some(poly=>inside(p,poly));
 return contours.map((c,index)=>{
  if(areas[index]*areas[largest]>=0||Math.abs(areas[index])<1e-9)return c;
  const ps=polygons[index],probes=ps.filter((_,i)=>i%Math.max(1,Math.floor(ps.length/48))===0);
  if(probes.every(contains))return c;
  const center:Point=[ps.reduce((s,p)=>s+p[0],0)/ps.length,ps.reduce((s,p)=>s+p[1],0)/ps.length];
  let target=center;
  if(!contains(center)){
   let best=Infinity;
   for(const poly of outers){
    const ys=poly.map(p=>p[1]),low=Math.min(...ys),high=Math.max(...ys);
    for(let row=0;row<=24;row++){
     const y=row===0?center[1]:low+(high-low)*(row-.5)/24,xs:number[]=[];
     for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}
     xs.sort((a,b)=>a-b);
     for(let i=0;i+1<xs.length;i+=2){const x=(xs[i]+xs[i+1])/2,d=(x-center[0])**2+(y-center[1])**2;if(d<best){best=d;target=[x,y];}}
    }
   }
  }
  if(!contains(target))return [];
  const transform=(p:Point,scale:number):Point=>[target[0]+(p[0]-center[0])*scale,target[1]+(p[1]-center[1])*scale];
  let low=0,high=1;
  for(let i=0;i<12;i++){const mid=(low+high)/2;if(probes.every(p=>contains(transform(p,mid))))low=mid;else high=mid;}
  // Leave a small interior margin, rather than touching through the outer stroke.
  const scale=low*(1-.08*(1-low));
  return scale<1e-5?[]:c.map(s=>s.map(p=>transform(p,scale)) as typeof s);
 }).filter(c=>c.length>0);
}
