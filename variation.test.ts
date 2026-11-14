import {test,expect} from 'bun:test';
import {curveField,varyPath} from './variation';
import {pathCurves,measureGeometry} from './outline-union';
import {makeFont} from './export-font';
import {create} from 'fontkit';
import {parse} from 'opentype.js';
import data from './fonts.json';
const ring='M0,0L50,0L50,60L0,60Z M10,10L10,50L40,50L40,10Z';
test('temperature changes internal geometry, keeps orientation anchors fixed, and is deterministic',()=>{
 expect(varyPath(ring,0,12,0)).toBe(ring);
 const a=varyPath(ring,1,12,0);expect(a).toBe(varyPath(ring,1,12,0));expect(a).not.toBe(varyPath(ring,1,12,1));expect(a).not.toBe(varyPath(ring,1,13,0));
 const f=curveField({left:0,top:0,width:50,height:60},1,12,0);
 for(const p of [[0,0],[50,0],[0,60],[50,60]] as [number,number][]){const q=f(p).point;expect(q[0]).toBeCloseTo(p[0],8);expect(q[1]).toBeCloseTo(p[1],8);}
 const p:[number,number]=[10,20],q=f(p).point;expect(Math.hypot(q[0]-p[0],q[1]-p[1])).toBeGreaterThan(.5);
 expect(Math.hypot(...q)).not.toBeCloseTo(Math.hypot(...p),2);
});
test('smooth displacement preserves counters and introduces no crossings on a valid outline',()=>{
 for(let i=0;i<16;i++){
  const d=varyPath(ring,1,12,i),m=measureGeometry(d);expect(m.counters).toBe(1);expect(m.crossings).toBe(0);
  for(const c of pathCurves(d)){expect(c[0][0]).toEqual(c.at(-1)![3]);for(const curve of c)for(const p of curve)expect(p.every(Number.isFinite)).toBe(true);}
 }
});
test('field derivatives remain bounded and match finite differences',()=>{
 const f=curveField({left:0,top:0,width:50,height:60},1,12,3);
 for(let x=0;x<=50;x+=5)for(let y=0;y<=60;y+=5){
  const {point,jacobian:j}=f([x,y]),dx=f([x+.0001,y]).point,dy=f([x,y+.0001]).point;
  expect(Math.hypot(j[0]-1,j[1],j[2],j[3]-1)).toBeLessThanOrEqual(.650001);
  expect(j[0]*j[3]-j[1]*j[2]).toBeGreaterThan(0);
  expect((dx[0]-point[0])/.0001).toBeCloseTo(j[0],4);expect((dy[1]-point[1])/.0001).toBeCloseTo(j[3],4);
 }
});
test('maximum-temperature export contains deformed curves with normal advances',async()=>{
 const fonts=data.map(f=>create(Buffer.from(f.data,'base64')));
 const output=await makeFont(fonts,[0,1,0],{wght:450,wdth:100,slnt:0,temperature:1,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1});
 const font=parse(output.bytes);expect(font.glyphs.length).toBe(96);
 for(const c of 'aemnox'){
  const g=font.charToGlyph(c);expect(g.path.commands.some(c=>c.type==='C')).toBe(true);
  expect(g.advanceWidth).toBe(Math.round(fonts[1].glyphForCodePoint(c.charCodeAt(0)).advanceWidth*1000/fonts[1].unitsPerEm));
 }
},30000);
