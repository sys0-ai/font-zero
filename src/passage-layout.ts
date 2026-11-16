import {linePositions} from './demo-spacing';
import {wrapRows} from './demo-wrap';

export interface InkBounds {left:number;right:number;top:number;bottom:number}
export interface PassageMetrics {
 reference:(c:string)=>number;
 advance:(c:string)=>number;
 ink:(c:string)=>InkBounds|undefined;
}
export function passageLayout(text:string,size:number,leading:number,padding:number,width:number,wrap:boolean,metrics:PassageMetrics){
 const scale=size/100,raw=text.replace(/\r/g,'').split('\n').map(row=>Array.from(row));
 let leftOverhang=0,rightOverhang=0;
 for(const c of new Set(raw.flat())){const box=metrics.ink(c);if(box){leftOverhang=Math.max(leftOverhang,-box.left);rightOverhang=Math.max(rightOverhang,box.right-metrics.advance(c));}}
 const rows=wrap?wrapRows(raw,Math.max(1,(width-2*padding)/scale-leftOverhang-rightOverhang),metrics.reference):raw;
 let left=0,right=0,top=Infinity,bottom=-Infinity;
 const positioned=rows.map((chars,row)=>{
  const target=chars.reduce((n,c)=>n+metrics.reference(c),0)*scale;
  const advances=chars.map(c=>metrics.advance(c)*scale),xs=linePositions(advances,target,0),baseline=row*size*leading;
  right=Math.max(right,target);
  chars.forEach((c,i)=>{const ink=metrics.ink(c);if(!ink)return;left=Math.min(left,xs[i]+ink.left*scale);right=Math.max(right,xs[i]+ink.right*scale);top=Math.min(top,baseline+ink.top*scale);bottom=Math.max(bottom,baseline+ink.bottom*scale);});
  return {chars,advances,xs,baseline};
 });
 if(!Number.isFinite(top)){top=0;bottom=0;}
 return {width:right-left+2*padding,height:bottom-top+2*padding,rows:positioned.map(row=>({...row,xs:row.xs.map(x=>x-left+padding),baseline:row.baseline-top+padding}))};
}
export function fitPassage(text:string,leading:number,padding:number,width:number,height:number,wrap:boolean,metrics:PassageMetrics,maxSize=4096){
 let low=1,high=maxSize;
 for(let i=0;i<20;i++){
  const mid=(low+high)/2,layout=passageLayout(text,mid,leading,padding,width,wrap,metrics);
  if(layout.width<=width&&layout.height<=height)low=mid;else high=mid;
 }
 return Math.floor(low*10)/10;
}
