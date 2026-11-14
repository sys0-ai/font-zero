import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import extra from './extra-fonts.json';
import manifest from './font-import.json';
import {makeTypeface} from './font-library';
import {sourcePath} from './curves';
test('100 pinned distinct font families load deterministically with finite ASCII outlines and licenses',async()=>{
 expect(extra.length).toBe(100);expect(new Set(extra.map(e=>e.name)).size).toBe(100);
 for(const e of extra){
  const file=Bun.file(import.meta.dir+'/font-assets/'+e.asset),bytes=new Uint8Array(await file.arrayBuffer());
  expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(e.sha256);
  expect((await Bun.file(import.meta.dir+'/font-assets/'+e.licenseAsset).text())).toContain('SIL OPEN FONT LICENSE');
  const raw:any=create(bytes),font=makeTypeface(raw,bytes,e);
  for(const values of [{wght:450,wdth:100,slnt:0},{wght:750,wdth:120,slnt:-8}]){
   const instance=font.getVariation(values);
   for(const char of ['a','g','M','&',' ']){const glyph=instance.glyphForCodePoint(char.charCodeAt(0));expect(glyph.advanceWidth).toBeGreaterThan(0);expect(sourcePath(glyph.path.commands)).not.toMatch(/NaN|Infinity/);}
  }
 }
 expect(manifest.revision).toHaveLength(40);
},30000);
