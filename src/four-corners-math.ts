export function cornerWeights(x:number,y:number):[number,number,number,number]{
 const u=Math.max(0,Math.min(1,x)),v=Math.max(0,Math.min(1,y));
 return [(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
}
export function sourceWeights(corners:number[],sources:number[],x:number,y:number){
 const weights=cornerWeights(x,y);return sources.map(source=>corners.reduce((sum,id,i)=>sum+(id===source?weights[i]:0),0));
}
