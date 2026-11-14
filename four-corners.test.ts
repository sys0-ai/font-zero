import {test,expect} from 'bun:test';
import {cornerWeights,sourceWeights} from './four-corners-math';
test('four corners are exact, center is equal, and repeated fonts combine',()=>{
 expect(cornerWeights(0,0)).toEqual([1,0,0,0]);expect(cornerWeights(1,0)).toEqual([0,1,0,0]);expect(cornerWeights(0,1)).toEqual([0,0,1,0]);expect(cornerWeights(1,1)).toEqual([0,0,0,1]);expect(cornerWeights(.5,.5)).toEqual([.25,.25,.25,.25]);
 expect(cornerWeights(.25,.75)).toEqual([.1875,.0625,.5625,.1875]);expect(sourceWeights([2,5,2,8],[2,5,8],.5,.5)).toEqual([.5,.25,.25]);
});
