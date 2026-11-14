import {test,expect} from 'bun:test';
import {differentLetters,assertCompatible} from './compatibility';
import {semanticStyle} from './semantic';
import {catalog} from './catalog';
test('different letter constructions block the whole font mixture',()=>{
 expect(differentLetters([5,7])).toEqual([]);expect(()=>assertCompatible([5,7])).not.toThrow();
 expect(differentLetters([0,2])).toContain('a');expect(()=>assertCompatible([0,2])).toThrow();
 expect(differentLetters([4,5])).toContain('g');
});
test('semantic matching only proposes fonts from the allowed construction group',()=>{
 const scores=Array(catalog.length+12).fill(.1);scores[4]=1;scores[5]=.5;scores[7]=.4;
 const result=semanticStyle(scores,[5,7]);expect(result.matches.map(m=>m.index)).toEqual([5,7]);expect(result.style.weights[4]).toBe(0);
});

test('multi-form Papyrus cannot bridge incompatible originals or semantic suggestions',()=>{
 const alt=catalog.findIndex(f=>f.variant);
 expect(differentLetters([alt,0])).toEqual([]);expect(differentLetters([alt,2])).toEqual([]);
 expect(differentLetters([alt,0,2])).toContain('a');
 const scores=Array(catalog.length+12).fill(.1);scores[alt]=1;scores[0]=.9;scores[2]=.8;
 const result=semanticStyle(scores,[alt,0,2]);expect(result.matches.map(m=>m.index)).toEqual([alt,0]);
});
