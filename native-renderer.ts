import {prepareCanvasGlyph} from './canvas-glyph';
import {prepareDesignGlyph,fitDesignGlyph,exportAttractorFont} from './attractor-font-design';
import {passageLayout,fitPassage,type InkBounds} from './passage-layout';
import {sourcePath} from './curves';
import {attractionWeights,backgroundWeights,bounceAxis,type Pole} from './attractor-math';
import {loadFont} from './native-typefaces';
import {assertCompatible,compatibleFormsFor} from './compatibility';
import {catalog} from './catalog';
export interface NativeAttractor {id:string;font:string;mode:'placed'|'cursor'|'bounce'|'ambient';x:number;y:number;radius:number;decay:number;speed:number}
export interface NativeSettings {text:string;size:number;leading:number;padding:number;within:boolean;wrap:boolean;showAttractors:boolean;motion:boolean;previewGlyph:string;fontName:string;cardWidth:number;cardHeight:number;attractors:NativeAttractor[]}
export function createRenderer(view:HTMLElement,report:(message:string)=>void){
 const canvas=view.querySelector('canvas')!,context=canvas.getContext('2d')!,content=view.querySelector<HTMLElement>('.font-content')!;
 let settings:NativeSettings,design=false,selected='',revision=0,prepared=-1,frame=0,lastTime=0,stopped=false,pointer:{x:number;y:number}|null=null;
 let ids:string[]=[],fonts:any[]=[],redacted:any,reference:any,redactedIndex=-1;
 let geometry:ReturnType<typeof passageLayout>,key='',layoutKey='';
 const glyphs=new Map<string,ReturnType<typeof prepareCanvasGlyph>>(),ink=new Map<string,InkBounds>(),advances=new Map<string,number[]>(),referenceAdvances=new Map<string,number>(),blocks=new Map<string,Path2D>(),singleGlyphs=new Map<string,ReturnType<typeof prepareDesignGlyph>>();
 const loaded=new Map<string,Promise<any>>(),positions=new Map<string,{x:number;y:number;vx:number;vy:number}>();
 const get=(id:string)=>{let p=loaded.get(id);if(!p){p=loadFont(id);loaded.set(id,p);}return p;};
 const single=()=>design?Array.from(settings.previewGlyph)[0]??'A':redactedIndex<0&&Array.from(settings.text.trim()).length===1?settings.text.trim():null;
 const request=()=>{if(!frame&&!stopped)frame=requestAnimationFrame(draw);};
 const poles=():Pole[]=>settings.attractors.flatMap(a=>{
  if(design&&a.mode!=='placed'&&a.mode!=='ambient')return [];
  if(a.mode==='cursor'&&!pointer)return [];
  const p=positions.get(a.id),x=a.mode==='cursor'?pointer!.x:p?.x??a.x*view.clientWidth,y=a.mode==='cursor'?pointer!.y:p?.y??a.y*view.clientHeight;
  return [{id:a.id,source:ids.indexOf(a.font),x,y,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'}];
 });
 const metrics=()=>{
  const bg=backgroundWeights(poles(),ids.length);
  return {reference:(c:string)=>referenceAdvances.get(c)??0,advance:(c:string)=>advances.get(c)!.reduce((sum,a,i)=>sum+a*bg[i],0),ink:(c:string)=>ink.get(c)};
 };
 function layout(){
  if(!settings||prepared!==revision)return;
  if(single()){content.style.width='100%';content.style.height='100%';}
  else{geometry=passageLayout(settings.text,settings.size,settings.leading,settings.padding,view.clientWidth,settings.wrap,metrics());content.style.width=geometry.width+'px';content.style.height=geometry.height+'px';}
  request();
 }
 async function prepare(){
  const ticket=++revision;view.dataset.ready='false';report('Preparing font curves…');
  try{
   ids=[...new Set(settings.attractors.map(a=>a.font))];const base=ids.find(id=>id!=='redacted')??'gf-roboto';
   [reference,redacted,...fonts]=await Promise.all([get('gf-librebaskerville'),get('redacted'),...ids.map(id=>get(id==='redacted'?base:id))]);if(ticket!==revision||stopped)return;
   const regular=ids.filter(id=>id!=='redacted').map(id=>catalog.findIndex(f=>f.id===id));assertCompatible(regular);const forms=compatibleFormsFor(regular);fonts=fonts.map(f=>f.source.variant?f.withConstructions(forms):f);redactedIndex=ids.indexOf('redacted');glyphs.clear();ink.clear();advances.clear();referenceAdvances.clear();blocks.clear();singleGlyphs.clear();
   const chars=new Set([...settings.text,...settings.previewGlyph]);let started=performance.now();
   for(const c of chars){
    if(c==='\r'||c==='\n')continue;
    const cp=c.codePointAt(0)!,gs=fonts.map(f=>f.glyphForCodePoint(cp));
    if(c.trim()&&gs.some(g=>!g.id))throw Error('A selected font has no “'+c+'” glyph.');
    referenceAdvances.set(c,reference.glyphForCodePoint(cp).advanceWidth/reference.unitsPerEm*100);advances.set(c,gs.map((g,i)=>g.advanceWidth/fonts[i].unitsPerEm*100));
    if(c.trim()){
     blocks.set(c,new Path2D(sourcePath(redacted.glyphForCodePoint(cp).path.commands,0,0,100/redacted.unitsPerEm)));
     const glyph=prepareCanvasGlyph(gs,fonts,c);glyphs.set(c,glyph);
     const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
     for(let i=0;i<fonts.length;i++)for(const contour of glyph.contours(fonts.map((_,j)=>i===j?1:0)))for(const curve of contour)for(const [x,y]of curve){box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);}
     if(Number.isFinite(box.left))ink.set(c,box);
    }
    if(performance.now()-started>8){await new Promise<void>(r=>requestAnimationFrame(()=>r()));started=performance.now();if(ticket!==revision||stopped)return;}
   }
   prepared=ticket;report('');delete view.dataset.error;layout();
  }catch(e){if(ticket===revision&&!stopped){view.dataset.error=String(e);report((e as Error).message);}}
 }
 function designSetup(){
  const fixed=settings.attractors.filter(a=>a.mode==='placed'||a.mode==='ambient');
  if(!fixed.length)throw Error('Add a placed or Everywhere attractor.');
  if(fixed.some(a=>a.font==='redacted')&&fixed.some(a=>a.font!=='redacted'))throw Error('Redacted transparency cannot be exported as an outline font.');
  const sources=[...new Set(fixed.map(a=>ids.indexOf(a.font)))];
  return {fonts:sources.map(i=>ids[i]==='redacted'?redacted:fonts[i]),poles:fixed.map(a=>({source:sources.indexOf(ids.indexOf(a.font)),x:a.x*view.clientWidth,y:a.y*view.clientHeight,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'})),frame:{width:view.clientWidth,height:view.clientHeight,size:settings.size}};
 }
 function glyphFor(character:string,fs:any[],name:string){let glyph=singleGlyphs.get(name+character);if(!glyph){glyph=prepareDesignGlyph(fs,character);singleGlyphs.set(name+character,glyph);}return glyph;}
 function draw(time:number){
  frame=0;if(stopped||!settings)return;const w=view.clientWidth,h=view.clientHeight,dt=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
  const moving=settings.motion&&!design&&!document.hidden&&document.documentElement.dataset.motion!=='none';
  if(moving)for(const a of settings.attractors)if(a.mode==='bounce'){
   const old=positions.get(a.id)??{x:a.x*w,y:a.y*h,vx:a.speed*.8,vy:a.speed*.6};
   const px=bounceAxis(old.x,old.vx,dt,10,w-10),py=bounceAxis(old.y,old.vy,dt,10,h-10);positions.set(a.id,{x:px.position,y:py.position,vx:px.velocity,vy:py.velocity});
  }
  if(prepared!==revision)return;
  try{
   const dpr=devicePixelRatio||1,p=poles(),em=settings.size;
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
   canvas.style.left=view.scrollLeft+'px';canvas.style.top=view.scrollTop+'px';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,w,h);context.fillStyle=getComputedStyle(view).color;
   const c=single();
   if(c){
    const setup=design?designSetup():{fonts,poles:p,frame:{width:w,height:h,size:em}};
    const glyph=glyphFor(c,setup.fonts,design?'design':'text'),result=glyph(setup.poles,setup.frame,design||settings.within);
    const scale=dpr*em/100;context.setTransform(scale,0,0,scale,dpr*result.x,dpr*result.y);context.fill(new Path2D(result.d));
   }else{
    const field=(x:number,y:number)=>attractionWeights(p,ids.length,x,y),bg=backgroundWeights(p,ids.length),ox=Math.max(0,(w-geometry.width)/2)-view.scrollLeft,oy=Math.max(0,(h-geometry.height)/2)-view.scrollTop;
    const fontWeights=(weights:number[])=>{if(redactedIndex<0)return weights;const ws=weights.slice();ws[redactedIndex]=0;const total=ws.reduce((a,b)=>a+b,0);if(total)return ws.map(v=>v/total);ws[redactedIndex]=1;return ws;};
    const paint=(local:boolean)=>{
     for(const row of geometry.rows){const baseline=row.baseline+oy;if(baseline+em<0||baseline-em>h)continue;
      for(let j=0;j<row.chars.length;j++){const c=row.chars[j],x=row.xs[j]+ox,advance=row.advances[j];if(!c.trim()||x+advance<-em||x>w+em)continue;
       const weights=local?field(x+advance/2,baseline-em*.4):bg,alpha=redactedIndex<0?0:weights[redactedIndex];
       context.setTransform(dpr*em/100,0,0,dpr*em/100,dpr*x,dpr*baseline);context.globalAlpha=1-alpha;
       glyphs.get(c)!.paint(context,fontWeights(weights),local&&settings.within?(gx,gy)=>fontWeights(field(x+gx*em/100,baseline+gy*em/100)):undefined);
       if(alpha){const g=redacted.glyphForCodePoint(c.codePointAt(0)),ba=g.advanceWidth/redacted.unitsPerEm*100,span=j+1<row.chars.length&&row.chars[j+1].trim()?Math.max(advance,row.xs[j+1]-row.xs[j]):advance;context.globalAlpha=alpha;context.setTransform(dpr*span/ba,0,0,dpr*em/100,dpr*x,dpr*baseline);context.fill(blocks.get(c)!);}
       context.globalAlpha=1;
      }
     }
    };
    paint(!settings.within);
    if(settings.within){const active=p.filter(p=>!p.ambient);if(active.length){context.save();context.setTransform(dpr,0,0,dpr,0,0);context.beginPath();for(const a of active){context.moveTo(a.x+a.radius,a.y);context.arc(a.x,a.y,a.radius,0,Math.PI*2);}context.clip();context.clearRect(0,0,w,h);paint(true);context.restore();}}
   }
   if(settings.showAttractors){
    const style=getComputedStyle(view),color=style.getPropertyValue('--color-highlight').trim();context.setTransform(dpr,0,0,dpr,0,0);context.globalAlpha=1;
    context.font=style.font;context.textBaseline='top';
    settings.attractors.forEach((a,i)=>{const pole=p.find(p=>(p as Pole&{id:string}).id===a.id);if(a.mode==='ambient'||!pole)return;
     const x=Math.max(12,Math.min(w-12,pole.x)),y=Math.max(12,Math.min(h-12,pole.y));context.beginPath();context.arc(x,y,a.id===selected?9:6,0,Math.PI*2);context.fillStyle=color;context.fill();context.strokeStyle=style.color;context.lineWidth=1;context.stroke();
     context.fillStyle=style.color;context.fillText(String(i+1),Math.max(4,Math.min(w-20,x+13)),Math.max(4,Math.min(h-20,y-5)));
    });
   }
   view.dataset.ready='true';view.dataset.design=String(design);view.dataset.sampling=settings.within?'within':'letter';delete view.dataset.error;
  }catch(e){view.dataset.error=String(e);report((e as Error).message);}
  if(moving&&settings.attractors.some(a=>a.mode==='bounce'))request();else lastTime=0;
 }
 const resize=new ResizeObserver(()=>{positions.clear();layout();});resize.observe(view);
 const theme=new MutationObserver(request);theme.observe(document.documentElement,{attributes:true,attributeFilter:['style','class','data-motion','data-theme']});
 const themeLink=document.getElementById('theme');themeLink?.addEventListener('load',request);
 const scroll=()=>request(),move=(e:PointerEvent)=>{const r=view.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top};if(settings?.attractors.some(a=>a.mode==='cursor'))request();},leave=()=>{pointer=null;request();},visible=()=>{lastTime=0;request();};
 view.addEventListener('scroll',scroll,{passive:true});view.addEventListener('pointermove',move,{passive:true});view.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visible);
 return {
  update(next:NativeSettings,isDesign:boolean,chosen:string){settings=next;design=isDesign;selected=chosen;for(const a of next.attractors)if(a.mode!=='bounce')positions.delete(a.id);const k=JSON.stringify([next.attractors.map(a=>a.font),[...new Set(next.text+next.previewGlyph)].sort()]);const l=JSON.stringify([next.text,next.size,next.leading,next.padding,next.wrap,isDesign,next.previewGlyph,next.attractors.filter(a=>a.mode==='ambient').map(a=>a.font)]);if(k!==key){key=k;layoutKey=l;positions.clear();void prepare();}else{if(l!==layoutKey){layoutKey=l;layout();}request();}},
  ready:()=>prepared===revision,
  fit(){if(prepared!==revision)throw Error('Font curves are still loading.');view.scrollTo(0,0);const c=single();if(c){const s=design?designSetup():{fonts,poles:poles(),frame:{width:view.clientWidth,height:view.clientHeight,size:settings.size}};return fitDesignGlyph(glyphFor(c,s.fonts,design?'design':'text'),s.poles,s.frame,settings.padding,4096,design||settings.within);}return fitPassage(settings.text,settings.leading,settings.padding,view.clientWidth,view.clientHeight,settings.wrap,metrics(),4096);},
  async export(progress:(done:number,total:number)=>void){const s=designSetup();return exportAttractorFont(s.fonts,s.poles,s.frame,settings.fontName,settings.text+settings.previewGlyph,progress);},
  hit(x:number,y:number){return (poles() as (Pole&{id:string})[]).find(p=>!p.ambient&&Math.hypot(x-p.x,y-p.y)<18)?.id;},
  dispose(){stopped=true;revision++;cancelAnimationFrame(frame);resize.disconnect();theme.disconnect();themeLink?.removeEventListener('load',request);view.removeEventListener('scroll',scroll);view.removeEventListener('pointermove',move);view.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visible);}
 };
}
