import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {differentLetters,compatibleFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import data from './fonts.json';
const bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/Times New Roman.ttf').arrayBuffer());
const variant=catalog.findIndex(f=>f.id==='times-universal'),font=makeTypeface(create(bytes),bytes,catalog[variant]);
test('Times alternate forms preserve native glyphs and provide honest supported constructions',async()=>{
 const native=makeTypeface(create(bytes),bytes,catalog[5]);
 for(let cp=33;cp<127;cp++)expect(font.glyphForCodePoint(cp).path.commands).toEqual(native.glyphForCodePoint(cp).path.commands);
 expect(font.alternateProof!().length).toBe(6);
 for(const id of ['krypton','arial','times-new-roman','georgia']){
  const index=catalog.findIndex(f=>f.id===id);expect(differentLetters([variant,index])).toEqual([]);
  const entry=catalog[index],b=entry.file?new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()):Uint8Array.from(atob(data[index].data),c=>c.charCodeAt(0));
  const partner=makeTypeface(create(b),b,entry),adjusted=font.withConstructions(compatibleFormsFor([variant,index]));
  for(const c of 'ag$04'){
   const glyph=prepareGlyph([adjusted,partner].map(f=>f.glyphForCodePoint(c.charCodeAt(0))),[adjusted,partner],c);
   for(const t of [0,.25,.5,.75,1])expect(glyph.draw([1-t,t],0,true)).not.toMatch(/NaN|Infinity/);
  }
 }
 const radon=catalog.findIndex(f=>f.id==='radon');expect(differentLetters([variant,radon])).toEqual(['&','B','R']);
 const comic=catalog.findIndex(f=>f.id==='comic-sans');expect(differentLetters([variant,comic])).toEqual(['@']);
});
