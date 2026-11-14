import {noise} from './variation';
import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {parse} from 'opentype.js';
import * as hb from 'harfbuzzjs';
import data from './fonts.json';
import {axes,prepareGlyph,progression,mix,type Settings} from './render';
import {makeFont} from './export-font';
import {smoothPath,pathCurves} from './outline-union';
const s:Settings={wght:450,wdth:100,slnt:0,temperature:0,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1};
const fonts=data.map(f=>create(Buffer.from(f.data,'base64')));
test('smoothing leaves source vertices exact and emits closed finite cubics inside',()=>{
 const shape=prepareGlyph(fonts.map(f=>f.getVariation(axes(s,0)).glyphForCodePoint(109)),fonts);
 for(let i=0;i<3;i++)expect(shape.draw([0,1,2].map(j=>i===j?1:0) as any,1)).toBe(shape.originals[i]);
 const raw=shape.draw([1/3,1/3,1/3],0),smooth=shape.draw([1/3,1/3,1/3],1);
 expect(smooth).not.toBe(raw);expect(smooth).not.toMatch(/NaN|Infinity/);
 for(const c of pathCurves(smooth))expect(c[0][0]).toEqual(c.at(-1)![3]);
 expect(smoothPath(raw,0)).toBe(raw);
});
test('temperature adds modest pressure while preserving width and slant',()=>{
 expect(axes(s,5)).toEqual({wght:450,wdth:100,slnt:0});
 const hot=Array.from({length:100},(_,i)=>axes({...s,temperature:1},i));
 expect(Math.max(...hot.map(a=>a.wght))-Math.min(...hot.map(a=>a.wght))).toBeGreaterThan(100);
 expect(hot.every(a=>a.wdth===s.wdth&&a.slnt===s.slnt)).toBe(true);
 expect(noise(12,3,2)).toBe(noise(12,3,2));
 expect(mix([.2,.3,.5],[.5,.5,0],progression(0,100))).toEqual([.2,.3,.5]);
 expect(mix([.2,.3,.5],[.5,.5,0],progression(99,100))).toEqual([.5,.5,0]);
});
test('shaping toggles change the actual source glyph sequence',()=>{
 for(const f of data){
  const font=new hb.Font(new hb.Face(new hb.Blob(Uint8Array.from(Buffer.from(f.data,'base64')).buffer)));
  const shape=(features:hb.Feature[])=>{const b=new hb.Buffer();b.addText('mi www !== => <=');b.guessSegmentProperties();hb.shape(font,b,features);return b.getGlyphInfos().map(g=>g.codepoint);};
  expect(shape([new hb.Feature('calt',1),new hb.Feature('ss01',1),new hb.Feature('ss03',1)])).not.toEqual(shape([new hb.Feature('calt',0),new hb.Feature('ss01',0),new hb.Feature('ss03',0)]));
 }
});
test('export round-trips as an installable ASCII OTF with license',async()=>{
 const output=await makeFont(fonts,[1,0,0],s);const parsed=parse(output.bytes);
 expect(parsed.glyphs.length).toBe(96);expect(parsed.names.fontFamily.en).toStartWith('Type Space');expect(parsed.names.license.en).toContain('SIL OPEN FONT LICENSE');
 for(let c=32;c<127;c++){const glyph=parsed.charToGlyph(String.fromCharCode(c));expect(glyph.index).toBeGreaterThan(0);expect(glyph.advanceWidth).toBeGreaterThan(0);for(const cmd of glyph.path.commands)for(const v of Object.values(cmd))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);}
},30000);
