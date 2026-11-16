import {test,expect} from 'bun:test';
import {create} from 'fontkit';
import data from './fonts.json';
import {prepareGlyph,prepareOutline,translateOutline} from './render';
import {groupContours,readContours} from './curves';
import {measureGeometry} from './outline-union';
import type {Weights} from './weights';
import {protectCounters} from './counter-guard';
const rect=(x:number,y:number,w:number,h:number,hole=false)=>readContours([{command:'moveTo',args:[x,y]},{command:'lineTo',args:[x+(hole?0:w),y+(hole?h:0)]},{command:'lineTo',args:[x+w,y+h]},{command:'lineTo',args:[x+(hole?w:0),y+(hole?0:h)]},{command:'closePath',args:[]}])[0];
const centerY=(c:any[])=>c.reduce((sum,s)=>sum+s[0][1],0)/c.length;
test('global assignment keeps an upper counter paired with the upper counter',()=>{
 const body=rect(0,0,60,90),upper=rect(15,5,20,20,true),lower=rect(10,55,35,20,true);
 const groups=groupContours([[body,upper],[body,lower,upper]],false);
 const matched=groups.find(g=>Math.abs(centerY(g[1])+15)<1);
 expect(matched).toBeDefined();expect(centerY(matched![0])).toBeCloseTo(-15,1);
});
test('an escaping counter is contracted into its surrounding outline',()=>{
 const outer=rect(0,0,60,60),hole=rect(45,20,30,20,true),corrected=protectCounters([outer,hole]);
 for(const c of corrected[1])for(const p of c){expect(p[0]).toBeGreaterThan(0);expect(p[0]).toBeLessThan(60);expect(p[1]).toBeLessThan(0);expect(p[1]).toBeGreaterThan(-60);}
});


const fonts=data.map(f=>create(Buffer.from(f.data,'base64')));
test('different a constructions are rejected instead of substituted',()=>{
 const fs=fonts.map(f=>f.getVariation({wght:450,wdth:100,slnt:0})),shape=prepareGlyph(fs.map(f=>f.glyphForCodePoint(97)),fs,'a');
 expect(()=>shape.draw([.5,0,.5],.6)).toThrow('different letter constructions');
 expect(()=>shape.drawField(x=>x<30?[1,0,0]:[0,0,1],.6)).toThrow('different letter constructions');
 for(let i=0;i<3;i++)expect(shape.draw([0,1,2].map(j=>i===j?1:0),.6)).toBe(shape.originals[i]);
});
