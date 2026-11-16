import {freeBudget,type Weights,type Locks} from './weights';
export type Point=[number,number];
export function fontPoles(count:number):Point[]{return Array.from({length:count},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/count;return [180+122*Math.cos(a),166+122*Math.sin(a)];});}
export function mapPosition(weights:Weights,poles:Point[]):Point{return poles.reduce((p,q,i)=>[p[0]+q[0]*weights[i],p[1]+q[1]*weights[i]] as Point,[0,0] as Point);}
// Mean-value coordinates on a convex polygon: exact at every pole and linear
// along every edge, with continuous interior mixtures and no triangle seams.
export function mapWeights(x:number,y:number,poles:Point[]):Weights{
 const n=poles.length,zero=()=>poles.map(()=>0);
 if(n===1)return [1];
 let closest=Infinity,edge=zero(),outside=false;
 for(let i=0;i<n;i++){
  const a=poles[i],b=poles[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1];
  if(dx*(y-a[1])-dy*(x-a[0])<0)outside=true;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
  if(d<closest){closest=d;edge=zero();edge[i]=1-t;edge[(i+1)%n]=t;}
 }
 if(outside||closest<1e-7)return edge;
 const vectors=poles.map(p=>[p[0]-x,p[1]-y] as Point),r=vectors.map(p=>Math.hypot(...p));
 const half=vectors.map((p,i)=>{const j=(i+1)%n,q=vectors[j];return (p[0]*q[1]-p[1]*q[0])/(r[i]*r[j]+p[0]*q[0]+p[1]*q[1]);});
 const w=r.map((v,i)=>(half[(i+n-1)%n]+half[i])/v),total=w.reduce((a,b)=>a+b,0);
 return w.map(v=>v/total);
}
export function lockMapWeights(current:Weights,proposed:Weights,locks:Locks):Weights{
 const free=current.flatMap((_,i)=>locks[i]?[]:[i]);if(free.length<2)return [...current];
 if(free.length===current.length)return proposed;
 const budget=freeBudget(current,locks),values=free.map(i=>proposed[i]).sort((a,b)=>b-a);
 let sum=0,threshold=0;
 for(let k=0;k<values.length;k++){sum+=values[k];const t=(sum-budget)/(k+1);if(k===values.length-1||values[k+1]<=t){threshold=t;break;}}
 return current.map((v,i)=>locks[i]?v:Math.max(0,proposed[i]-threshold));
}
export function setupFontMap(svg:SVGSVGElement,names:string[],change:(w:Weights)=>void,current:()=>Weights,locks:()=>Locks){
 const ns='http://www.w3.org/2000/svg',poles=fontPoles(names.length);
 const element=(tag:string,attrs:Record<string,string>)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);return e;};
 element('path',{d:'M'+poles.map(p=>p.join(',')).join('L')+'Z',fill:'none',stroke:'currentColor','stroke-opacity':'.25'});
 const route=element('path',{fill:'none',stroke:'#bc7451','stroke-width':'1.5','stroke-dasharray':'4 4'}),start=element('circle',{r:'4',fill:'#bc7451'}),end=element('circle',{r:'4',fill:'#bc7451'});
 poles.forEach((p,i)=>{
  element('line',{x1:'180',y1:'166',x2:String(p[0]),y2:String(p[1]),stroke:'currentColor','stroke-opacity':'.07'});
  const dot=element('circle',{cx:String(p[0]),cy:String(p[1]),r:'4',fill:'currentColor'});dot.setAttribute('data-font',String(i));
  const dx=p[0]-180,dy=p[1]-166,label=element('text',{x:String(p[0]+dx*.12),y:String(p[1]+dy*.12+4),'text-anchor':Math.abs(dx)<5?'middle':dx>0?'start':'end',fill:'currentColor','font-size':'12'});label.textContent=names[i];
 });
 const handle=element('circle',{id:'map-handle',r:'7',fill:'currentColor',stroke:'var(--background)','stroke-width':'2'});
 const drag=(e:PointerEvent)=>{const m=svg.getScreenCTM();if(!m)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());change(lockMapWeights(current(),mapWeights(p.x,p.y,poles),locks()));};
 svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);const selected=(e.target as Element).getAttribute('data-font');if(selected!==null)change(lockMapWeights(current(),poles.map((_,i)=>i===Number(selected)?1:0),locks()));else drag(e);});svg.addEventListener('pointermove',e=>{if(svg.hasPointerCapture(e.pointerId))drag(e);});svg.addEventListener('pointerup',e=>{if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);});
 const point=(e:Element,w:Weights)=>{const p=mapPosition(w,poles);e.setAttribute('cx',String(p[0]));e.setAttribute('cy',String(p[1]));return p;};
 return (w:Weights,a:Weights,b:Weights)=>{point(handle,w);const p=point(start,a),q=point(end,b);route.setAttribute('d',`M${p}L${q}`);};
}
