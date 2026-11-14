export type Weights=number[];
export type Locks=boolean[];
export const pole=(count:number,index:number):Weights=>Array.from({length:count},(_,i)=>i===index?1:0);
export function freeBudget(w:Weights,locks:Locks){return Math.max(0,1-w.reduce((sum,v,i)=>sum+(locks[i]?v:0),0));}
export function setWeight(w:Weights,index:number,value:number,locks:Locks):Weights{
 const others=w.flatMap((_,i)=>i!==index&&!locks[i]?[i]:[]);
 if(locks[index]||!others.length)return [...w];
 const budget=freeBudget(w,locks),v=Math.max(0,Math.min(budget,value));
 const total=others.reduce((sum,i)=>sum+w[i],0),result=[...w];result[index]=v;
 let left=budget-v;
 others.forEach((i,j)=>{result[i]=j===others.length-1?Math.max(0,left):(budget-v)*(total>1e-10?w[i]/total:1/others.length);left-=result[i];});
 return result;
}
