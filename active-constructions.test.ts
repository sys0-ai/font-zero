import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {catalog} from './catalog';
import {loadFont,makeTypeface} from './font-library';
import {prepareGlyph} from './render';
import {measureGeometry} from './outline-union';

test.skipIf(process.platform!=='darwin')('zero-percent fonts cannot change native a blends, including spatial curves',async()=>{
 const fonts=await Promise.all(catalog.map(async e=>{
  if(!e.file&&!e.asset)return loadFont(e.id);
  const bytes=new Uint8Array(await Bun.file(e.asset?import.meta.dir+'/font-assets/'+e.asset:'/System/Library/Fonts/Supplemental/'+e.file).arrayBuffer());return makeTypeface(create(bytes),bytes,e);
 }));
 const shapes=[9,109].map(n=>{const fs=fonts.slice(0,n);return prepareGlyph(fs.map(f=>f.glyphForCodePoint(97)),fs,'a');});
 for(const t of [.1,.4,.5,.8,1]){
  const w=Array(109).fill(0);w[5]=1-t;w[7]=t;
  expect(shapes[1].draw(w,.6)).toBe(shapes[0].draw(w.slice(0,9),.6));
 }
 const field=(n:number)=>(x:number)=>{const w=Array(n).fill(0),t=Math.max(.2,Math.min(.8,x/80));w[5]=1-t;w[7]=t;return w;};
 expect(shapes[1].drawField(field(109),.6)).toBe(shapes[0].drawField(field(9),.6));
},30000);
