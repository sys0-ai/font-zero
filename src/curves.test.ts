import {test,expect} from 'bun:test';
import {at,split,readContours,pairContours,curvePath,correspond,type Contour} from './curves';
test('quadratic to cubic conversion preserves the source curve',()=>{
 const c=readContours([{command:'moveTo',args:[0,0]},{command:'quadraticCurveTo',args:[10,20,20,0]},{command:'closePath',args:[]}])[0][0];
 for(const t of [0,.1,.3,.5,.9,1]){const p=at(c,t);expect(p[0]).toBeCloseTo(20*t,10);expect(p[1]).toBeCloseTo(-40*t*(1-t),10);}
 const [a,b]=split(c,.35);expect(at(a,1)).toEqual(at(b,0));expect(at(a,.5)[0]).toBeCloseTo(at(c,.175)[0],10);
});
test('correspondence keeps closed cubic paths at both endpoints and the midpoint',()=>{
 const a=readContours([{command:'moveTo',args:[0,0]},{command:'lineTo',args:[20,0]},{command:'lineTo',args:[20,20]},{command:'lineTo',args:[0,20]},{command:'closePath',args:[]}]);
 const b=readContours([{command:'moveTo',args:[10,0]},{command:'quadraticCurveTo',args:[20,0,20,10]},{command:'quadraticCurveTo',args:[20,20,10,20]},{command:'quadraticCurveTo',args:[0,20,0,10]},{command:'quadraticCurveTo',args:[0,0,10,0]},{command:'closePath',args:[]}]);
 const pairs=pairContours(a,b);
 for(const side of pairs[0])for(let i=0;i<side.length;i++){
  const end=side[i][3],next=side[(i+1)%side.length][0];expect(end[0]).toBeCloseTo(next[0],5);expect(end[1]).toBeCloseTo(next[1],5);
 }
 for(const t of [0,.5,1]){const path=curvePath(pairs,()=>t);expect(path).toContain('C');expect(path).toEndWith('Z');expect(path).not.toMatch(/NaN|Infinity|L/);}
});
