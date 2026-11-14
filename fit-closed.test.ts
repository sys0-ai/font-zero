import {test,expect} from 'bun:test';
import {fitClosed} from './fit-closed';
import {at,type Point} from './curves';
import {smoothPath,pathCurves} from './outline-union';

test('closed fit shares position and tangent across the seam and every join',()=>{
 const points=Array.from({length:256},(_,i)=>[20*Math.cos(i/256*Math.PI*2),35*Math.sin(i/256*Math.PI*2)] as Point);
 const fitted=fitClosed(points,.015);expect(fitted.length).toBeLessThan(80);
 fitted.forEach((c,i)=>{
  const next=fitted[(i+1)%fitted.length];expect(c[3]).toEqual(next[0]);
  const x=c[3][0]-c[2][0],y=c[3][1]-c[2][1],u=next[1][0]-next[0][0],v=next[1][1]-next[0][1];
  expect(Math.abs(x*v-y*u)).toBeLessThan(1e-8);expect(x*u+y*v).toBeGreaterThan(0);
  for(const t of [.25,.5,.75]){const [px,py]=at(c,t);expect(Math.abs((px/20)**2+(py/35)**2-1)).toBeLessThan(.002);}
 });
});
test('smoothing stays finite and closed for collapsing details and zero strength is exact',()=>{
 for(const size of [.03,.1,1,40]){
  const path=`M0,0L${size},0L${size},${size}L0,${size}Z`;
  expect(smoothPath(path,0)).toBe(path);
  for(const amount of [.001,.3,1]){
   const d=smoothPath(path,amount);expect(d).not.toMatch(/NaN|Infinity/);
   const curves=pathCurves(d);expect(curves.length).toBe(1);expect(curves[0][0][0]).toEqual(curves[0].at(-1)![3]);
  }
 }
});
