import {test,expect} from 'bun:test';
import {catalog} from './catalog';
import {differentLetters} from './compatibility';
import {largestCompatibleSet} from './attractor-fonts';

test('largest demo cohort is jointly compatible and maximal among native construction groups',()=>{
 for(const local of [true,false]){
  const pool=catalog.flatMap((f,i)=>(f.asset||(local&&f.file))?[i]:[]),group=largestCompatibleSet(pool);
  expect(differentLetters(group)).toEqual([]);
  for(const i of pool.filter(i=>!catalog[i].variant)){
   const members=pool.filter(j=>!catalog[j].variant&&!differentLetters([i,j]).length);
   for(const j of pool.filter(j=>catalog[j].variant))if(!differentLetters([...members,j]).length)members.push(j);
   expect(group.length).toBeGreaterThanOrEqual(members.length);
  }
 }
 const group=largestCompatibleSet(catalog.flatMap((f,i)=>(f.asset||f.file)?[i]:[]));
 expect(group.map(i=>catalog[i].name)).toEqual(['Times New Roman','Georgia','Open Sans','Domine','Noto Serif','Papyrus Universal','Comic Sans Universal','Arial · compatible g','Times New Roman · alternate forms']);
});
