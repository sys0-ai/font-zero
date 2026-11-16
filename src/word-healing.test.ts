import {test,expect} from 'bun:test';
import {healWords,inkOf,stretchPath,wordIds,type WordGlyph} from './word-healing';
const glyph=(slot:number,width:number,area:number,word=0):WordGlyph=>({word,slot,advance:60,ink:{left:slot+(60-width)/2,right:slot+(60+width)/2,top:-50,bottom:0,area}});
test('the whole word shares width, while its outer boundary remains fixed',()=>{
 const letters=[glyph(0,52,1400),glyph(60,15,500),glyph(120,52,1400),glyph(180,15,500)];
 const healed=healWords(letters,1);
 expect(healed[0].advance).toBeGreaterThan(60);expect(healed[1].advance).toBeLessThan(60);
 expect(healed.reduce((sum,g)=>sum+g.advance,0)).toBeCloseTo(240,10);
 let right=-Infinity;
 for(let i=0;i<letters.length;i++){
  const g=letters[i],h=healed[i],left=g.ink.left*h.scale+h.translate;
  expect(left).toBeGreaterThan(right);right=g.ink.right*h.scale+h.translate;
  expect(h.scale).toBeGreaterThan(0);expect(h.advance).toBeGreaterThanOrEqual(39);
 }
 expect(right).toBeLessThan(240);
});
test('a distant letter can affect allocation, but another word cannot',()=>{
 const narrow=[glyph(0,20,600),glyph(60,25,650),glyph(120,15,450)],wide=[...narrow.slice(0,2),glyph(120,54,1500)];
 expect(healWords(wide,1)[0].advance).toBeLessThan(healWords(narrow,1)[0].advance);
 const separate=[...narrow,glyph(240,54,1500,1),glyph(300,15,450,1)];
 expect(healWords(separate,1).slice(0,3)).toEqual(healWords(narrow,1));
});
test('strength is continuous, off is exact, and spaces and single letters stay unchanged',()=>{
 const items=[glyph(0,52,1400),glyph(60,15,500),glyph(120,0,0,-1),glyph(180,30,800,1)];
 const zero=healWords(items,0),full=healWords(items,1),half=healWords(items,.5);
 zero.forEach((g,i)=>expect(g).toEqual({scale:1,translate:0,advance:items[i].advance}));
 half.forEach((g,i)=>{expect(g.scale).toBeCloseTo((zero[i].scale+full[i].scale)/2,10);expect(g.translate).toBeCloseTo(full[i].translate/2,10);});
 expect(full[2]).toEqual(zero[2]);expect(full[3]).toEqual(zero[3]);
 expect(wordIds("I'm next_word, 42!")).toEqual([0,0,0,-1,1,1,1,1,1,1,1,1,1,-1,-1,2,2,-1]);
});
test('curve measurements and horizontal transforms preserve the vertical geometry',()=>{
 const path='M10,-50L30,-50L30,0L10,0Z';expect(inkOf(path)).toEqual({left:10,right:30,top:-50,bottom:0,area:1000});
 expect(stretchPath(path,1,0)).toBe(path);
 expect(inkOf(stretchPath(path,1.2,5))).toEqual({left:17,right:41,top:-50,bottom:0,area:1200});
 expect(inkOf('')).toEqual({left:0,right:0,top:0,bottom:0,area:0});
});
