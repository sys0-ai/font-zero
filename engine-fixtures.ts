// Dump geometry fixtures for the Rust engine's unit tests from the TS
// implementation: groupContours and compiled uniform/field contours for a few
// characters and font sets, over the outlines stored in engine/glyphs.bin.
import {join} from 'node:path';
import {catalog} from './catalog';
import {compatibleFormsFor,variantBase} from './compatibility';
import signatures from './construction-signatures.json';
import {groupContours,type Contour} from './curves';
import {compileUniformCurves} from './uniform-curves';
import {attractionWeights,type Pole} from './attractor-math';
import {passageLayout} from './passage-layout';

const bytes=new Uint8Array(await Bun.file(join(import.meta.dir,'engine/glyphs.bin')).arrayBuffer());
const view=new DataView(bytes.buffer);let at=0;
const u8=()=>bytes[at++],u16=()=>{const v=view.getUint16(at,true);at+=2;return v;},u32=()=>{const v=view.getUint32(at,true);at+=4;return v;},f32=()=>{const v=view.getFloat32(at,true);at+=4;return v;};
at=4;u32();const strings:string[]=[];for(let n=u32();n--;){const len=u16();strings.push(new TextDecoder().decode(bytes.subarray(at,at+len)));at+=len;}
type Glyph={advance:number;forms:Map<string,Contour[]>};
const fonts=new Map<string,{notdef:number;glyphs:Map<number,Glyph>}>();
for(let n=u16();n--;){
 const id=strings[u16()];u8();u8();u16();u16();const notdef=f32();
 for(let k=u16();k--;)u16();
 for(let k=u16();k--;){u8();for(let m=u16();m--;)u16();}
 const glyphs=new Map<number,Glyph>();
 for(let g=u32();g--;){
  const cp=u32(),advance=f32(),forms=new Map<string,Contour[]>();
  for(let f=u8();f--;){
   const key=u16();u32();const contours:Contour[]=[];
   const varint=()=>{let z=0,m=1,b;do{b=u8();z+=(b&127)*m;m*=128;}while(b>=128);return z%2?-(z+1)/2:z/2;};
   for(let c=u16();c--;){
    const segs=u16(),n=1+segs*3,axes=[0,1].map(()=>{let q=0;return Array.from({length:n},()=>(q+=varint())/128);});
    const p=(i:number):[number,number]=>[axes[0][i],axes[1][i]],contour:Contour=[];
    for(let s=0;s<segs;s++)contour.push([p(s*3),p(s*3+1),p(s*3+2),p(s*3+3)]);
    contours.push(contour);
   }
   forms.set(key===0xffff?'':strings[key],contours);
  }
  glyphs.set(cp,{advance,forms});
 }
 fonts.set(id,{notdef,glyphs});
}
if(at!==bytes.length)throw Error('glyphs.bin parse mismatch');

function shapes(ids:string[],character:string){
 const indices=ids.map(id=>catalog.findIndex(f=>f.id===id)),forms=compatibleFormsFor(indices,character),cp=character.codePointAt(0)!;
 return ids.map((id,i)=>{
  const entry=catalog[indices[i]],native=(signatures as Record<string,string[]>)[variantBase(entry)];
  const key=entry.variant&&cp>=33&&cp<=126&&forms[cp-33]!==native[cp-33]?forms[cp-33]:'';
  const g=fonts.get(id)!.glyphs.get(cp)!;return g.forms.get(key)??g.forms.get('')!;
 });
}
const sets=[['times-new-roman','gf-opensans','comic-sans-universal','papyrus-alternates'],['gf-inter','gf-fraunces','gf-unbounded'],['georgia','gf-notoserif'],['radon','papyrus-alternates','comic-sans-universal'],['krypton','times-universal'],['times-universal','arial-alternates','georgia']];
const chars=['A','a','g','y','f','t','0','&','R'];
const cases=[];
for(const ids of sets)for(const c of chars){
 let input;try{input=shapes(ids,c);}catch{continue;}
 const groups=groupContours(input,true,c),compiled=compileUniformCurves(groups,true);
 const weights=ids.map((_,i)=>(i+1)/(ids.length*(ids.length+1)/2));
 const poles:Pole[]=ids.map((_,i)=>({source:i,x:10+i*37,y:-60+i*21,radius:45+i*10,decay:1+i*.5}));
 const field=(x:number,y:number)=>attractionWeights(poles,ids.length,x,y);
 cases.push({fonts:ids,character:c,input,groups:ids===sets[0]&&'Ayf'.includes(c)?groups:undefined,uniform:compiled.contours(weights),field:compiled.contours(weights,field),weights,poles});
}
// Passage layout over synthetic metrics.
const text='Call me Ishmael. Some years ago—never mind how long precisely—having little\nor no money in my purse.';
const metric=(c:string)=>c.trim()?40+(c.codePointAt(0)!%17)*2:25;
const layout=passageLayout(text,28,1.3,48,580,true,{reference:metric,advance:c=>metric(c)*.97+1,ink:c=>c.trim()?{left:-1-(c.codePointAt(0)!%3),right:metric(c)+(c.codePointAt(0)!%5),top:-70-(c.codePointAt(0)!%7),bottom:5+(c.codePointAt(0)!%11)}:undefined});
const formSets=[...sets,['argon','neon'],['radon','times-new-roman'],['papyrus-alternates','comic-sans-universal'],['comic-sans-universal','papyrus-alternates','krypton'],['arial-alternates'],['gf-inter','gf-monoton','gf-fraunces'],['gf-pressstart2p','times-new-roman','gf-bodonimoda']];
const texts=[undefined,'Call me Ishmael.','Agfy&0','R'];
const forms=formSets.flatMap(ids=>texts.map(chars=>{try{return {fonts:ids,chars,forms:compatibleFormsFor(ids.map(id=>catalog.findIndex(f=>f.id===id)),chars)};}catch(e){return {fonts:ids,chars,error:(e as Error).message};}}));
await Bun.write(join(import.meta.dir,'engine/tests/fixtures/geometry.json'),JSON.stringify({cases,forms,layout:{text,result:layout}},(_,v)=>typeof v==='number'?Number(v.toPrecision(9)):v));
console.log(cases.length+' geometry cases');
