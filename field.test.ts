import {test,expect} from 'bun:test';
import {at,type Contour} from './curves';
import {blendFieldPath,flowWeights,flowProgress} from './field';
import {pathCurves} from './outline-union';
import {create} from 'fontkit';
import data from './fonts.json';
import {prepareGlyph} from './render';
test('field blend samples the continuous curve function rather than whole-letter weights',()=>{
 const a:Contour=[[[0,0],[100/3,0],[200/3,0],[100,0]]],b:Contour=[[[0,40],[100/3,40],[200/3,40],[100,40]]];
 const path=blendFieldPath([[a,b]],x=>{const t=flowProgress(x,100);return [1-t,t,0];});
 const c=pathCurves(path)[0][0];
 for(const t of [0,.25,.5,.75,1]){const p=at(c,t);expect(p[0]).toBeCloseTo(t*100,3);expect(p[1]).toBeCloseTo(40*flowProgress(t,1),3);}
});
test('reading coordinates continue through a line/page boundary and stay in the simplex',()=>{
 const start:[number,number,number]=[.2,.7,.1],end:[number,number,number]=[.1,.1,.8];
 expect(flowWeights(start,end,0,100)).toEqual(start);expect(flowWeights(start,end,100,100)).toEqual(end);
 const previousLineEnd=flowWeights(start,end,40,100),nextLineStart=flowWeights(start,end,40+0,100);expect(nextLineStart).toEqual(previousLineEnd);expect(nextLineStart).not.toEqual(start);
 for(let x=-10;x<111;x++){const weights=flowWeights(start,end,x,100);expect(weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);expect(weights.every(w=>w>=0&&w<=1)).toBe(true);}
});
test('single-glyph field changes its actual contour and remains finite and closed',()=>{
 const fs=data.map(f=>create(Buffer.from(f.data,'base64')).getVariation({wght:450,wdth:100,slnt:0}));
 const glyph=prepareGlyph(fs.map(f=>f.glyphForCodePoint(97)),fs);
 const d=glyph.drawField(x=>flowWeights([1,0,0],[0,0,1],x,glyph.advance),.6,true);
 expect(d).not.toBe(glyph.draw([.5,0,.5],.6,true));expect(d).not.toMatch(/NaN|Infinity/);
 for(const c of pathCurves(d))expect(c[0][0]).toEqual(c.at(-1)![3]);
});
