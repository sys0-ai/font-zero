import {test,expect} from 'bun:test';import {attractionWeights,bounceAxis,backgroundWeights} from './attractor-math';
test('font attractors have exact centers, finite falloff and merge repeated fonts',()=>{
 const poles=[{source:0,x:0,y:0,radius:100,decay:2,ambient:true},{source:1,x:50,y:50,radius:100,decay:2}];
 expect(attractionWeights(poles,2,50,50)).toEqual([0,1]);expect(attractionWeights(poles,2,150,50)).toEqual([1,0]);expect(attractionWeights(poles,2,151,50)).toEqual([1,0]);
 expect(attractionWeights(poles,2,100,50)).toEqual([.75,.25]);
 const repeated=[...poles,{source:1,x:50,y:50,radius:100,decay:2}];expect(attractionWeights(repeated,2,100,50)[1]).toBeCloseTo(.4);
 for(const decay of [.5,1,2,6]){const p=[poles[0],{...poles[1],radius:.5,decay}];expect(attractionWeights(p,2,50.5,50)).toEqual([1,0]);expect(attractionWeights(p,2,50.4999,50)[1]).toBeLessThan(.001);}
 const multiple=Array.from({length:12},(_,i)=>({source:i%3,x:i*30,y:i*20,radius:200,decay:2}));const w=attractionWeights(multiple,3,79,115);expect(w.reduce((a,b)=>a+b)).toBeCloseTo(1);expect(w.every(n=>n>0)).toBe(true);
 expect(backgroundWeights(poles,2)).toEqual([1,0]);expect(attractionWeights([poles[1]],2,1000,1000)).toEqual([1,0]);
});
test('bouncing poles reflect at both card edges and remain in bounds',()=>{
 expect(bounceAxis(95,20,1,0,100)).toEqual({position:85,velocity:-20});expect(bounceAxis(5,-20,1,0,100)).toEqual({position:15,velocity:20});expect(bounceAxis(50,500,1,0,100).position).toBe(50);
});

test('zero decay stays uniform inside its radius and disappears at the boundary',()=>{
 const base={source:0,x:0,y:0,radius:100,decay:2,ambient:true},flat={source:1,x:50,y:50,radius:100,decay:0};
 for(const x of [50,51,100,149.999])expect(attractionWeights([base,flat],3,x,50)).toEqual([0,1,0]);
 for(const x of [150,151,1000])expect(attractionWeights([base,flat],3,x,50)).toEqual([1,0,0]);
 expect(attractionWeights([base,flat,{...flat,source:2,x:60}],3,100,50)).toEqual([0,.5,.5]);
});
