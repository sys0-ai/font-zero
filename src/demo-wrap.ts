export function wrapRows(rows:string[][],maxWidth:number,advance:(character:string)=>number):string[][]{
 const result:string[][]=[];
 for(const input of rows){
  let row:string[]=[],width=0;
  for(const character of input){
   row.push(character);width+=advance(character);
   while(width>maxWidth&&row.length>1){
    let split=-1;for(let i=row.length-1;i>0;i--)if(/\s/u.test(row[i])){split=i;break;}
    if(split<0)split=row.length-1;
    const line=row.slice(0,split);while(line.length&&/\s/u.test(line.at(-1)!))line.pop();result.push(line);
    row=row.slice(split);while(row.length&&/\s/u.test(row[0]))row.shift();
    width=row.reduce((n,c)=>n+advance(c),0);
   }
  }
  result.push(row);
 }
 return result;
}
