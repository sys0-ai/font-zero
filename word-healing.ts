export interface Ink {left:number;right:number;top:number;bottom:number;area:number}
const commands=/([MLCQZ])([^MLCQZ]*)/g,numbers=/-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi;
export function inkOf(path:string):Ink {
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,area=0,x=0,y=0,sx=0,sy=0;
 const visit=(nx:number,ny:number)=>{area+=x*ny-nx*y;x=nx;y=ny;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);};
 for(const [,command,body] of path.matchAll(commands)){
  const a=(body.match(numbers)||[]).map(Number);
  if(command==='M'){x=sx=a[0];y=sy=a[1];visit(x,y);}
  else if(command==='L')visit(a[0],a[1]);
  else if(command==='Z')visit(sx,sy);
  else if(command==='C'||command==='Q'){
   const ax=x,ay=y;
   for(let j=1;j<=8;j++){const t=j/8,u=1-t;
    if(command==='C')visit(u*u*u*ax+3*u*u*t*a[0]+3*u*t*t*a[2]+t*t*t*a[4],u*u*u*ay+3*u*u*t*a[1]+3*u*t*t*a[3]+t*t*t*a[5]);
    else visit(u*u*ax+2*u*t*a[0]+t*t*a[2],u*u*ay+2*u*t*a[1]+t*t*a[3]);
   }
  }
 }
 return Number.isFinite(left)?{left,right,top,bottom,area:Math.abs(area/2)}:{left:0,right:0,top:0,bottom:0,area:0};
}
export interface WordGlyph {word:number;slot:number;advance:number;ink:Ink}
export interface Healing {scale:number;translate:number;advance:number}
export function healWords(glyphs:WordGlyph[],amount:number):Healing[]{
 const result=glyphs.map(g=>({scale:1,translate:0,advance:g.advance}));
 if(amount<=0)return result;
 const strength=Math.min(1,amount);
 for(let first=0;first<glyphs.length;){
  let end=first+1;const word=glyphs[first].word;
  while(word>=0&&end<glyphs.length&&glyphs[end].word===word)end++;
  if(word>=0&&end-first>1){
   const group=glyphs.slice(first,end),total=group.reduce((sum,g)=>sum+g.advance,0);
   const needs=group.map(g=>{const width=g.ink.right-g.ink.left,height=g.ink.bottom-g.ink.top;return .7*width+1.5*g.ink.area/Math.max(height,g.advance*.2)+.12*g.advance;});
   const bounded=(i:number,factor:number)=>Math.max(group[i].advance*.65,Math.min(group[i].advance*1.35,needs[i]*factor));
   let low=0,high=total/Math.max(1e-9,Math.min(...needs))*2;
   for(let j=0;j<48;j++){const mid=(low+high)/2;if(needs.reduce((sum,_,i)=>sum+bounded(i,mid),0)<total)low=mid;else high=mid;}
   let cursor=group[0].slot,remaining=total;
   group.forEach((g,i)=>{
    const target=bounded(i,(low+high)/2),width=g.ink.right-g.ink.left;
    const desiredScale=1+.65*(target/g.advance-1);
    const scaleAtFull=width>0?Math.min(desiredScale,Math.max(.5,(target-g.advance*.06)/width)):1;
    const offset=(target-scaleAtFull*width)/2-scaleAtFull*(g.ink.left-g.slot);
    const scale=1+strength*(scaleAtFull-1);
    const advance=i===group.length-1?remaining:g.advance+strength*(target-g.advance);
    result[first+i]={scale,translate:cursor+strength*offset-scale*g.slot,advance};
    cursor+=advance;remaining-=advance;
   });
  }
  first=end;
 }
 return result;
}
export function transformInk(ink:Ink,x:number,scale:number):Ink{return {left:ink.left*scale+x,right:ink.right*scale+x,top:ink.top*scale,bottom:ink.bottom*scale,area:ink.area*scale*scale};}
export function stretchPath(path:string,scale:number,translate:number){
 if(scale===1&&translate===0)return path;
 return path.replace(commands,(_,command:string,body:string)=>command+(body.match(numbers)||[]).map((n,i)=>i%2===0?(Number(n)*scale+translate).toFixed(5):n).join(','));
}
export function wordIds(line:string){const ids=Array<number>(line.length).fill(-1);let word=0;for(const match of line.matchAll(/[A-Za-z0-9_]+(?:'[A-Za-z0-9_]+)*/g)){for(let i=match.index!;i<match.index!+match[0].length;i++)ids[i]=word;word++;}return ids;}
