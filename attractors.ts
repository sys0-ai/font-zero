import {prepareDesignGlyph,exportAttractorFont,fitDesignGlyph} from './attractor-font-design';
import {downloadFont} from './download-font';
import {catalog} from './catalog';
import {largestCompatibleSet} from './attractor-fonts';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {assertCompatible,differentLetters,compatibleFormsFor} from './compatibility';
import {prepareCanvasGlyph} from './canvas-glyph';
import {passageLayout,fitPassage,type InkBounds} from './passage-layout';
import {resizeCard} from './demo-card';
import {sourcePath} from './curves';
import {passage} from './attractor-text';
import {attractionWeights,backgroundWeights,bounceAxis,type Attractor,type Pole} from './attractor-math';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const view=$('viewport'),canvas=$('text-canvas'),status=$('status'),layer=$('pole-layer'),list=$('attractor-list');
const text=$<HTMLTextAreaElement>('demo-text'),size=$<HTMLInputElement>('demo-size'),leading=$<HTMLInputElement>('line-height'),padding=$<HTMLInputElement>('padding'),fontSelect=$<HTMLSelectElement>('attractor-font'),mode=$<HTMLSelectElement>('attractor-mode'),radius=$<HTMLInputElement>('radius'),decay=$<HTMLInputElement>('decay'),speed=$<HTMLInputElement>('speed');
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]),index=(id:string)=>catalog.findIndex(f=>f.id===id),colors=['#a9dcf5','#f0bb8b','#c5b2f5','#a6d7b0','#f1aebd','#eee1a2'];
const blendFonts=largestCompatibleSet(pool.filter(i=>!catalog[i].effect)),allowed=[...blendFonts,index('redacted')];
const storageKey='fontzero.attractors.v1';
const defaultFonts=localFonts?['times-new-roman','gf-opensans','comic-sans-universal','papyrus-alternates']:blendFonts.slice(0,4).map(i=>catalog[i].id);
let attractors:Attractor[]=defaultFonts.map((font,i)=>({id:'corner-'+i,font,mode:'placed',x:0,y:0,radius:600,decay:1,vx:70,vy:55}));
let designMode=false,exporting=false,fresh=true;
let selected='corner-3',within=true,wrap=true,light=true,showPoles=true,paused=false,pointer:{x:number,y:number}|null=null;
text.value=passage;leading.value='1.3';padding.value='48';
try{const raw=localStorage.getItem(storageKey);if(raw){const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.attractors)||!s.attractors.length||typeof s.text!=='string'||!Number.isFinite(s.size)||!Number.isFinite(s.leading))throw new Error('Invalid saved attractor settings.');for(const a of s.attractors)if(!pool.includes(index(a.font))||!['placed','cursor','bounce','ambient'].includes(a.mode)||!['x','y','radius','decay','vx','vy'].every(k=>Number.isFinite(a[k]))||a.radius<=0||a.decay<0)throw new Error('Saved attractor has unavailable fonts or invalid values.');fresh=false;attractors=s.attractors;selected=attractors.some(a=>a.id===s.selected)?s.selected:attractors[0].id;text.value=s.text;size.value=String(s.size);leading.value=String(s.leading);if(Number.isFinite(s.padding))padding.value=String(s.padding);within=!!s.within;wrap=!!s.wrap;light=s.light===true;showPoles=s.showPoles!==false;paused=!!s.paused;designMode=!!s.designMode;if(typeof s.fontName==='string')$<HTMLInputElement>('font-export-name').value=s.fontName;if(typeof s.previewGlyph==='string')$<HTMLInputElement>('font-glyph').value=Array.from(s.previewGlyph)[0]??'A';}}catch(e){status.textContent=String(e);}
const current=()=>attractors.find(a=>a.id===selected)!;
const newId=()=>{let i=1;while(attractors.some(a=>a.id==='pole-'+i))i++;return 'pole-'+i;};
function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,attractors,selected,text:text.value,size:Number(size.value),leading:Number(leading.value),padding:Number(padding.value),within,wrap,light,showPoles,paused,designMode,fontName:$<HTMLInputElement>('font-export-name').value,previewGlyph:$<HTMLInputElement>('font-glyph').value}));}catch(e){status.textContent='Could not save settings: '+String(e);}}
const markers=new Map<string,HTMLButtonElement>();
function controls(){
 const a=current();$<HTMLInputElement>('design-font').checked=designMode;$<HTMLInputElement>('preview-text').checked=!designMode;
 $('font-export-controls').hidden=!designMode;$('sampling-control').hidden=designMode;$('wrap-text-control').hidden=designMode;
 document.documentElement.dataset.theme=light?'light':'dark';
 for(const [id,checked] of [['theme-toggle',light],['wrap-text',wrap],['sampling',within],['show-poles',showPoles],['motion',!paused]] as const)$<HTMLInputElement>(id).checked=checked;
 $<HTMLInputElement>('size-value').value=size.value;$('line-value').textContent=leading.value;$('padding-value').textContent=padding.value;
 list.replaceChildren(...attractors.map((item,i)=>{const button=document.createElement('button');button.setAttribute('aria-pressed',String(item.id===selected));const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--pole-color',colors[i%colors.length]);const label=document.createElement('span');label.textContent=catalog[index(item.font)].name;const small=document.createElement('small');small.textContent={placed:'Placed on page',cursor:'Following cursor',bounce:'Bouncing ball',ambient:'Everywhere'}[item.mode];button.append(swatch,label,small);button.onclick=()=>{selected=item.id;controls();save();requestDraw();};const card=document.createElement('div');card.className='attractor-card';button.className='attractor-select';const remove=document.createElement('button');remove.type='button';remove.className='attractor-remove';remove.textContent='×';remove.setAttribute('aria-label','Remove '+catalog[index(item.font)].name+' attractor');remove.title='Remove attractor';remove.disabled=attractors.length===1;remove.onclick=()=>removeAttractor(item.id);card.append(button,remove);return card;}));
 fontSelect.replaceChildren(...allowed.map(i=>{const option=document.createElement('option');option.value=catalog[i].id;option.textContent=catalog[i].name;option.disabled=!catalog[i].effect&&differentLetters([...attractors.filter(item=>item.id!==selected&&!catalog[index(item.font)].effect).map(item=>index(item.font)),i]).length>0;option.selected=a.font===catalog[i].id;return option;}));
 if(!allowed.includes(index(a.font))){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=catalog[index(a.font)].name;placeholder.disabled=true;placeholder.selected=true;fontSelect.prepend(placeholder);}
 $('selected-name').textContent='Attractor '+(attractors.indexOf(a)+1);mode.value=a.mode;radius.value=String(a.radius);decay.value=String(a.decay);speed.value=String(Math.round(Math.hypot(a.vx,a.vy)));$<HTMLInputElement>('radius-value').value=String(a.radius);$('decay-value').textContent=String(a.decay);$('speed-value').textContent=speed.value+' px/s';$('spatial-controls').hidden=a.mode==='ambient';$('speed-control').hidden=a.mode!=='bounce';
 for(const [id,marker] of markers)if(!attractors.some(a=>a.id===id)){marker.remove();markers.delete(id);}
 attractors.forEach((a,i)=>{
  if(markers.has(a.id))return;const marker=document.createElement('button');marker.className='pole';marker.dataset.id=a.id;const label=document.createElement('span');label.className='pole-label';marker.append(label);layer.append(marker);markers.set(a.id,marker);
  let dragging=false;
  marker.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();selected=a.id;a.mode='placed';dragging=true;marker.setPointerCapture(e.pointerId);controls();requestDraw();};
  marker.onpointermove=e=>{if(!dragging)return;a.x=Math.max(0,Math.min(1,e.clientX/innerWidth));a.y=Math.max(0,Math.min(1,e.clientY/innerHeight));requestDraw();};
  const finish=()=>{dragging=false;save();};marker.onpointerup=finish;marker.onpointercancel=finish;
  marker.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const delta=e.shiftKey?1:10;a.mode='placed';a.x=Math.max(0,Math.min(1,a.x+(e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0)/innerWidth));a.y=Math.max(0,Math.min(1,a.y+(e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0)/innerHeight));save();controls();requestDraw();};
 });
}
let revision=0,prepared=-1,frame=0,lastTime=0;
let redactedIndex=-1,redactedFont:any;
const redactedPaths=new Map<string,Path2D>();
let sources:number[]=[],fonts:any[]=[],lines:string[][]=[],contentWidth=0,lineHeight=0;
const glyphs=new Map<string,ReturnType<typeof prepareCanvasGlyph>>(),referenceAdvances=new Map<string,number>(),nativeAdvances=new Map<string,number[]>(),loaded=new Map<string,Promise<any>>();
const getFont=(id:string)=>{let promise=loaded.get(id);if(!promise){promise=loadFont(id);loaded.set(id,promise);}return promise;};
const surface=document.createElement('canvas');surface.setAttribute('role','img');canvas.append(surface);const context=surface.getContext('2d')!;
const pause=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
const singleCharacter=()=>{const characters=Array.from(text.value.trim());return redactedIndex<0&&characters.length===1?characters[0]:null;};
let previewPoles:Pole[]=[];
const inkBounds=new Map<string,InkBounds>();
let passageGeometry:ReturnType<typeof passageLayout>;
function passageMetrics(){
 const background=backgroundWeights(attractors.map(a=>({source:sources.indexOf(index(a.font)),x:0,y:0,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'})),sources.length);
 return {reference:(c:string)=>referenceAdvances.get(c)??0,advance:(c:string)=>nativeAdvances.get(c)!.reduce((n,a,i)=>n+a*background[i],0),ink:(c:string)=>inkBounds.get(c)};
}
function fitTextPassage(){size.value=String(fitPassage(text.value,Number(leading.value),Number(padding.value),view.clientWidth,view.clientHeight,wrap,passageMetrics(),Number(size.max)));view.scrollTo(0,0);layout();controls();save();}

function layout(){
 if(designMode||singleCharacter()){contentWidth=view.clientWidth;canvas.style.width='100%';canvas.style.height='100%';requestDraw();return;}
 passageGeometry=passageLayout(text.value,Number(size.value),Number(leading.value),Number(padding.value),view.clientWidth,wrap,passageMetrics());
 lines=passageGeometry.rows.map(row=>row.chars);lineHeight=Number(size.value)*Number(leading.value);contentWidth=passageGeometry.width;
 canvas.style.width=contentWidth+'px';canvas.style.height=passageGeometry.height+'px';surface.setAttribute('aria-label',text.value);$<HTMLInputElement>('size-value').value=size.value;$('line-value').textContent=leading.value;canvas.dataset.wrapped=String(wrap);requestDraw();
}
async function rebuild(){
 const ticket=++revision;canvas.dataset.ready='false';$<HTMLButtonElement>('fit-text').disabled=true;status.textContent='Preparing font curves…';controls();save();
 try{
  const selectedSources=[...new Set(attractors.map(a=>index(a.font)))],regularSources=selectedSources.filter(i=>!catalog[i].effect);assertCompatible(regularSources);
  const base=regularSources[0]??blendFonts[0];
  const [reference,...instances]=await Promise.all([getFont('gf-librebaskerville'),...selectedSources.map(i=>getFont(catalog[catalog[i].effect?base:i].id)),getFont('redacted')]);if(ticket!==revision)return;
  redactedFont=instances.pop();redactedIndex=selectedSources.indexOf(index('redacted'));redactedPaths.clear();
  const forms=compatibleFormsFor(regularSources.every(i=>blendFonts.includes(i))?blendFonts:regularSources);sources=selectedSources;fonts=instances.map(f=>(f.source.variant?f.withConstructions(forms):f).getVariation({wght:450,wdth:100,slnt:0}));lines=text.value.replace(/\r/g,'').split('\n').map(row=>Array.from(row));glyphs.clear();inkBounds.clear();referenceAdvances.clear();nativeAdvances.clear();
  let start=performance.now();
  for(const c of new Set([...lines.flat(),...'Font Zero'])){
   const cp=c.codePointAt(0)!;if(c.trim())redactedPaths.set(c,new Path2D(sourcePath(redactedFont.glyphForCodePoint(cp).path.commands,0,0,100/redactedFont.unitsPerEm)));const gs=fonts.map(f=>f.glyphForCodePoint(cp));if(c.trim()&&gs.some(g=>g.id===0))throw new Error('A selected font has no “'+c+'” glyph.');referenceAdvances.set(c,reference.glyphForCodePoint(cp).advanceWidth/reference.unitsPerEm*100);nativeAdvances.set(c,gs.map((g,i)=>g.advanceWidth/fonts[i].unitsPerEm*100));if(c.trim()){
    const glyph=prepareCanvasGlyph(gs,fonts,c);glyphs.set(c,glyph);
    const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(let i=0;i<fonts.length;i++)for(const contour of glyph.contours(fonts.map((_,j)=>i===j?1:0)))for(const curve of contour)for(const [x,y] of curve){box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);}
    if(Number.isFinite(box.left))inkBounds.set(c,box);
   }
   if(performance.now()-start>8){await pause();start=performance.now();if(ticket!==revision)return;}
  }
  prepared=ticket;layout();if(fresh){fresh=false;fitTextPassage();}$<HTMLButtonElement>('fit-text').disabled=false;status.textContent='';delete canvas.dataset.error;
 }catch(e){if(ticket===revision){canvas.dataset.error=String(e);status.textContent=String((e as Error).message);}}
}
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(time:number){
 frame=0;const seconds=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
 const rect=view.getBoundingClientRect();let moving=false;
 for(const a of attractors)if(a.mode==='bounce'&&!paused&&!designMode){const x=bounceAxis(Math.max(rect.left+10,Math.min(rect.right-10,a.x*innerWidth)),a.vx,seconds,rect.left+10,rect.right-10),y=bounceAxis(Math.max(rect.top+10,Math.min(rect.bottom-10,a.y*innerHeight)),a.vy,seconds,rect.top+10,rect.bottom-10);a.x=x.position/innerWidth;a.y=y.position/innerHeight;a.vx=x.velocity;a.vy=y.velocity;moving=true;}
 const poles:Pole[]=[];
 attractors.forEach((a,i)=>{
  const x=a.mode==='cursor'?pointer?.x??a.x*innerWidth:a.x*innerWidth,y=a.mode==='cursor'?pointer?.y??a.y*innerHeight:a.y*innerHeight,marker=markers.get(a.id)!;
  marker.hidden=(designMode&&(a.mode==='cursor'||a.mode==='bounce'))||a.mode==='ambient'||(a.mode==='cursor'&&(!pointer||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom))||!showPoles;marker.dataset.mode=a.mode;marker.dataset.selected=String(a.id===selected);marker.style.transform=`translate(${x}px,${y}px)`;marker.style.setProperty('--pole-color',colors[i%colors.length]);marker.setAttribute('aria-label','Move '+catalog[index(a.font)].name+' attractor');marker.firstElementChild!.textContent=showPoles?catalog[index(a.font)].name:'';
  if((a.mode!=='cursor'||pointer)&&(!designMode||a.mode==='placed'||a.mode==='ambient'))poles.push({source:sources.indexOf(index(a.font)),x:x-rect.left-view.clientLeft,y:y-rect.top-view.clientTop,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'});
 });
 previewPoles=poles;
 if(prepared===revision&&sources.length)drawWordmark(poles);
 if(designMode&&prepared===revision){drawDesign();lastTime=0;return;}
 const single=singleCharacter();
 if(single&&prepared===revision&&sources.length){drawCenteredGlyph({fonts,key:'text',frame:{width:view.clientWidth,height:view.clientHeight,size:Number(size.value)},poles},single,within);}
 else if(prepared===revision&&sources.length){
  try{
   const width=view.clientWidth,height=view.clientHeight,dpr=devicePixelRatio||1,scrollX=view.scrollLeft,scrollY=view.scrollTop,offset=Math.max(0,(width-contentWidth)/2),em=Number(size.value),pad=Number(padding.value);
   if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);surface.style.width=width+'px';surface.style.height=height+'px';}
   surface.style.left=(scrollX-offset)+'px';surface.style.top=scrollY+'px';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.fillStyle=getComputedStyle(view).color;
   const field=(x:number,y:number)=>attractionWeights(poles,sources.length,x,y),background=backgroundWeights(poles,sources.length),offsetY=Math.max(0,(height-passageGeometry.height)/2);
   const positioned:Array<{c:string,x:number,baseline:number,advance:number,blockAdvance:number}>=[];
   for(const row of passageGeometry.rows){
    const chars=row.chars,advances=row.advances,xs=row.xs,baseline=row.baseline+offsetY-scrollY;
    if(baseline+em<0||baseline-em>height)continue;
    for(let j=0;j<chars.length;j++){const c=chars[j],x=offset+xs[j]-scrollX;if(!c.trim()||x+advances[j]<-em||x>width+em)continue;positioned.push({c,x,baseline,advance:advances[j],blockAdvance:j+1<chars.length&&chars[j+1].trim()?Math.max(advances[j],xs[j+1]-xs[j]):advances[j]});}
   }
   const fontWeights=(weights:number[])=>{if(redactedIndex<0)return weights;const result=weights.slice();result[redactedIndex]=0;const total=result.reduce((a,b)=>a+b,0);if(total)return result.map(w=>w/total);result[redactedIndex]=1;return result;};
   const paint=(local:boolean)=>{for(const {c,x,baseline,advance,blockAdvance:span} of positioned){
    const weights=local?field(x+advance/2,baseline-em*.4):background,redaction=redactedIndex<0?0:weights[redactedIndex];
    context.setTransform(dpr*em/100,0,0,dpr*em/100,dpr*x,dpr*baseline);context.globalAlpha=1-redaction;
    glyphs.get(c)!.paint(context,fontWeights(weights),local&&within?(gx,gy)=>fontWeights(field(x+gx*em/100,baseline+gy*em/100)):undefined);
    if(redactedIndex>=0){
     const block=redactedFont.glyphForCodePoint(c.codePointAt(0)),blockAdvance=block.advanceWidth/redactedFont.unitsPerEm*100;
     context.globalAlpha=redaction;context.setTransform(dpr*span/blockAdvance,0,0,dpr*em/100,dpr*x,dpr*baseline);context.fill(redactedPaths.get(c)!);
    }
    context.globalAlpha=1;
   }};
   paint(!within);
   if(within){
    const active=poles.filter(p=>!p.ambient&&p.x+p.radius>0&&p.y+p.radius>0&&p.x-p.radius<width&&p.y-p.radius<height);
    if(active.length){
     // Preserve the baseline pixels exactly outside the finite attraction areas.
     context.save();context.setTransform(dpr,0,0,dpr,0,0);context.beginPath();
     for(const p of active){context.moveTo(p.x+p.radius,p.y);context.arc(p.x,p.y,p.radius,0,Math.PI*2);}
     context.clip();context.clearRect(0,0,width,height);paint(true);context.restore();
    }
   }
   canvas.dataset.ready='true';canvas.dataset.sampling=within?'within':'letter';canvas.dataset.scrollY=String(scrollY);canvas.dataset.attractors=JSON.stringify(attractors.map(a=>({id:a.id,x:a.x,y:a.y,mode:a.mode,font:a.font})));canvas.dataset.lineHeight=String(lineHeight);
  }catch(e){status.textContent=String(e);canvas.dataset.error=String(e);moving=false;}
 }
 if(moving&&!document.hidden)requestDraw();else lastTime=0;
}
function drawWordmark(poles:Pole[]){
 const mark=$('wordmark'),target=mark.querySelector('canvas')!,ctx=target.getContext('2d')!,dpr=devicePixelRatio||1;
 const weights=attractionWeights(poles,sources.length,view.clientWidth/2,view.clientHeight/2);
 if(redactedIndex>=0){weights[redactedIndex]=0;const total=weights.reduce((a,b)=>a+b,0);if(total)weights.forEach((w,i)=>weights[i]=w/total);else weights[redactedIndex]=1;}
 let advance=0,left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 const letters=Array.from('Font Zero').map(c=>{
  const glyph=glyphs.get(c)!,x=advance;
  for(const contour of glyph?.contours(weights)??[])for(const curve of contour)for(const p of curve){left=Math.min(left,x+p[0]);right=Math.max(right,x+p[0]);top=Math.min(top,p[1]);bottom=Math.max(bottom,p[1]);}
  advance+=nativeAdvances.get(c)!.reduce((n,a,i)=>n+a*weights[i],0);return {glyph,x};
 });
 if(target.width!==Math.round(140*dpr)||target.height!==Math.round(32*dpr)){target.width=Math.round(140*dpr);target.height=Math.round(32*dpr);}
 const scale=Math.min(136/(right-left),28/(bottom-top)),x=(140-(right-left)*scale)/2-left*scale,y=(32-(bottom-top)*scale)/2-top*scale;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,target.width,target.height);ctx.fillStyle=getComputedStyle(view).color;
 for(const letter of letters){ctx.setTransform(scale*dpr,0,0,scale*dpr,(x+letter.x*scale)*dpr,y*dpr);letter.glyph?.paint(ctx,weights);}
 target.hidden=false;mark.querySelector('span')!.hidden=true;
}
const designGlyphs=new Map<string,ReturnType<typeof prepareDesignGlyph>>();
let designRevision=-1;
function designSetup(){
 const fixed=attractors.filter(a=>a.mode==='placed'||a.mode==='ambient');
 if(!fixed.length)throw new Error('Add a placed or Everywhere attractor.');
 if(fixed.some(a=>catalog[index(a.font)].effect)&&fixed.some(a=>!catalog[index(a.font)].effect))throw new Error('Redacted uses transparency. Choose an outline font for OTF export.');
 const indices=[...new Set(fixed.map(a=>sources.indexOf(index(a.font))))],rect=view.getBoundingClientRect();
 return {fonts:indices.map(i=>catalog[sources[i]].effect?redactedFont:fonts[i]),key:indices.join(','),frame:{width:view.clientWidth,height:view.clientHeight,size:Number(size.value)},poles:fixed.map(a=>({source:indices.indexOf(sources.indexOf(index(a.font))),x:a.x*innerWidth-rect.left-view.clientLeft,y:a.y*innerHeight-rect.top-view.clientTop,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'}))};
}
function drawDesign(){try{drawCenteredGlyph(designSetup(),Array.from($<HTMLInputElement>('font-glyph').value)[0]??'A',true);}catch(e){canvas.dataset.error=String(e);status.textContent=(e as Error).message;$<HTMLButtonElement>('fit-text').disabled=true;$<HTMLButtonElement>('export-attractor-font').disabled=true;}}
function drawCenteredGlyph(setup:ReturnType<typeof designSetup>,character:string,sampleWithin:boolean){
 const dpr=devicePixelRatio||1,width=view.clientWidth,height=view.clientHeight;
 if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);surface.style.width=width+'px';surface.style.height=height+'px';}
 surface.style.left='0';surface.style.top='0';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.globalAlpha=1;
 try{
  const key=setup.key+':'+character;
  if(designRevision!==revision){designGlyphs.clear();designRevision=revision;}
  let glyph=designGlyphs.get(key);if(!glyph){glyph=prepareDesignGlyph(setup.fonts,character);designGlyphs.set(key,glyph);}
  const result=glyph(setup.poles,setup.frame,sampleWithin),scale=dpr*setup.frame.size/100;
  context.setTransform(scale,0,0,scale,dpr*result.x,dpr*result.y);context.fillStyle=getComputedStyle(view).color;context.fill(new Path2D(result.d));
  canvas.dataset.ready='true';canvas.dataset.design=String(designMode);canvas.dataset.single='true';canvas.dataset.designPath=result.d;canvas.dataset.designOrigin=JSON.stringify([result.x,result.y]);surface.setAttribute('aria-label',character);delete canvas.dataset.error;
  $<HTMLButtonElement>('fit-text').disabled=false;$<HTMLButtonElement>('export-attractor-font').disabled=exporting;if(!exporting)status.textContent='';
 }catch(e){canvas.dataset.error=String(e);$<HTMLButtonElement>('fit-text').disabled=true;$<HTMLButtonElement>('export-attractor-font').disabled=true;if(!exporting)status.textContent=(e as Error).message;}
}
for(const id of ['design-font','preview-text'])$<HTMLInputElement>(id).onchange=()=>{designMode=$<HTMLInputElement>('design-font').checked;$<HTMLButtonElement>('fit-text').disabled=prepared!==revision;delete canvas.dataset.error;status.textContent='';view.scrollTo(0,0);delete canvas.dataset.design;controls();layout();save();};
$('font-glyph').oninput=()=>{save();requestDraw();};$('font-export-name').oninput=save;
$('export-attractor-font').onclick=async()=>{
 if(exporting||prepared!==revision)return;
 try{
  const setup=designSetup(),name=$<HTMLInputElement>('font-export-name').value,characters=text.value+$<HTMLInputElement>('font-glyph').value;
  exporting=true;$<HTMLButtonElement>('export-attractor-font').disabled=true;
  const result=await exportAttractorFont(setup.fonts,setup.poles,setup.frame,name,characters,(done,total)=>{$('export-attractor-font').textContent=done+' / '+total;});
  downloadFont(result.bytes,result.filename);status.textContent='';
 }catch(e){status.textContent=(e as Error).message;}
 finally{exporting=false;$('export-attractor-font').textContent='Download OTF';$<HTMLButtonElement>('export-attractor-font').disabled=false;}
};
const radiusNumber=$<HTMLInputElement>('radius-value');
radiusNumber.oninput=()=>{if(radiusNumber.validity.valid&&Number.isFinite(radiusNumber.valueAsNumber)){radius.value=radiusNumber.value;radius.dispatchEvent(new Event('input'));}};
radiusNumber.onblur=()=>{radiusNumber.value=String(current().radius);};
fontSelect.onchange=()=>{if(!allowed.includes(index(fontSelect.value)))return;current().font=fontSelect.value;void rebuild();};
mode.onchange=()=>{const a=current();a.mode=mode.value as Attractor['mode'];if(a.mode==='bounce'){const r=view.getBoundingClientRect();a.x=(r.left+r.width*.5)/innerWidth;a.y=(r.top+r.height*.4)/innerHeight;}if(prepared===revision)layout();controls();save();requestDraw();};
for(const input of [radius,decay,speed])input.oninput=()=>{const a=current();a.radius=Number(radius.value);a.decay=Number(decay.value);if(input===speed){const length=Math.hypot(a.vx,a.vy)||1;a.vx=a.vx/length*Number(speed.value);a.vy=a.vy/length*Number(speed.value);}$<HTMLInputElement>('radius-value').value=radius.value;$('decay-value').textContent=decay.value;$('speed-value').textContent=speed.value+' px/s';save();requestDraw();};
$('add-attractor').onclick=()=>{const available=allowed,unused=available.find(i=>!attractors.some(a=>index(a.font)===i))??available[0],r=view.getBoundingClientRect();const a:Attractor={id:newId(),font:catalog[unused].id,mode:'placed',x:(r.left+r.width*.5)/innerWidth,y:(r.top+r.height*.5)/innerHeight,radius:180,decay:2,vx:70,vy:55};attractors.push(a);selected=a.id;void rebuild();};
function removeAttractor(id:string){if(attractors.length===1)return;attractors=attractors.filter(a=>a.id!==id);if(selected===id)selected=attractors[0].id;void rebuild();list.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus();}
$<HTMLInputElement>('show-poles').onchange=()=>{showPoles=$<HTMLInputElement>('show-poles').checked;controls();save();requestDraw();};$<HTMLInputElement>('motion').onchange=()=>{paused=!$<HTMLInputElement>('motion').checked;controls();save();requestDraw();};$<HTMLInputElement>('sampling').onchange=()=>{within=$<HTMLInputElement>('sampling').checked;controls();save();requestDraw();};
window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(!designMode&&attractors.some(a=>a.mode==='cursor'))requestDraw();},{passive:true});document.documentElement.addEventListener('pointerleave',()=>{pointer=null;requestDraw();});
const sizeNumber=$<HTMLInputElement>('size-value');
sizeNumber.oninput=()=>{if(sizeNumber.validity.valid&&Number.isFinite(sizeNumber.valueAsNumber)){size.value=sizeNumber.value;size.dispatchEvent(new Event('input'));}};
sizeNumber.onblur=()=>{sizeNumber.value=size.value;};
for(const input of [size,leading,padding])input.oninput=()=>{if(prepared===revision)layout();controls();save();};
$<HTMLInputElement>('theme-toggle').onchange=()=>{light=$<HTMLInputElement>('theme-toggle').checked;controls();save();requestDraw();};
$<HTMLInputElement>('wrap-text').onchange=()=>{wrap=$<HTMLInputElement>('wrap-text').checked;if(prepared===revision)layout();controls();save();};
$('fit-text').onclick=()=>{if(prepared!==revision)return;if(designMode||singleCharacter()){
 const setup=designMode?designSetup():{fonts,frame:{width:view.clientWidth,height:view.clientHeight,size:Number(size.value)},poles:previewPoles};
 const c=designMode?(Array.from($<HTMLInputElement>('font-glyph').value)[0]??'A'):singleCharacter()!;
 size.value=String(fitDesignGlyph(prepareDesignGlyph(setup.fonts,c),setup.poles,setup.frame,Number(padding.value),Number(size.max),designMode||within));
 view.scrollTo(0,0);controls();layout();save();return;
 }fitTextPassage();};
let textTimer:number|undefined;text.oninput=()=>{save();clearTimeout(textTimer);textTimer=window.setTimeout(()=>void rebuild(),150);};$('edit-text').onclick=()=>{const editor=$('text-editor');editor.hidden=!editor.hidden;$('edit-text').setAttribute('aria-expanded',String(!editor.hidden));if(!editor.hidden)text.focus();};view.ondblclick=()=>{if($('text-editor').hidden)$('edit-text').click();};
view.addEventListener('scroll',requestDraw,{passive:true});new ResizeObserver(()=>{if(prepared===revision)layout();else requestDraw();}).observe(view);window.addEventListener('resize',requestDraw);document.addEventListener('visibilitychange',()=>{lastTime=0;requestDraw();});window.addEventListener('pagehide',save);
controls();resizeCard('fontzero.attractors.card.v1');
if(fresh){
 const rect=view.getBoundingClientRect(),inset=24,reach=Math.min(1000,Math.round(Math.hypot(rect.width,rect.height)*1.2));
 attractors.forEach((a,i)=>{a.x=(i%2?rect.right-inset:rect.left+inset)/innerWidth;a.y=(i<2?rect.top+inset:rect.bottom-inset)/innerHeight;a.radius=reach;});
}
void rebuild();

window.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key.startsWith('Arrow'))document.documentElement.dataset.keyboard='true';});window.addEventListener('pointerdown',()=>{delete document.documentElement.dataset.keyboard;},{capture:true});
