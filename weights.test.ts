import {test,expect} from 'bun:test';
import {setWeight,pole} from './weights';
test('nine font proportions retain locks and sum to one throughout slider changes',()=>{
 let w=Array(9).fill(1/9);const locks=[true,false,false,true,false,false,false,false,true],fixed=[...w];
 for(let pass=0;pass<8;pass++)for(let i=0;i<9;i++)for(const value of [-1,0,.1,.3,.8,1,2]){
  w=setWeight(w,i,value,locks);expect(w.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);expect(w.every(n=>n>=0&&n<=1)).toBe(true);
  locks.forEach((locked,j)=>{if(locked)expect(w[j]).toBe(fixed[j]);});
 }
 expect(setWeight(pole(9,0),1,.6,Array(9).fill(false))).toEqual([.4,.6,0,0,0,0,0,0,0]);
 expect(setWeight(w,1,.9,locks.map((_,i)=>i!==1))).toEqual(w);
});
