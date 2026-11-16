import {test,expect} from 'bun:test';
import {edt,weights,anchors,semanticAxes,project,moveAlong} from './math';
test('distance transform agrees with a brute force reference',()=>{
 const w=7,h=5,mask=Uint8Array.from({length:w*h},(_,i)=>i===3||i===16||i===28?1:0);
 for(const inside of [true,false]){
  const d=edt(mask,w,h,inside);
  for(let i=0;i<d.length;i++){
   let reference=Infinity;
   for(let j=0;j<mask.length;j++)if(Boolean(mask[j])===inside)reference=Math.min(reference,(i%w-j%w)**2+(Math.floor(i/w)-Math.floor(j/w))**2);
   expect(d[i]).toBe(reference);
  }
 }
});
test('source anchors reconstruct exact family weights',()=>{
 Object.values(anchors).forEach((z,i)=>expect(weights(z)).toEqual(Object.values(anchors).map((_,j)=>i===j?1:0)));
});
test('linked semantic movement reaches requested projection without escaping bounds',()=>{
 for(const axis of semanticAxes)for(const z of Object.values(anchors))for(const t of [0,.15,.5,.9,1]){
  const moved=moveAlong(z,axis,t);expect(project(moved,axis)).toBeCloseTo(t,9);expect(moved.every(x=>x>=0&&x<=1)).toBe(true);
 }
});
