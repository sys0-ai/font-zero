import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {parse} from 'opentype.js';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {prepareGlyph,type Settings} from './render';
import {sourcePath} from './curves';
import {makeFont} from './export-font';
import {sharedClusters,clusterGlyph} from './shaping';
const local=test.skipIf(process.platform!=='darwin');
async function classic(id:string){const e=catalog.find(f=>f.id===id)!,bytes=new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+e.file).arrayBuffer()),collection:any=create(bytes);return {face:collection.fonts?collection.fonts[e.face??0]:collection,font:makeTypeface(collection,bytes,e)};}
local('all six classic fonts reproduce every printable ASCII endpoint at neutral axes',async()=>{
 for(const e of catalog.filter(f=>f.file)){
  const {face,font}=await classic(e.id);
  for(let cp=32;cp<127;cp++){
   const gs=[font,font,font].map(f=>f.glyphForCodePoint(cp)),g=prepareGlyph(gs,[font,font,font],String.fromCharCode(cp));
   expect(g.draw([1,0,0],.6)).toBe(sourcePath(face.glyphForCodePoint(cp).path.commands,0,0,100/face.unitsPerEm));
   expect(g.advances[0]).toBe(face.glyphForCodePoint(cp).advanceWidth*100/face.unitsPerEm);
  }
  const altered=font.getVariation({wght:650,wdth:115,slnt:-7});
  expect(altered.glyphForCodePoint(97).path.commands).not.toEqual(font.glyphForCodePoint(97).path.commands);
  expect(altered.glyphForCodePoint(97).advanceWidth).toBeCloseTo(font.glyphForCodePoint(97).advanceWidth*1.15,8);
 }
});
local('mixed native ligatures align on shared text spans instead of requiring equal glyph counts',async()=>{
 const fonts=await Promise.all(['times-new-roman','comic-sans','papyrus'].map(async id=>(await classic(id)).font));
 const line='office ffi AV !=',runs=fonts.map(f=>f.shape(line,{liga:true,kern:true})),clusters=sharedClusters(runs,line.length);
 expect(clusters[0].start).toBe(0);expect(clusters.at(-1)!.end).toBe(line.length);
 for(let i=0;i<3;i++){
  const composed=clusters.map(c=>clusterGlyph(runs[i],c.indices[i],fonts[i]));
  expect(composed.reduce((s,g)=>s+g.advanceWidth,0)).toBe(runs[i].positions.reduce((s,p)=>s+p.xAdvance,0));
 }
 const synthetic=sharedClusters([{clusters:[0,1,2,3]},{clusters:[0,3]},{clusters:[0,1,3]}],4);
 expect(synthetic.map(c=>[c.start,c.end])).toEqual([[0,3],[3,4]]);
});
local('classic blend export has proportional advances and retains source licensing',async()=>{
 const fonts=await Promise.all(['times-new-roman','georgia'].map(async id=>(await classic(id)).font));
 const s:Settings={wght:450,wdth:100,slnt:0,temperature:0,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1};
 const result=await makeFont(fonts,[.4,.6],s),font=parse(result.bytes);
 expect(font.glyphs.length).toBe(96);expect(font.names.license.en).not.toContain('SIL OPEN FONT LICENSE');expect(font.names.license.en).toContain('Original source font licenses apply');
 const expected=fonts.reduce((n,f,i)=>n+f.glyphForCodePoint(105).advanceWidth*1000/f.unitsPerEm*[.4,.6][i],0);
 expect(font.charToGlyph('i').advanceWidth).toBe(Math.round(expected));expect(font.charToGlyph('W').advanceWidth).toBeGreaterThan(font.charToGlyph('i').advanceWidth);
},30000);

import {loadFont} from './font-library';
import {pole} from './weights';
local('native constructions reproduce every original ASCII letter with all nine fonts loaded',async()=>{
 const fonts=await Promise.all(catalog.slice(0,9).map(async e=>e.file?(await classic(e.id)).font:loadFont(e.id)));
 for(let cp=32;cp<127;cp++){
  const shape=prepareGlyph(fonts.map(f=>f.glyphForCodePoint(cp)),fonts,String.fromCharCode(cp));
  for(let i=0;i<fonts.length;i++){
   const weights=pole(fonts.length,i);
   expect(shape.resolve(weights).family.sources).toContain(i);
   expect(shape.draw(weights,.6)).toBe(shape.originals[i]);
  }
 }
},30000);
