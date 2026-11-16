// Paints a look's ink (looks.ts) from a mask: the text is drawn once, solid, into the mask, and every part of the look —
// shadow, glow, outline, fill, texture, bevel, gloss — is composed from that mask in device pixels, so blending, the
// within-letter clip and Redacted's transparency stay exactly as the plain renderer draws them.
import type {Ink} from './looks';
export interface InkRow {baseline:number;em:number}
type Kind=NonNullable<Ink['texture']>['kind'];
function seeded(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function tile(kind:Kind,color:string,size:number){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d')!,r=seeded(size+kind.length*7919);g.fillStyle=color;g.strokeStyle=color;
 if(kind==='spots')for(let i=0;i<9;i++){const x=r()*size,y=r()*size,rx=size*(.035+r()*.06),ry=rx*(.7+r()*.5);for(const [dx,dy]of[[0,0],[size,0],[0,size],[size,size],[-size,0],[0,-size]]){g.beginPath();g.ellipse(x+dx,y+dy,rx,ry,r()*Math.PI,0,Math.PI*2);g.fill();}}
 else if(kind==='stripes')for(let i=0;i<4;i++){const x=(i+.2+r()*.5)*size/4,w=size*(.025+r()*.035),bend=size*(.05+r()*.06);g.beginPath();g.moveTo(x-w,0);g.quadraticCurveTo(x+bend,size/2,x-w,size);g.lineTo(x+w,size);g.quadraticCurveTo(x+bend+w,size/2,x+w,0);g.closePath();g.fill();}
 else if(kind==='brushed')for(let y=0;y<size;y++){g.globalAlpha=r()*.8;g.fillRect(0,y,size,1);}
 else if(kind==='fur')for(let i=0;i<size*1.5;i++){const x=r()*size,y=r()*size,l=size*(.06+r()*.1);g.globalAlpha=.3+r()*.7;g.lineWidth=Math.max(1,size/90);g.beginPath();g.moveTo(x,y);g.lineTo(x+l*.25,y+l);g.stroke();}
 else if(kind==='stars')for(let i=0;i<16;i++){g.globalAlpha=.35+r()*.65;g.beginPath();g.arc(r()*size,r()*size,Math.max(.6,size/160*(1+r()*r()*3)),0,Math.PI*2);g.fill();}
 else{g.lineWidth=Math.max(1,size*.035);for(const at of[.62,.8]){g.globalAlpha=at===.62?.8:.6;g.beginPath();for(let x=0;x<=size;x+=2){const y=size*at+Math.sin(x/size*Math.PI*2)*size*.06;x?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}}
 return c;
}
export function createLookPainter(){
 const mask=document.createElement('canvas'),layer=document.createElement('canvas'),scratch=document.createElement('canvas'),patterns=new Map<string,CanvasPattern>();
 const fit=(c:HTMLCanvasElement,w:number,h:number)=>{if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const g=c.getContext('2d')!;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);return g;};
 /** The mask's pixels moved outward by `r`: the text grown, for an outline outside its ink. */
 function grown(r:number,color:string){
  const g=fit(scratch,mask.width,mask.height),rings=Math.max(1,Math.min(4,Math.ceil(r/3)));
  for(let k=1;k<=rings;k++){const d=r*k/rings,n=Math.max(8,Math.min(32,Math.ceil(d*2)));for(let i=0;i<n;i++)g.drawImage(mask,d*Math.cos(i/n*Math.PI*2),d*Math.sin(i/n*Math.PI*2));}
  g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,scratch.width,scratch.height);
  g.globalCompositeOperation='destination-out';g.drawImage(mask,0,0);return scratch;
 }
 /** The rim of the ink facing away from (dx, dy), in `color`: a bevel's lit or shaded edge. */
 function rim(dx:number,dy:number,color:string){const g=fit(scratch,mask.width,mask.height);g.fillStyle=color;g.fillRect(0,0,scratch.width,scratch.height);g.globalCompositeOperation='destination-out';g.drawImage(mask,dx,dy);g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);return scratch;}
 function cast(target:CanvasRenderingContext2D,color:string,blur:number,dy:number,dx=0){const w=mask.width;target.save();target.shadowColor=color;target.shadowBlur=blur;target.shadowOffsetX=w+dx;target.shadowOffsetY=dy;target.drawImage(mask,-w,0);target.restore();}
 return {
  /** A clear mask the size of the canvas, to draw the text into exactly as onto the canvas. */
  mask(width:number,height:number){const g=fit(mask,width,height);g.fillStyle='#000';return g;},
  compose(target:CanvasRenderingContext2D,ink:Ink,rows:InkRow[]){
   const w=mask.width,h=mask.height,em=rows[0]?.em??16;target.save();target.setTransform(1,0,0,1,0,0);target.globalAlpha=1;
   if(ink.offset){const g=fit(scratch,w,h),d=Math.max(1,ink.offset.d*em);g.drawImage(mask,0,0);g.globalCompositeOperation='source-in';g.fillStyle=ink.offset.color;g.fillRect(0,0,w,h);target.drawImage(scratch,d,d);}
   if(ink.shadow)cast(target,ink.shadow.color,ink.shadow.blur*em,ink.shadow.dy*em);
   if(ink.glow){target.globalAlpha=ink.glow.alpha;cast(target,ink.glow.color,ink.glow.blur*em,0);cast(target,ink.glow.color,ink.glow.blur*em*.4,0);target.globalAlpha=1;}
   if(ink.ring)target.drawImage(grown(Math.max(.75,ink.ring.width*em),ink.ring.color),0,0);
   if(!ink.hollow){
    const g=fit(layer,w,h);
    if(typeof ink.fill==='string'||!ink.fill&&!ink.bands){g.fillStyle=typeof ink.fill==='string'?ink.fill:'#000';g.fillRect(0,0,w,h);}
    else if(ink.diagonal){const s=g.createLinearGradient(0,0,w,h);for(const [o,c]of ink.fill as [number,string][])s.addColorStop(o,c);g.fillStyle=s;g.fillRect(0,0,w,h);}
    else{const stops:[number,string][]=ink.bands?ink.bands.flatMap((c,i,all)=>[[i/all.length,c],[(i+1)/all.length,c]] as [number,string][]):ink.fill as [number,string][];
     // Each line has its own gradient, from cap height to baseline, as each Wordmark zero has: descenders carry the
     // last colour, and a line's band runs to the next line's.
     rows.forEach((row,i)=>{const top=row.baseline-row.em*.72,s=g.createLinearGradient(0,top,0,row.baseline);for(const [o,c]of stops)s.addColorStop(o,c);g.fillStyle=s;const from=i?(rows[i-1].baseline+row.baseline)/2-row.em*.3:0,to=i<rows.length-1?(row.baseline+rows[i+1].baseline)/2-row.em*.3:h;g.fillRect(0,from,w,to-from);});
    }
    g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);g.globalCompositeOperation='source-atop';
    if(ink.texture){const size=Math.round(Math.max(24,Math.min(512,em*2.4))),key=ink.texture.kind+ink.texture.color+size;let p=patterns.get(key);if(!p){p=g.createPattern(tile(ink.texture.kind,ink.texture.color,size),'repeat')!;patterns.set(key,p);}g.globalAlpha=ink.texture.alpha;g.fillStyle=p;g.fillRect(0,0,w,h);g.globalAlpha=1;}
    if(ink.bevel){const d=Math.max(1,ink.bevel.d*em);g.globalAlpha=ink.bevel.alpha;g.drawImage(rim(d,d,ink.bevel.light),0,0);g.drawImage(rim(-d,-d,ink.bevel.dark),0,0);g.globalAlpha=1;}
    if(ink.gloss)for(const row of rows){const top=row.baseline-row.em*.78,mid=row.baseline-row.em*.34,s=g.createLinearGradient(0,top,0,mid);s.addColorStop(0,'rgba(255,255,255,'+ink.gloss[0]+')');s.addColorStop(1,'rgba(255,255,255,'+ink.gloss[1]+')');g.fillStyle=s;g.fillRect(0,top,w,mid-top);}
    target.drawImage(layer,0,0);
   }
   target.restore();
  },
 };
}
