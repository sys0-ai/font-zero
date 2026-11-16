import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import paper from 'paper';
import {catalog} from './catalog';
import {makeTypeface} from './font-library';
import {prepareGlyph} from './render';
import {sourcePath,groupContours,blendPath} from './curves';
import {compileUniformCurves} from './uniform-curves';
import {unifiedContours,measureGeometry} from './outline-union';
import {prepareDesignGlyph} from './attractor-font-design';
const fonts=await Promise.all(['times-new-roman','gf-opensans','comic-sans-universal','papyrus-alternates'].map(async id=>{
 const entry=catalog.find(f=>f.id===id)!,bytes=new Uint8Array(await Bun.file(entry.file?'/System/Library/Fonts/Supplemental/'+entry.file:import.meta.dir+'/../fonts/'+entry.asset).arrayBuffer());
 return makeTypeface(create(bytes),bytes,entry);
}));
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
function stemWidths(d:string){
 const path=new scope.CompoundPath({pathData:d,insert:false}),widths:number[]=[];
 for(let y=-32;y<=-18;y++){
  const ray=new scope.Path.Line({from:[-50,y],to:[100,y],insert:false});
  const xs=path.getIntersections(ray).map(p=>p.point.x).sort((a,b)=>a-b);
  expect(xs.length,`stem at y=${y}`).toBe(2);widths.push(xs[1]-xs[0]);ray.remove();
 }
 path.remove();return widths;
}
function assertStem(d:string){
 const widths=stemWidths(d);
 expect(Math.max(...widths)).toBeLessThan(12);
 expect(Math.min(...widths)).toBeGreaterThan(3);
 expect(measureGeometry(d).crossings).toBe(0);
}
test('f crossbars do not swell into stems across serif, sans, handwriting and Papyrus masters',()=>{
 for(let a=0;a<fonts.length;a++)for(let b=a+1;b<fonts.length;b++)for(const fs of [[fonts[a],fonts[b]],[fonts[b],fonts[a]]]){
  const glyphs=fs.map(f=>f.glyphForCodePoint(102)),shape=prepareGlyph(glyphs,fs,'f');
  for(const t of [.25,.5,.75])assertStem(shape.draw([1-t,t],0,true));
  for(const pole of [0,1])expect(shape.draw(pole?[0,1]:[1,0],0,true)).toBe(sourcePath(glyphs[pole].path.commands,0,0,100/fs[pole].unitsPerEm));
 }
 const shape=prepareGlyph(fonts.map(f=>f.glyphForCodePoint(102)),fonts,'f');
 assertStem(shape.draw([.25,.25,.25,.25],0,true));
 const groups=groupContours(shape.originals.map(unifiedContours),true,'f');
 const compiled=compileUniformCurves(groups,true).contours([.25,.25,.25,.25]);
 assertStem(blendPath(compiled.map(c=>[c]),()=>[1]));
});
test('four static corner attractors preserve a narrow f stem in the exported design geometry',()=>{
 const frame={width:600,height:600,size:650},poles=fonts.map((_,i)=>({source:i,x:i%2?500:65,y:i<2?60:540,radius:600,decay:2}));
 const result=prepareDesignGlyph(fonts,'f')(poles,frame);
 assertStem(result.d);
});
test('t crossbars remain connected in the same four-font family',()=>{
 const shape=prepareGlyph(fonts.map(f=>f.glyphForCodePoint(116)),fonts,'t');
 for(const weights of [[.25,.25,.25,.25],[.5,0,0,.5],[0,.5,.5,0]]){
  const d=shape.draw(weights,0,true);expect(measureGeometry(d).crossings).toBe(0);expect(unifiedContours(d).length).toBe(1);
 }
});
