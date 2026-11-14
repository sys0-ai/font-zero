import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import {parse} from 'opentype.js';
import data from './fonts.json';
import {smoothPath,pathCurves} from './outline-union';
import {axes,prepareGlyph,type Settings} from './render';
import {makeFont} from './export-font';
const fonts=data.map(f=>create(Buffer.from(f.data,'base64')));
const settings:Settings={wght:450,wdth:100,slnt:0,temperature:.36,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1};
const weights:[number,number,number]=[.01,.49,.5];
test('tiny contours smooth with wrapped samples and stay nonempty',()=>{
 for(const size of [.03,.1,.3,1]){
  const d=smoothPath(`M0,0L${size},0L${size},${size}L0,${size}Z`,1);
  expect(d).not.toMatch(/NaN|Infinity/);const contours=pathCurves(d);expect(contours.length).toBe(1);expect(contours[0].length).toBeGreaterThan(0);
  expect(contours[0][0][0]).toEqual(contours[0].at(-1)![3]);
 }
});
test('36 percent ampersand blend no longer reads past a contour',()=>{
 const fs=fonts.map(f=>f.getVariation(axes(settings,38-32))),glyph=prepareGlyph(fs.map(f=>f.glyphForCodePoint(38)),fs);
 for(const structured of [true,false])for(const smoothing of [.6,1]){
  const d=glyph.draw(weights,smoothing,structured);expect(d).not.toMatch(/NaN|Infinity/);expect(pathCurves(d).length).toBeGreaterThan(0);
 }
});
test('the failing mixed point exports all printable ASCII at 36 percent temperature',async()=>{
 const {bytes}=await makeFont(fonts,weights,settings),font=parse(bytes);
 expect(font.glyphs.length).toBe(96);
 for(let c=33;c<127;c++){const g=font.charToGlyph(String.fromCharCode(c));expect(g.index).toBeGreaterThan(0);expect(g.path.commands.length).toBeGreaterThan(0);}
},30000);
