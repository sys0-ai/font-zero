import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {compatibleFormsFor,differentLetters} from './compatibility';
import {largestCompatibleSet} from './attractor-fonts';
import {prepareGlyph} from './render';
const bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/Arial.ttf').arrayBuffer());
const variant=catalog.findIndex(f=>f.id==='arial-alternates'),source=catalog[variant],font=makeTypeface(create(bytes),bytes,source);
test('Arial compatible g changes only the requested construction and blends through the cohort',async()=>{
 const native=makeTypeface(create(bytes),bytes,catalog.find(f=>f.id==='arial')!);
 const group=largestCompatibleSet(catalog.flatMap((f,i)=>(f.asset||f.file)?[i]:[]));
 expect(group).toContain(variant);expect(differentLetters(group)).toEqual([]);
 const adapted=font.withConstructions(compatibleFormsFor(group));
 for(let cp=33;cp<127;cp++){
  expect(font.glyphForCodePoint(cp).path.commands).toEqual(native.glyphForCodePoint(cp).path.commands);
  if(cp!==103)expect(adapted.glyphForCodePoint(cp).path.commands).toEqual(native.glyphForCodePoint(cp).path.commands);
 }
 expect(adapted.glyphForCodePoint(103).path.commands).not.toEqual(native.glyphForCodePoint(103).path.commands);
 expect(font.alternateProof!().length).toBe(1);
 for(const index of group.filter(i=>i!==variant)){
  const entry=catalog[index],b=new Uint8Array(await Bun.file(entry.asset?import.meta.dir+'/font-assets/'+entry.asset:'/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer());
  const partner=makeTypeface(create(b),b,entry).withConstructions(compatibleFormsFor(group));
  const glyph=prepareGlyph([adapted,partner].map(f=>f.glyphForCodePoint(103)),[adapted,partner],'g');
  for(const t of [0,.25,.5,.75,1])expect(glyph.draw([1-t,t],0,true)).not.toMatch(/NaN|Infinity/);
 }
 expect(differentLetters([variant,catalog.findIndex(f=>f.id==='radon')])).toContain('a');
});
