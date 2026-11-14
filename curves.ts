import {protectCounters} from './counter-guard';
export type Point = [number, number];
export type Cubic = [Point, Point, Point, Point];
export type Contour = Cubic[];
export interface Command { command: string; args: number[] }
export const outlineFillRule = 'nonzero';
export function sourcePath(commands:Command[],x=0,y=0,scale=1):string {
 const codes:Record<string,string>={moveTo:'M',lineTo:'L',quadraticCurveTo:'Q',bezierCurveTo:'C',closePath:'Z'};
 return commands.map(({command,args})=>{
  if(!(command in codes))throw new Error('Unsupported outline command: '+command);
  return codes[command]+args.map((v,i)=>i%2===0?x+v*scale:y-v*scale).join(',');
 }).join('');
}
const lerp=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function split(c:Cubic,t:number):[Cubic,Cubic]{
 const a=lerp(c[0],c[1],t),b=lerp(c[1],c[2],t),d=lerp(c[2],c[3],t),e=lerp(a,b,t),f=lerp(b,d,t),g=lerp(e,f,t);
 return [[c[0],a,e,g],[g,f,d,c[3]]];
}
export function at(c:Cubic,t:number):Point{
 const u=1-t,a=u*u*u,b=3*u*u*t,d=3*u*t*t,e=t*t*t;
 return [a*c[0][0]+b*c[1][0]+d*c[2][0]+e*c[3][0],a*c[0][1]+b*c[1][1]+d*c[2][1]+e*c[3][1]];
}
export function readContours(commands:Command[],x=0,y=0,scale=1):Contour[]{
 const contours:Contour[]=[];let contour:Contour=[],p:Point=[0,0],start:Point=[0,0];
 const point=(a:number,b:number):Point=>[x+a*scale,y-b*scale];
 const line=(q:Point)=>{if(distance(p,q)>1e-9)contour.push([p,lerp(p,q,1/3),lerp(p,q,2/3),q]);p=q;};
 for(const {command,args:a}of commands){
  if(command==='moveTo'){if(contour.length)contours.push(contour);contour=[];p=start=point(a[0],a[1]);}
  else if(command==='lineTo')line(point(a[0],a[1]));
  else if(command==='quadraticCurveTo'){const q=point(a[0],a[1]),r=point(a[2],a[3]);contour.push([p,lerp(p,q,2/3),lerp(r,q,2/3),r]);p=r;}
  else if(command==='bezierCurveTo'){const q=point(a[4],a[5]);contour.push([p,point(a[0],a[1]),point(a[2],a[3]),q]);p=q;}
  else if(command==='closePath'){line(start);if(contour.length)contours.push(contour);contour=[];}
  else throw new Error('Unsupported outline command: '+command);
 }
 if(contour.length)contours.push(contour);return contours;
}
function measure(contour:Contour){
 let total=0;const starts:number[]=[],tables:number[][]=[];
 for(const c of contour){starts.push(total);const table=[0];let last=c[0];for(let j=1;j<=32;j++){const p=at(c,j/32);total+=distance(p,last);table.push(total-starts.at(-1)!);last=p;}tables.push(table);}
 return {contour,total,starts,tables};
}
type Measured=ReturnType<typeof measure>;
function location(m:Measured,s:number):[number,number]{
 const length=Math.max(0,Math.min(m.total,s*m.total));let i=m.starts.length-1;
 while(i>0&&m.starts[i]>length+1e-9)i--;
 const table=m.tables[i],within=length-m.starts[i];let j=0;while(j<31&&table[j+1]<within)j++;
 return [i,Math.min(1,(j+(within-table[j])/(table[j+1]-table[j]||1))/32)];
}
function sample(m:Measured,s:number):Point{const [i,t]=location(m,((s%1)+1)%1);return at(m.contour[i],t);}
function portion(m:Measured,from:number,to:number):Cubic{
 const mid=(from+to)/2,cycle=Math.floor(mid),a=from-cycle,b=to-cycle;
 const [i]=location(m,(a+b)/2);const start=m.starts[i]/m.total,end=(m.starts[i]+m.tables[i][32])/m.total;
 const toT=(s:number)=>{if(s<=start+1e-8)return 0;if(s>=end-1e-8)return 1;return location(m,s)[1];};
 const t0=toT(a),t1=toT(b),c=m.contour[i];
 if(t0<1e-10)return split(c,t1)[0];
 return split(split(c,t0)[1],(t1-t0)/(1-t0))[0];
}
function area(c:Contour){const points=c.flatMap(s=>[s[0],at(s,.5)]);return points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;}
function center(c:Contour):Point{const p=c.map(s=>s[0]);return[p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];}
function reverse(c:Contour):Contour{return c.slice().reverse().map(s=>[s[3],s[2],s[1],s[0]]);}
function collapse(c:Contour):Contour{const p=center(c);return c.map(()=>[p,p,p,p]);}
export function correspond(a:Contour,b:Contour):[Contour,Contour]{
 if(Math.abs(area(a))<1e-10)return[collapse(b),b];
 if(Math.abs(area(b))<1e-10)return[a,collapse(a)];
 if(area(a)*area(b)<0)b=reverse(b);
 const ma=measure(a),mb=measure(b);let phase=0,best=Infinity;
 // Include original landmarks as well as regular candidates; no pixels enter this calculation.
 const phases=[...Array.from({length:96},(_,i)=>i/96),...mb.starts.map(v=>v/mb.total)];
 for(const shift of phases){let cost=0;for(let i=0;i<48;i++){const p=sample(ma,i/48),q=sample(mb,i/48+shift);cost+=(p[0]-q[0])**2+(p[1]-q[1])**2;}if(cost<best){best=cost;phase=shift;}}
 const knots=[0,1,...ma.starts.map(v=>v/ma.total),...mb.starts.map(v=>((v/mb.total-phase)%1+1)%1)].sort((x,y)=>x-y).filter((v,i,all)=>i===0||v-all[i-1]>1e-7);
 const aa:Contour=[],bb:Contour=[];
 for(let i=0;i<knots.length-1;i++){aa.push(portion(ma,knots[i],knots[i+1]));bb.push(portion(mb,knots[i]+phase,knots[i+1]+phase));}
 return[aa,bb];
}
export function pairContours(a:Contour[],b:Contour[]):[Contour,Contour][]{
 const unused=b.slice(),pairs:[Contour,Contour][]=[];
 for(const c of a.slice().sort((x,y)=>Math.abs(area(y))-Math.abs(area(x)))){
  let index=-1,best=Infinity;
  for(let i=0;i<unused.length;i++){const d=unused[i];const cost=distance(center(c),center(d))+Math.abs(Math.sqrt(Math.abs(area(c)))-Math.sqrt(Math.abs(area(d))));if(cost<best){best=cost;index=i;}}
  if(index<0)pairs.push([c,collapse(c)]);else pairs.push(correspond(c,unused.splice(index,1)[0]));
 }
 for(const c of unused)pairs.push([collapse(c),c]);return pairs;
}
export function curvePath(pairs:[Contour,Contour][],field:(x:number,y:number)=>number):string{
 const chunks:string[]=[];const fmt=(p:Point)=>`${p[0].toFixed(3)},${p[1].toFixed(3)}`;
 for(const [a,b]of pairs){
  const blended=a.map((c,i)=>c.map((p,j)=>{const q=b[i][j],mid=lerp(p,q,.5);return lerp(p,q,field(mid[0],mid[1]));}) as Cubic);
  chunks.push('M'+fmt(blended[0][0]));for(const c of blended)chunks.push('C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3]));chunks.push('Z');
 }
 return chunks.join('');
}

function correspondenceWarp(reference:Measured,target:Measured,phase:number,structured=false):[number,number][] {
 const n=96,stride=n+1;
 const a=Array.from({length:stride},(_,i)=>sample(reference,i/n));
 const b=Array.from({length:stride},(_,i)=>sample(target,i/n+phase));
 const bounds=a.reduce((v,p)=>[Math.min(v[0],p[0]),Math.min(v[1],p[1]),Math.max(v[2],p[0]),Math.max(v[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
 const scale=(bounds[2]-bounds[0])**2+(bounds[3]-bounds[1])**2;
 const tangent=(m:Measured,t:number):Point=>{const p=sample(m,t-1/384),q=sample(m,t+1/384),d=Math.hypot(q[0]-p[0],q[1]-p[1])||1;return[(q[0]-p[0])/d,(q[1]-p[1])/d];};
 const ta=a.map((_,i)=>tangent(reference,i/n)),tb=b.map((_,i)=>tangent(target,i/n+phase));
 const cost=(i:number,j:number)=>(a[i][0]-b[j][0])**2+(a[i][1]-b[j][1])**2+(structured?scale*.065*(1-ta[i][0]*tb[j][0]-ta[i][1]*tb[j][1]):0);
 const dp=new Float64Array(stride*stride);dp.fill(Infinity);dp[0]=cost(0,0);
 const step=new Uint8Array(dp.length);
 for(let i=1;i<=n;i++)for(let j=1;j<=n;j++){
  const k=i*stride+j,c=cost(i,j);let best=dp[(i-1)*stride+j-1]+c,chosen=1;
  if(j>=2){const v=dp[(i-1)*stride+j-2]+c+cost(i,j-1);if(v<best){best=v;chosen=2;}}
  if(i>=2){const v=dp[(i-2)*stride+j-1]+c+cost(i-1,j);if(v<best){best=v;chosen=3;}}
  dp[k]=best;step[k]=chosen;
 }
 const knots:[number,number][]=[];let i=n,j=n;
 while(i>0&&j>0){knots.push([i/n,j/n]);const s=step[i*stride+j];i-=s===3?2:1;j-=s===2?2:1;}
 knots.push([0,0]);return knots.reverse();
}
function warpAt(knots:[number,number][],value:number,inverse=false):number {
 const a=inverse?1:0,b=inverse?0:1;
 if(value<=0)return 0;if(value>=1)return 1;
 let i=1;while(i<knots.length-1&&knots[i][a]<value)i++;
 const start=knots[i-1],end=knots[i];return start[b]+(end[b]-start[b])*(value-start[a])/(end[a]-start[a]);
}
// Match both sides of the fork: aligning only its inner valley can invert the
// thin stroke between that valley and the outer branch.
function yLandmarks(m:Measured):number[]|undefined {
 const count=768,points=Array.from({length:count},(_,i)=>sample(m,i/count));
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),height=bottom-top;
 const cap=(side:number)=>{
  const candidates=points.map((p,i)=>({p,i})).filter(({p})=>side<0?p[0]<(left+right)/2:p[0]>(left+right)/2);
  const y=Math.min(...candidates.map(({p})=>p[1])),near=candidates.filter(({p})=>p[1]<y+height*.005);
  const x=near.reduce((n,{i})=>n+Math.cos(i/count*2*Math.PI),0),v=near.reduce((n,{i})=>n+Math.sin(i/count*2*Math.PI),0);
  return (Math.atan2(v,x)/(2*Math.PI)+1)%1;
 };
 const a=cap(-1),b=cap(1),distance=(b-a+1)%1;
 const arc=points.map((p,i)=>({p,t:i/count,u:(i/count-a+1)%1}));
 const first=arc.filter(p=>p.u<distance),second=arc.filter(p=>p.u>=distance);
 if(!first.length||!second.length)return;
 const max=(v:typeof arc)=>v.reduce((best,p)=>p.p[1]>best.p[1]?p:best);
 const inner=max(first).p[1]<max(second).p[1]?first:second,outer=inner===first?second:first;
 const fork=max(inner),tail=max(outer),sign=Math.sign(area(m.contour));
 let junction:typeof fork|undefined,best=0;
 for(const point of outer){
  if(point.p[1]<top+height*.25||point.p[1]>top+height*.72)continue;
  const prev=sample(m,point.t-.025),next=sample(m,point.t+.025),u=[point.p[0]-prev[0],point.p[1]-prev[1]],v=[next[0]-point.p[0],next[1]-point.p[1]];
  const score=-sign*Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);
  if(score>best){best=score;junction=point;}
 }
 if(!junction||best<.4)return;
 // Refine the broad concavity to an actual curve junction, ignoring edge grain.
 let join=junction.t,turn=0;
 for(const offset of m.starts){
  const t=offset/m.total;if(Math.abs(t-junction.t)>.03)continue;
  const p=sample(m,t),prev=sample(m,t-.001),next=sample(m,t+.001),u=[p[0]-prev[0],p[1]-prev[1]],v=[next[0]-p[0],next[1]-p[1]];
  const score=-sign*Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);
  if(score>turn){turn=score;join=t;}
 }
 const branchSpan=(a-join+1)%1,tailOnBranch=(tail.t-join+1)%1<branchSpan;
 const branch=outer.filter(p=>(((p.t-join+1)%1<branchSpan)!==tailOnBranch));
 if(!branch.length)return;
 const beneathFork=branch.reduce((best,p)=>Math.hypot(p.p[0]-fork.p[0],p.p[1]-fork.p[1])<Math.hypot(best.p[0]-fork.p[0],best.p[1]-fork.p[1])?p:best);
 return [a,b,fork.t,join,tail.t,beneathFork.t];
}
export function alignContours(contours:Contour[],structured=false,counter=false,character=""):Contour[]{
 const ref=contours.find(c=>Math.abs(area(c))>1e-10);
 if(!ref)return contours;
 const oriented=contours.map(c=>area(c)*area(ref)<0?reverse(c):c);
 const measured=oriented.map(c=>Math.abs(area(c))>1e-10?measure(c):null);
 const reference=measure(ref);
 const extreme=(m:Measured,axis:number,sign:number)=>{
  const count=768,values=Array.from({length:count},(_,i)=>sample(m,i/count)[axis]*sign),max=Math.max(...values);
  let x=0,y=0;values.forEach((v,i)=>{if(max-v<.002){x+=Math.cos(i/count*Math.PI*2);y+=Math.sin(i/count*Math.PI*2);}});
  return ((Math.atan2(y,x)/(Math.PI*2))%1+1)%1;
 };
 const referenceSamples=Array.from({length:48},(_,i)=>sample(reference,i/48));
 const phases=measured.map((m,index)=>{
  if(!m)return 0;if(structured&&counter)return extreme(m,1,-1);if(oriented[index]===ref)return 0;let phase=0,best=Infinity;
  const targetSamples=Array.from({length:96},(_,i)=>sample(m,i/96));
  for(const shift of [...Array.from({length:96},(_,i)=>i/96),...m.starts.map(v=>v/m.total)]){
   let cost=0;for(let i=0;i<48;i++){const p=referenceSamples[i],grid=Math.round(shift*96),q=Math.abs(grid-shift*96)<1e-10?targetSamples[(i*2+grid)%96]:sample(m,i/48+shift);cost+=(p[0]-q[0])**2+(p[1]-q[1])**2;}
   if(cost<best){best=cost;phase=shift;}
  }
  return phase;
 });
 const warps=measured.map(m=>[[0,0],[1,1]] as [number,number][]);
 const landmarkCounter=structured&&counter&&measured.every(Boolean);
 if(!landmarkCounter)measured.forEach((m,i)=>{if(m&&oriented[i]!==ref)warps[i]=correspondenceWarp(reference,m,phases[i],structured);});
 if(landmarkCounter){
  const directions=area(ref)>0?[[0,1],[1,1],[0,-1]]:[[0,-1],[1,1],[0,1]];
  // Counter top/right/bottom/left are shared landmarks, not nearest pixels.
  measured.forEach((m,i)=>{warps[i]=[[0,0],...directions.map(([axis,sign],j)=>[(j+1)/4,((extreme(m!,axis,sign)-phases[i])%1+1)%1] as [number,number]),[1,1]];});
  if(warps.some(w=>w.some((p,i)=>i>0&&p[1]<=w[i-1][1])))measured.forEach((m,i)=>{warps[i]=m?correspondenceWarp(reference,m,phases[i],structured):[[0,0],[1,1]];});
 }
 if(structured&&!counter&&character==='y'&&measured.every(Boolean)){
  const landmarks=measured.map(m=>yLandmarks(m!));
  if(landmarks.every(Boolean)){
   const order=landmarks[0]!.map((t,id)=>({id,u:(t-landmarks[0]![0]+1)%1})).sort((a,b)=>a.u-b.u);
   const positions=landmarks.map(ls=>order.map(({id})=>(ls![id]-ls![0]+1)%1));
   if(positions.every(p=>p.every((v,i)=>!i||v>p[i-1]+.001))){
    landmarks.forEach((ls,i)=>{phases[i]=ls![0];warps[i]=positions[i].map((v,j)=>[positions[0][j],v]);warps[i].push([1,1]);});
   }
  }
 }
 const knots=[0,1,...warps.flatMap(w=>w.map(p=>p[0])),...measured.flatMap((m,i)=>m?m.starts.map(v=>warpAt(warps[i],((v/m.total-phases[i])%1+1)%1,true)):[])].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v-a[i-1]>1e-7);
 return measured.map((m,index)=>{
  if(!m){const p=center(contours[index]);return knots.slice(1).map(()=>[p,p,p,p] as Cubic);}
  return knots.slice(1).map((end,i)=>portion(m,warpAt(warps[index],knots[i])+phases[index],warpAt(warps[index],end)+phases[index]));
 });
}
function assignment(cost:number[][]):number[]{
 const n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  do{
   used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=n;j++)if(!used[j]){const value=cost[i0-1][j-1]-u[i0]-v[j];if(value<min[j]){min[j]=value;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
   for(let j=0;j<=n;j++){if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;}j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 const result=Array(n).fill(-1);for(let j=1;j<=n;j++)result[p[j]-1]=j-1;return result;
}
export function groupContours(shapes:Contour[][],structured=false,character=""):Contour[][]{
 const reference=shapes.reduce((best,s,i)=>s.length>shapes[best].length?i:best,0);
 const refs=shapes[reference].slice().sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
 if(!refs.length)return [];
 // Assign all contours together: a lower bowl must not greedily steal the
 // only upper counter from a master that has no lower counter.
 const matches=shapes.map((shape,index)=>{
  if(index===reference)return refs.map(c=>c);
  const costs=refs.map(c=>refs.map((_,j)=>j>=shape.length?0:distance(center(c),center(shape[j]))+Math.abs(Math.sqrt(Math.abs(area(c)))-Math.sqrt(Math.abs(area(shape[j]))))+(area(c)*area(shape[j])<0?10000:0)));
  return assignment(costs).map((j,i)=>{
   if(j<shape.length)return shape[j];
   return collapse(refs[i]);
  });
 });
 return refs.map((c,i)=>alignContours(matches.map(m=>m[i]),structured,area(c)*area(refs[0])<0,character));
}
export function blendPath(groups:Contour[][],field:(x:number,y:number)=>number[],structured=false):string{
 const fmt=(p:Point)=>`${p[0].toFixed(5)},${p[1].toFixed(5)}`;const chunks:string[]=[],contours:Contour[]=[];
 for(const group of groups){
  const blended=group[0].map((segment,i)=>segment.map((_,j)=>{
   const points=group.map(c=>c[i][j]);const mid:Point=[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
   const weights=field(mid[0],mid[1]);return points.reduce((sum,p,k)=>[sum[0]+p[0]*weights[k],sum[1]+p[1]*weights[k]] as Point,[0,0] as Point);
  }) as Cubic);
  if(structured){
   // Blend direction and handle length separately. Mixing handle vectors makes
   // smooth joins kink whenever the masters use different parameter speeds.
   for(let i=0;i<blended.length;i++)for(const side of [0,1]){
    const anchor=side===0?0:3,handle=side===0?1:2;
    const mid=group.reduce((p,c)=>[p[0]+c[i][anchor][0]/group.length,p[1]+c[i][anchor][1]/group.length] as Point,[0,0] as Point);
    const weights=field(mid[0],mid[1]);let dx=0,dy=0,length=0;
    for(let k=0;k<group.length;k++){
     const c=group[k][i],x=c[handle][0]-c[anchor][0],y=c[handle][1]-c[anchor][1],d=Math.hypot(x,y);
     if(d>1e-9){dx+=weights[k]*x/d;dy+=weights[k]*y/d;}length+=weights[k]*d;
    }
    const norm=Math.hypot(dx,dy);if(norm>1e-9){const p=blended[i][anchor];blended[i][handle]=[p[0]+dx/norm*length,p[1]+dy/norm*length];}
   }
  }
  contours.push(blended);
 }
 for(const contour of structured?protectCounters(contours):contours){chunks.push('M'+fmt(contour[0][0]));for(const c of contour)chunks.push('C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3]));chunks.push('Z');}
 return chunks.join('');
}
