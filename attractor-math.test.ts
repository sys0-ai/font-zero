import {test,expect} from 'bun:test';import {attractionWeights,bounceAxis} from './attractor-math';
test('font attractors normalize, preserve exact poles and merge repeated fonts',()=>{
 const poles=[{source:0,x:0,y:0,radius:100,decay:2,ambient:true},{source:1,x:50,y:50,radius:100,decay:2}];
 expect(attractionWeights(poles,2,50,50)).toEqual([0,1]);expect(attractionWeights(poles,2,150,50)).toEqual([.5,.5]);
 const repeated=[...poles,{source:1,x:50,y:50,radius:100,decay:2}];expect(attractionWeights(repeated,2,150,50)[1]).toBeCloseTo(2/3);
 const multiple=Array.from({length:12},(_,i)=>({source:i%3,x:i*30,y:i*20,radius:200,decay:2}));const w=attractionWeights(multiple,3,79,115);expect(w.reduce((a,b)=>a+b)).toBeCloseTo(1);expect(w.every(n=>n>0)).toBe(true);
});
test('bouncing poles reflect at both card edges and remain in bounds',()=>{
 expect(bounceAxis(95,20,1,0,100)).toEqual({position:85,velocity:-20});expect(bounceAxis(5,-20,1,0,100)).toEqual({position:15,velocity:20});expect(bounceAxis(50,500,1,0,100).position).toBe(50);
});
