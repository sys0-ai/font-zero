import {defaults,entryForFont,type FontEntry} from './catalog';
import {constructions} from './construction';
import {blendFieldPath} from './field';
import {sourcePath,groupContours,blendPath,type Point} from './curves';
import {unifiedContours,smoothPath} from './outline-union';
import type {Weights} from './weights';
import {noise} from './variation';
export interface Settings {wght:number;wdth:number;slnt:number;temperature:number;edgeRoughness:number;edgeScale:number;seed:number;smoothing:number;healing:boolean;ligatures:boolean;structured:boolean;support?:number[]}
export function axes(s:Settings,index:number){return {wght:Math.max(200,Math.min(800,s.wght+noise(s.seed,index,1)*65*s.temperature)),wdth:s.wdth,slnt:s.slnt};}
export function prepareOutline(originals:string[],character:string,em=100,center:Point=[0,-25],entries:FontEntry[]=defaults,support?:number[]){
 const shapes=originals.map(unifiedContours),families=constructions(character,shapes,entries);
 const resolve=(weights:Weights)=>{
  const active=families.filter(f=>f.sources.some(i=>weights[i]>1e-12));
  if(active.length!==1)throw new Error(`Cannot blend “${character}”: the fonts have different letter constructions.`);
  return {family:active[0],weights};
 };
 const prepared=families.map(family=>({family,sources:[] as number[],raw:undefined as ReturnType<typeof groupContours>|undefined,structured:undefined as ReturnType<typeof groupContours>|undefined}));
 const groupsFor=(weights:Weights,structured:boolean)=>{
  const {family}=resolve(weights),entry=prepared.find(p=>p.family===family)!,key=structured?'structured':'raw',sources=family.sources.filter(i=>support?support.includes(i):weights[i]>0);
  if(sources.join(',')!==entry.sources.join(',')){entry.sources=sources;entry.raw=entry.structured=undefined;}
  return {sources,groups:entry[key]??=groupContours(sources.map(i=>shapes[i]),structured,character)};
 };
 let lastDraw:{key:string;path:string}|undefined;
 return {originals,resolve,
  draw(weights:Weights,smoothing:number,structured=true){
   const key=weights.join(',')+'/'+smoothing+'/'+structured;if(lastDraw?.key===key)return lastDraw.path;
   resolve(weights);const pole=weights.findIndex(w=>w>1-1e-10);
   if(pole>=0)return originals[pole];
   const aligned=groupsFor(weights,structured),path=smoothPath(blendPath(aligned.groups,()=>aligned.sources.map(i=>weights[i]),structured),smoothing*1.5*(1-Math.max(...weights)),em);
   lastDraw={key,path};return path;
  },
  drawField(field:(x:number,y:number)=>Weights,smoothing:number,structured=true){
   const weights=field(...center),total=weights.map(()=>0);
   for(const x of [-2,0,2])for(const y of [-2,0,2])field(center[0]+x*em,center[1]+y*em).forEach((w,i)=>total[i]+=w);
   const aligned=groupsFor(total,structured),active=total.flatMap((w,i)=>w>1e-12?[i]:[]);
   if(active.length===1)return originals[active[0]];
   const local=(x:number,y:number)=>{const w=field(x,y);resolve(w);return aligned.sources.map(i=>w[i]);};
   return smoothPath(blendFieldPath(aligned.groups,local,em*.0001),smoothing*1.5*(1-Math.max(...weights)),em);
  }
 };
}
function translatePath(path:string,x:number,y:number){return path.replace(/([MLCQZ])([^MLCQZ]*)/g,(_,command:string,body:string)=>command+(body.match(/-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[]).map((v,i)=>(Number(v)+(i%2?y:x)).toFixed(5)).join(','));}
export function translateOutline(shape:ReturnType<typeof prepareOutline>,x:number,y:number):ReturnType<typeof prepareOutline>{return {originals:shape.originals.map(d=>translatePath(d,x,y)),resolve:shape.resolve,draw:(w,s,structured)=>translatePath(shape.draw(w,s,structured),x,y),drawField:(field,s,structured)=>translatePath(shape.drawField((a,b)=>field(a+x,b+y),s,structured),x,y)};}
export function prepareGlyph(glyphs:any[],fonts:any[],character=String.fromCodePoint(glyphs[0].codePoints?.[0]??0),support?:number[]){
 const originals=glyphs.map((g,i)=>sourcePath(g.path.commands,0,0,100/fonts[i].unitsPerEm)),advance=glyphs[0].advanceWidth*100/fonts[0].unitsPerEm;
 return {...prepareOutline(originals,character,100,[advance/2,-25],fonts.map(entryForFont),support),advance,advances:glyphs.map((g,i)=>g.advanceWidth*100/fonts[i].unitsPerEm)};
}
export function features(s:Settings){return {calt:s.healing,liga:s.ligatures,...Object.fromEntries(Array.from({length:10},(_,i)=>['ss'+String(i+1).padStart(2,'0'),s.ligatures]))};}
export function progression(index:number,count:number){const t=count<=1?0:index/(count-1);return t*t*(3-2*t);}
export function mix(a:Weights,b:Weights,t:number):Weights{return a.map((v,i)=>v+(b[i]-v)*t) as Weights;}
export const pause=()=>new Promise<void>(r=>setTimeout(r,0));
