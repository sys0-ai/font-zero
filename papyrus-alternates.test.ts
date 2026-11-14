import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import data from './fonts.json';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {differentLetters,papyrusFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import {sourcePath} from './curves';
import {makeFont} from './export-font';
const bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/Papyrus.ttc').arrayBuffer());
const variant=catalog.findIndex(f=>f.variant);
const papyrus=makeTypeface(create(bytes),bytes,catalog[variant]);
test('drawn Papyrus alternates match all original nine construction profiles without replacing the original family',async()=>{
 expect(papyrus.alternateProof!().length).toBe(14);
 for(let index=0;index<9;index++){
  expect(differentLetters([variant,index])).toEqual([]);
  const entry=catalog[index],b=entry.file?new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()):Uint8Array.from(atob(data[index].data),c=>c.charCodeAt(0));
  const native=makeTypeface(create(b),b,entry),alternate=papyrus.withConstructions(papyrusFormsFor([variant,index]));
  for(let cp=32;cp<127;cp++){
   const gs=[alternate,native].map(f=>f.glyphForCodePoint(cp)),shape=prepareGlyph(gs,[alternate,native],String.fromCharCode(cp));
   expect(shape.draw([.5,.5],.6)).not.toMatch(/NaN|Infinity/);
   expect(shape.draw([1,0],.6)).toBe(sourcePath(gs[0].path.commands,0,0,100/alternate.unitsPerEm));
  }
 }
 const original=makeTypeface(create(bytes),bytes,catalog[4]);
 for(let cp=32;cp<127;cp++)expect(papyrus.glyphForCodePoint(cp).path.commands).toEqual(original.glyphForCodePoint(cp).path.commands);
 expect(differentLetters([variant,catalog.findIndex(f=>f.id==='gf-monoton')]).length).toBeGreaterThan(0);
});
test('Papyrus alternates export as an ASCII font',async()=>{
 const f=papyrus.withConstructions(papyrusFormsFor([variant,5]));
 const result=await makeFont([f],[1],{wght:450,wdth:100,slnt:0,temperature:0,seed:1,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1});
 const exported:any=create(new Uint8Array(result.bytes));
 expect(exported.numGlyphs).toBe(96);expect(result.filename).toEndWith('.otf');
 for(const c of 'ag&69')expect(exported.glyphForCodePoint(c.charCodeAt(0)).path.commands.length).toBeGreaterThan(10);
});
