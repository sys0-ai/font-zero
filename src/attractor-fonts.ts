import {catalog} from './catalog';
import {differentLetters} from './compatibility';

// Native fonts have one construction signature. Variants may join a group,
// but cannot bridge native fonts with conflicting constructions.
export function largestCompatibleSet(pool:number[]):number[]{
 const variants=pool.filter(i=>catalog[i].variant);
 let best:number[]=[];
 const compare=(candidate:number[])=>{
  if(candidate.length>best.length)best=candidate;
 };
 const extend=(members:number[],at:number)=>{
  compare(members);
  for(let v=at;v<variants.length;v++)if(!differentLetters([...members,variants[v]]).length)extend([...members,variants[v]],v+1);
 };
 const seen=new Set<string>();
 for(const i of pool.filter(i=>!catalog[i].variant)){
  const members=pool.filter(j=>!catalog[j].variant&&!differentLetters([i,j]).length),key=members.join(',');
  if(!seen.has(key)){seen.add(key);extend(members,0);}
 }
 extend([],0);
 return best;
}
