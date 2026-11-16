import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {prepareGlyph} from './render';
import {measureGeometry,unifiedContours} from './outline-union';
import {sourcePath} from './curves';
const fonts=await Promise.all([5,109,7].map(async i=>{
 const entry=catalog[i],bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer());
 return makeTypeface(create(bytes),bytes,entry);
}));
test('Times/Papyrus y keeps its fork connected throughout the blend in either font order',()=>{
 for(const fs of [fonts.slice(0,2),fonts.slice(0,2).reverse()]){
  const glyphs=fs.map(f=>f.glyphForCodePoint(121)),shape=prepareGlyph(glyphs,fs,'y');
  for(const smoothing of [0,.6,1])for(let step=0;step<=100;step++){
   const d=shape.draw([1-step/100,step/100],smoothing);
   expect(measureGeometry(d).crossings,`step ${step}, smoothing ${smoothing}`).toBe(0);
   expect(unifiedContours(d).length).toBe(1);
  }
  for(let pole=0;pole<2;pole++)expect(shape.draw(pole?[0,1]:[1,0],.6)).toBe(sourcePath(glyphs[pole].path.commands,0,0,100/fs[pole].unitsPerEm));
 }
});
test('y landmarks also keep the default Times/Georgia blend connected',()=>{
 const fs=[fonts[0],fonts[2]],shape=prepareGlyph(fs.map(f=>f.glyphForCodePoint(121)),fs,'y');
 for(let step=0;step<=20;step++)expect(measureGeometry(shape.draw([1-step/20,step/20],.6)).crossings).toBe(0);
});
