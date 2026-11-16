import {test,expect} from 'bun:test';import {wrapRows} from './demo-wrap';
test('wrap preserves words and explicit paragraphs, splitting overlong words',()=>{
 const rows=(s:string)=>s.split('\n').map(r=>Array.from(r));
 expect(wrapRows(rows('one two three\n\nfour'),7,()=>1).map(r=>r.join(''))).toEqual(['one two','three','','four']);
 expect(wrapRows(rows('abcdefghij'),4,()=>1).map(r=>r.join(''))).toEqual(['abcd','efgh','ij']);
 expect(wrapRows(rows('💖💖💖'),2,()=>1).map(r=>r.join(''))).toEqual(['💖💖','💖']);
});
