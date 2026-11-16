export const dimensions = ['Curviness', 'Sharpness', 'Thinness', 'Width', 'Slant', 'Openness', 'Serifs', 'Regularity'] as const;
export type Vector = number[];
export const clamp = (n: number, lo=0, hi=1) => Math.max(lo, Math.min(hi,n));
export const mix = (a: Vector,b: Vector,t: number) => a.map((v,i)=>v+(b[i]-v)*t);
export const dot = (a: Vector,b: Vector) => a.reduce((n,v,i)=>n+v*b[i],0);
export const anchors: Record<string, Vector> = {
  Neon:   [.55,.45,2/3,0,0,.45,0,.90],
  Argon:  [.75,.25,2/3,0,0,.80,0,.65],
  Xenon:  [.55,.70,2/3,0,0,.50,1,.85],
  Radon:  [.95,.20,2/3,0,0,.65,.15,.10],
  Krypton:[.20,.90,2/3,0,0,.35,0,1],
};
export const familyDimensions = [0,1,5,6,7];
export interface SemanticAxis {left:string;right:string;a:Vector;b:Vector}
export const semanticAxes: SemanticAxis[] = [
 {left:'Kiki',right:'Bouba',a:[.05,.98,.85,.15,.2,.3,0,.95],b:[.98,.05,.20,.8,.05,.8,.05,.55]},
 {left:'Circus',right:'Spaceship',a:[.8,.3,.15,.8,.45,.75,.8,.15],b:[.25,.85,.65,.25,.12,.4,.05,.98]},
 {left:'Dog',right:'Cat',a:[.8,.25,.25,.75,.05,.85,.1,.35],b:[.65,.75,.8,.2,.5,.4,.25,.7]},
];
export function project(z:Vector,axis:SemanticAxis):number {
 const w=axis.b.map((v,i)=>v-axis.a[i]);const n=dot(w,w);
 if(n<1e-12) throw new Error('An axis needs two different positions.');
 return dot(z.map((v,i)=>v-axis.a[i]),w)/n;
}
// Euclidean projection onto the requested semantic plane, constrained to the unit cube.
export function moveAlong(z:Vector,axis:SemanticAxis,t:number):Vector {
 const w=axis.b.map((v,i)=>v-axis.a[i]);const n=dot(w,w);
 if(n<1e-12) throw new Error('An axis needs two different positions.');
 const target=dot(w,axis.a)+clamp(t)*n;
 let low=-1,high=1;
 const at=(lambda:number)=>z.map((v,i)=>clamp(v+lambda*w[i]));
 while(dot(w,at(low))>target) low*=2;
 while(dot(w,at(high))<target) high*=2;
 for(let i=0;i<64;i++){const mid=(low+high)/2;if(dot(w,at(mid))<target)low=mid;else high=mid;}
 return at((low+high)/2);
}
export function weights(z:Vector):number[] {
 const distances=Object.values(anchors).map(a=>familyDimensions.reduce((s,j)=>s+(a[j]-z[j])**2,0));
 const exact=distances.findIndex(d=>d<1e-14);
 if(exact>=0)return distances.map((_,i)=>i===exact?1:0);
 const raw=distances.map(d=>1/(d*d));const total=raw.reduce((a,b)=>a+b,0);
 return raw.map(v=>v/total);
}
export const nativeAxes=(z:Vector)=>({wght:800-600*z[2],wdth:100+25*z[3],slnt:-11*z[4]});
export function describe(z:Vector):string {
 const parts=[z[2]>.78?'very thin':z[2]>.55?'light':z[2]>.3?'medium-weight':'bold',z[3]>.65?'wide':z[3]>.25?'slightly expanded':'normal-width',z[4]>.65?'strongly slanted':z[4]>.12?'gently slanted':'upright',z[0]>.7?'curving':z[0]<.35?'angular':'moderately curved',z[1]>.7?'sharp-edged':z[1]<.3?'soft-edged':'moderately sharp',z[5]>.7?'open':z[5]<.4?'compact openings':'moderately open',z[6]>.65?'strong serifs':z[6]>.25?'some serif influence':'little serif influence',z[7]>.8?'regular':z[7]<.35?'hand-drawn in character':'slightly irregular'];
 return parts.join(', ')+'.';
}
const words:Record<string,Partial<Record<number,number>>>={
 curvy:{0:.95},curved:{0:.85},curviness:{0:.95},round:{0:.95,1:.15},rounded:{0:.95,1:.15},soft:{0:.85,1:.1},gentle:{0:.8,1:.2,2:.7},angular:{0:.1,1:.9},sharp:{1:.95},sharpness:{1:.95},spiky:{0:.1,1:1},smooth:{0:.85,1:.1},
 thin:{2:.9},thinner:{2:.95},thinness:{2:.95},delicate:{2:.95},light:{2:.85},bold:{2:.15},bolder:{2:.1},thick:{2:.1},heavy:{2:0},strong:{2:.2},quiet:{2:.8,4:0,7:.8},loud:{2:.05,3:.8,4:.25},
 wide:{3:1},wider:{3:1},expanded:{3:.8},narrow:{3:0},condensed:{3:0},slanted:{4:.9},slant:{4:.9},italic:{4:1},upright:{4:0},open:{5:.95},openness:{5:.95},closed:{5:.1},compact:{3:0,5:.2},airy:{2:.8,3:.8,5:.95},
 serif:{6:1},serifs:{6:1},serifed:{6:1},slab:{6:1},sans:{6:0},regular:{7:.95},regularity:{7:.95},irregular:{7:.1},organic:{0:.85,1:.2,7:.15},precise:{1:.75,7:.95},technical:{0:.25,1:.85,7:.95},mechanical:{0:.2,1:.9,5:.35,6:0,7:1},
 warm:{0:.8,1:.25,5:.8,7:.5},friendly:{0:.85,1:.15,5:.85,7:.5},human:{0:.8,1:.25,5:.8,7:.4},handwritten:{0:.95,1:.2,5:.65,6:.15,7:.1},formal:{2:.5,4:0,6:.65,7:.95},authoritative:{2:.2,6:.8,7:.9},playful:{0:.9,3:.7,4:.4,7:.15},expressive:{0:.85,4:.65,7:.2},futuristic:{0:.25,1:.85,6:0,7:.95},calm:{2:.65,4:0,7:.8},elegant:{2:.85,4:.3,6:.65},urgent:{2:.15,4:.85},
};
export function fromLanguage(text:string,initial:Vector):{z:Vector;recognized:string[]} {
 let z=[...initial]; const recognized:string[]=[];const tokens=text.toLowerCase().match(/[a-z]+/g)||[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i]; const name=Object.keys(anchors).find(n=>n.toLowerCase()===token);
  const axis=semanticAxes.find(a=>a.left.toLowerCase()===token||a.right.toLowerCase()===token);
  if(name){z=[...anchors[name]];recognized.push(token);continue;}
  if(axis){z=[...(axis.left.toLowerCase()===token?axis.a:axis.b)];recognized.push(token);continue;}
  const changes=words[token];if(!changes)continue;
  const prev=tokens[i-1],prev2=tokens[i-2];
  for(const [key,value]of Object.entries(changes)){
   const j=Number(key);let target=value!;
   if(prev==='more')target=clamp(z[j]+Math.sign(target-.5)*.18);
   if(prev==='less')target=clamp(z[j]-Math.sign(target-.5)*.18);
   if(prev==='not'||prev==='without'||prev2==='not')target=1-target;
   if(prev==='slightly'||prev==='somewhat')target=z[j]+(target-z[j])*.4;
   if(prev==='very')target=clamp(.5+(target-.5)*1.4);
   z[j]=target;
  }
  recognized.push(token);
 }
 return{z,recognized};
}
export function edt(mask:Uint8Array,width:number,height:number,inside:boolean):Float64Array {
 const data=new Float64Array(width*height);const INF=1e12;
 for(let i=0;i<data.length;i++)data[i]=Boolean(mask[i])===inside?0:INF;
 const n=Math.max(width,height),v=new Int32Array(n),bounds=new Float64Array(n+1),f=new Float64Array(n),out=new Float64Array(n);
 function transform(length:number){
  let k=0;v[0]=0;bounds[0]=-Infinity;bounds[1]=Infinity;
  for(let q=1;q<length;q++){
   let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
   while(s<=bounds[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
   k++;v[k]=q;bounds[k]=s;bounds[k+1]=Infinity;
  }
  k=0;for(let q=0;q<length;q++){while(bounds[k+1]<q)k++;out[q]=(q-v[k])**2+f[v[k]];}
 }
 for(let x=0;x<width;x++){for(let y=0;y<height;y++)f[y]=data[y*width+x];transform(height);for(let y=0;y<height;y++)data[y*width+x]=out[y];}
 for(let y=0;y<height;y++){for(let x=0;x<width;x++)f[x]=data[y*width+x];transform(width);for(let x=0;x<width;x++)data[y*width+x]=out[x];}
 return data;
}
export function sdf(alpha:Uint8ClampedArray,width:number,height:number):Float32Array{
 const mask=new Uint8Array(width*height);for(let i=0;i<mask.length;i++)mask[i]=alpha[i*4+3]>=128?1:0;
 const outer=edt(mask,width,height,true),inner=edt(mask,width,height,false),d=new Float32Array(mask.length);
 for(let i=0;i<d.length;i++)d[i]=mask[i]?-(Math.sqrt(inner[i])-.5):Math.sqrt(outer[i])-.5;
 return d;
}
// Marching squares with linearly interpolated zero crossings. Coordinates are SVG units.
export function contours(d:Float32Array,w:number,h:number):string{
 const chunks:string[]=[];const point=(x:number,y:number,a:number,b:number,dx:number,dy:number)=>{const t=a/(a-b);return[x+t*dx,y+t*dy];};
 const segment=(a:number[],b:number[])=>chunks.push(`M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`);
 for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
  const a=d[y*w+x],b=d[y*w+x+1],c=d[(y+1)*w+x+1],e=d[(y+1)*w+x];
  const hits:number[][]=[];
  if((a<0)!==(b<0))hits.push(point(x,y,a,b,1,0));
  if((b<0)!==(c<0))hits.push(point(x+1,y,b,c,0,1));
  if((c<0)!==(e<0))hits.push(point(x+1,y+1,c,e,-1,0));
  if((e<0)!==(a<0))hits.push(point(x,y+1,e,a,0,-1));
  if(hits.length===2)segment(hits[0],hits[1]);
  else if(hits.length===4){if((a<0)===((a+b+c+e)<0)){segment(hits[0],hits[1]);segment(hits[2],hits[3]);}else{segment(hits[0],hits[3]);segment(hits[1],hits[2]);}}
 }
 return chunks.join('');
}
