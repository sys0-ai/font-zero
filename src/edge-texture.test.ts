import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import data from './fonts.json';
import {sourcePath} from './curves';
import {edgeField,texturePath} from './edge-texture';
import {measureGeometry} from './outline-union';
import {makeFont} from './export-font';
import {makeTypeface} from './font-library';
import {catalog} from './catalog';
const bytes=Uint8Array.from(atob(data[0].data),c=>c.charCodeAt(0)),font=makeTypeface(create(bytes),bytes,catalog[0]);
const a=sourcePath(font.glyphForCodePoint(97).path.commands,0,0,100/font.unitsPerEm);
test('edge texture is deterministic, preserves the off state, and keeps counters and closed curves',()=>{
 expect(texturePath(a,0,1,12)).toBe(a);
 const rough=texturePath(a,100,1,12);expect(rough).not.toBe(a);expect(texturePath(a,100,1,12)).toBe(rough);expect(texturePath(a,100,1,13)).not.toBe(rough);
 expect(rough).not.toMatch(/NaN|Infinity/);expect(measureGeometry(rough).counters).toBe(measureGeometry(a).counters);
 expect(measureGeometry(rough).crossings).toBe(measureGeometry(a).crossings);
 expect((rough.match(/Z/g)||[]).length).toBe((a.match(/Z/g)||[]).length);
});
test('composed texture shears preserve orientation and area locally at maximum strength',()=>{
 const field=edgeField(100,.5,4);
 for(let x=-10;x<100;x+=3)for(let y=-100;y<20;y+=5){const {jacobian:j}=field([x,y]);expect(j[0]*j[3]-j[1]*j[2]).toBeCloseTo(1,8);}
});
test('edge texture survives OTF export as changed outlines, with unchanged advances',async()=>{
 const settings={wght:450,wdth:100,slnt:0,temperature:0,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true,edgeRoughness:0,edgeScale:1};
 const clean:any=create(new Uint8Array((await makeFont([font],[1],settings)).bytes));
 const rough:any=create(new Uint8Array((await makeFont([font],[1],{...settings,edgeRoughness:80})).bytes));
 for(const c of 'aBg0'){const a=clean.glyphForCodePoint(c.charCodeAt(0)),b=rough.glyphForCodePoint(c.charCodeAt(0));expect(b.advanceWidth).toBe(a.advanceWidth);expect(b.path.commands).not.toEqual(a.path.commands);}
});
