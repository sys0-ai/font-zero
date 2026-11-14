import {test,expect} from 'bun:test';
import {fontPoles,mapPosition,mapWeights,lockMapWeights} from './font-map';
import {pole} from './weights';
test('nine poles are exact, interior coordinates continuous and normalized, edges linear',()=>{
 const p=fontPoles(9);
 p.forEach((point,i)=>expect(mapWeights(...point,p)).toEqual(pole(9,i)));
 for(let x=80;x<=280;x+=13)for(let y=60;y<=275;y+=17){
  const w=mapWeights(x,y,p);expect(w.every(v=>v>=0&&Number.isFinite(v))).toBe(true);expect(w.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
  const near=mapWeights(x+.00001,y,p);expect(Math.max(...w.map((v,i)=>Math.abs(v-near[i])))).toBeLessThan(.00001);
 }
 for(let i=0;i<9;i++){
  const a=p[i],b=p[(i+1)%9],w=mapWeights((a[0]+b[0])/2,(a[1]+b[1])/2,p);expect(w[i]).toBeCloseTo(.5,12);expect(w[(i+1)%9]).toBeCloseTo(.5,12);
 }
 const center=mapWeights(180,166,p);center.forEach(v=>expect(v).toBeCloseTo(1/9,12));expect(mapPosition(center,p)[0]).toBeCloseTo(180,12);
});
test('map locks preserve percentages without a jump near locked poles',()=>{
 const current=Array(9).fill(1/9),locks=current.map((_,i)=>i===0||i===4),p=fontPoles(9);
 for(const point of p){const w=lockMapWeights(current,mapWeights(...point,p),locks);expect(w[0]).toBe(current[0]);expect(w[4]).toBe(current[4]);expect(w.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);}
 const at=lockMapWeights(current,pole(9,0),locks),near=lockMapWeights(current,mapWeights(p[0][0],p[0][1]+.00001,p),locks);
 expect(Math.max(...at.map((v,i)=>Math.abs(v-near[i])))).toBeLessThan(.00001);
});

test('one or two selected fonts produce finite exact pole and line mixtures',()=>{
 expect(mapWeights(300,20,fontPoles(1))).toEqual([1]);
 const p=fontPoles(2);expect(mapWeights(...p[0],p)).toEqual([1,0]);expect(mapWeights(...p[1],p)).toEqual([0,1]);
 expect(mapWeights(180,166,p)).toEqual([.5,.5]);expect(mapWeights(290,166,p)).toEqual([.5,.5]);
});
