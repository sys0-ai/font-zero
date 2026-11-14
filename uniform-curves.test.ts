import {test,expect} from 'bun:test';
import {groupContours,blendPath} from './curves';
import {compileUniformCurves} from './uniform-curves';
import {makeTypeface} from './font-library';
import {catalog} from './catalog';
import {create} from 'fontkit';
import {sourcePath} from './curves';
import {unifiedContours} from './outline-union';
test('compiled canvas curves match the existing structured SVG geometry',async()=>{
 const fonts=await Promise.all(['gf-inter','gf-raleway','gf-librebaskerville','gf-zillaslab'].map(async id=>{const entry=catalog.find(f=>f.id===id)!,bytes=new Uint8Array(await Bun.file(import.meta.dir+'/font-assets/'+entry.asset).arrayBuffer());return makeTypeface(create(bytes),bytes,entry);}));
 for(const character of ['a','g','e','y','B']){
  const originals=fonts.map(f=>sourcePath(f.glyphForCodePoint(character.codePointAt(0)!).path.commands,0,0,100/f.unitsPerEm));
  const groups=groupContours(originals.map(unifiedContours),true,character),compiled=compileUniformCurves(groups,true);
  for(const weights of [[.25,.25,.25,.25],[.1,.2,.3,.4],[.7,.1,.15,.05]]){
   const contours=compiled.contours(weights),fmt=(p:number[])=>`${p[0].toFixed(5)},${p[1].toFixed(5)}`;
   const path=contours.map(c=>'M'+fmt(c[0][0])+c.map(s=>'C'+fmt(s[1])+' '+fmt(s[2])+' '+fmt(s[3])).join('')+'Z').join('');
   expect(path).toBe(blendPath(groups,()=>weights,true));
  }
 }
});
