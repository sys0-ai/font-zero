import {inkOf} from './word-healing';
interface Frame {width:number;height:number}
interface Row {first:number;end:number}
/** Keep letter height steady; absorb width differences in spacing, not glyph shape. */
export class PreviewSize {
 private key='';private frames:Frame[]=[];
 snapshot(){return {key:this.key,frames:this.frames};}
 restore(value:{key:string;frames:Frame[]}){this.key=value.key;this.frames=value.frames;}
 layout(paths:string[],rows:Row[],key:string,centerX:number,centerY:number,lineHeight:number){
  const measured=rows.map(row=>{
   const glyphs=paths.slice(row.first,row.end).map((d,index)=>({d,index:row.first+index,ink:inkOf(d)})).filter(g=>g.ink.right>g.ink.left);
   return {glyphs,left:Math.min(...glyphs.map(g=>g.ink.left)),right:Math.max(...glyphs.map(g=>g.ink.right)),top:Math.min(...glyphs.map(g=>g.ink.top)),bottom:Math.max(...glyphs.map(g=>g.ink.bottom))};
  });
  if(key!==this.key){this.key=key;this.frames=measured.map(r=>({width:r.glyphs.length?r.right-r.left:0,height:r.glyphs.length?r.bottom-r.top:0}));}
  const result=paths.map(()=>''),scales:number[]=[];
  measured.forEach((row,r)=>{
   if(!row.glyphs.length)return;
   const frame=this.frames[r],scale=frame.height/(row.bottom-row.top),glyphs=row.glyphs;
   scales.push(scale);
   const widths=glyphs.map(g=>(g.ink.right-g.ink.left)*scale),natural=glyphs.slice(1).map((g,i)=>(g.ink.left-glyphs[i].ink.right)*scale);
   const wanted=frame.width-widths.reduce((a,b)=>a+b,0),minimum=.25;
   // A wider letter may exhaust the available spacing. Keep it readable rather
   // than reducing its height or squeezing its outline.
   const gaps=natural.map(()=>minimum);
   let remaining=wanted-minimum*gaps.length,free=natural.map((_,i)=>i);
   while(free.length&&remaining>0){
    const total=free.reduce((n,i)=>n+natural[i],0),adjustment=(remaining-total)/free.length;
    const clipped=free.filter(i=>natural[i]+adjustment<0);
    if(!clipped.length){for(const i of free)gaps[i]+=natural[i]+adjustment;break;}
    free=free.filter(i=>!clipped.includes(i));
   }
   const width=widths.reduce((a,b)=>a+b,0)+gaps.reduce((a,b)=>a+b,0);
   let x=centerX-width/2;
   const y=centerY+(r-(rows.length-1)/2)*lineHeight-(row.top+row.bottom)*scale/2;
   glyphs.forEach((g,i)=>{
    const tx=x-g.ink.left*scale;
    result[g.index]=g.d.replace(/([MLCQZ])([^MLCQZ]*)/g,(_,command:string,body:string)=>command+(body.match(/-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[]).map((v,j)=>(Number(v)*scale+(j%2?y:tx)).toFixed(5)).join(','));
    x+=widths[i]+(gaps[i]??0);
   });
  });
  return {path:result.join(''),scales};
 }
}
