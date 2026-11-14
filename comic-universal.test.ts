import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {differentLetters,compatibleFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import data from './fonts.json';
const bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/Comic Sans MS.ttf').arrayBuffer());
const variant=catalog.findIndex(f=>f.id==='comic-sans-universal'),font=makeTypeface(create(bytes),bytes,catalog[variant]);
test('Comic Sans Universal keeps native endpoints and supplies compatible ordinary forms',async()=>{
 const native=makeTypeface(create(bytes),bytes,catalog[3]);
 for(let cp=33;cp<127;cp++)expect(font.glyphForCodePoint(cp).path.commands).toEqual(native.glyphForCodePoint(cp).path.commands);
 expect(font.alternateProof!().length).toBe(14);
 for(let index=0;index<9;index++){
  expect(differentLetters([variant,index])).toEqual([]);
  const entry=catalog[index],b=entry.file?new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()):Uint8Array.from(atob(data[index].data),c=>c.charCodeAt(0));
  const partner=makeTypeface(create(b),b,entry),adjusted=font.withConstructions(compatibleFormsFor([variant,index]));
  for(const c of 'ag&$0469@BR')expect(prepareGlyph([adjusted,partner].map(f=>f.glyphForCodePoint(c.charCodeAt(0))),[adjusted,partner],c).draw([.5,.5],0,true)).not.toMatch(/NaN|Infinity/);
 }
 expect(differentLetters([variant,catalog.findIndex(f=>f.id==='gf-monoton')]).length).toBeGreaterThan(0);
});
