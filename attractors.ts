import {prepareDesignGlyph,exportAttractorFont} from './attractor-font-design';
import {downloadFont} from './download-font';
import {catalog} from './catalog';
import {largestCompatibleSet} from './attractor-fonts';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {assertCompatible,differentLetters,compatibleFormsFor} from './compatibility';
import {prepareCanvasGlyph} from './canvas-glyph';
import {linePositions} from './demo-spacing';
import {resizeCard} from './demo-card';
import {sourcePath} from './curves';
import {wrapRows} from './demo-wrap';
import {poem} from './cursor-text';
import {attractionWeights,backgroundWeights,bounceAxis,type Attractor,type Pole} from './attractor-math';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const view=$('viewport'),canvas=$('text-canvas'),status=$('status'),layer=$('pole-layer'),list=$('attractor-list');
const text=$<HTMLTextAreaElement>('demo-text'),size=$<HTMLInputElement>('demo-size'),leading=$<HTMLInputElement>('line-height'),padding=$<HTMLInputElement>('padding'),fontSelect=$<HTMLSelectElement>('attractor-font'),mode=$<HTMLSelectElement>('attractor-mode'),radius=$<HTMLInputElement>('radius'),decay=$<HTMLInputElement>('decay'),speed=$<HTMLInputElement>('speed');
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]),index=(id:string)=>catalog.findIndex(f=>f.id===id),colors=['#a9dcf5','#f0bb8b','#c5b2f5','#a6d7b0','#f1aebd','#eee1a2'];
const blendFonts=largestCompatibleSet(pool.filter(i=>!catalog[i].effect)),allowed=[...blendFonts,index('redacted')];
const storageKey='fontzero.attractors.v1';
let attractors:Attractor[]=[{id:'ambient',font:catalog[allowed[0]].id,mode:'ambient',x:.5,y:.5,radius:200,decay:2,vx:70,vy:55},{id:'cursor',font:catalog[allowed[1]??allowed[0]].id,mode:'cursor',x:.5,y:.5,radius:180,decay:2,vx:70,vy:55}];
let designMode=false,exporting=false;
let selected='cursor',within=false,wrap=false,light=false,showPoles=true,paused=false,placing=false,pointer:{x:number,y:number}|null=null;
text.value=poem;
try{const raw=localStorage.getItem(storageKey);if(raw){const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.attractors)||!s.attractors.length||typeof s.text!=='string'||!Number.isFinite(s.size)||!Number.isFinite(s.leading))throw new Error('Invalid saved attractor settings.');for(const a of s.attractors)if(!pool.includes(index(a.font))||!['placed','cursor','bounce','ambient'].includes(a.mode)||!['x','y','radius','decay','vx','vy'].every(k=>Number.isFinite(a[k]))||a.radius<=0||a.decay<0)throw new Error('Saved attractor has unavailable fonts or invalid values.');attractors=s.attractors;selected=attractors.some(a=>a.id===s.selected)?s.selected:attractors[0].id;text.value=s.text;size.value=String(s.size);leading.value=String(s.leading);if(Number.isFinite(s.padding))padding.value=String(s.padding);within=!!s.within;wrap=!!s.wrap;light=s.light===true;showPoles=s.showPoles!==false;paused=!!s.paused;designMode=!!s.designMode;if(typeof s.fontName==='string')$<HTMLInputElement>('font-export-name').value=s.fontName;if(typeof s.previewGlyph==='string')$<HTMLInputElement>('font-glyph').value=Array.from(s.previewGlyph)[0]??'A';}}catch(e){status.textContent=String(e);}
const current=()=>attractors.find(a=>a.id===selected)!;
const newId=()=>{let i=1;while(attractors.some(a=>a.id==='pole-'+i))i++;return 'pole-'+i;};
function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,attractors,selected,text:text.value,size:Number(size.value),leading:Number(leading.value),padding:Number(padding.value),within,wrap,light,showPoles,paused,designMode,fontName:$<HTMLInputElement>('font-export-name').value,previewGlyph:$<HTMLInputElement>('font-glyph').value}));}catch(e){status.textContent='Could not save settings: '+String(e);}}
const markers=new Map<string,HTMLButtonElement>();
function controls(){
 const a=current();$('design-font').textContent=designMode?'Text preview':'Design font';$('design-font').setAttribute('aria-pressed',String(designMode));$('font-export-controls').hidden=!designMode;$('sampling').hidden=designMode;$('wrap-text').hidden=designMode;document.documentElement.dataset.theme=light?'light':'dark';$('theme-toggle').textContent=light?'Dark mode':'Light mode';$('theme-toggle').setAttribute('aria-pressed',String(light));$('wrap-text').setAttribute('aria-pressed',String(wrap));$<HTMLInputElement>('size-value').value=size.value;$('line-value').textContent=leading.value;$('padding-value').textContent=padding.value;$('sampling').textContent=within?'Within letter':'Whole letter';$('sampling').setAttribute('aria-pressed',String(within));$('show-poles').textContent=showPoles?'Hide attractors':'Show attractors';$('show-poles').setAttribute('aria-pressed',String(showPoles));$('motion').textContent=paused?'Play motion':'Pause motion';$('motion').setAttribute('aria-pressed',String(paused));
 list.replaceChildren(...attractors.map((item,i)=>{const button=document.createElement('button');button.setAttribute('aria-pressed',String(item.id===selected));const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--pole-color',colors[i%colors.length]);const label=document.createElement('span');label.textContent=catalog[index(item.font)].name;const small=document.createElement('small');small.textContent={placed:'Placed on page',cursor:'Following cursor',bounce:'Bouncing ball',ambient:'Everywhere'}[item.mode];button.append(swatch,label,small);button.onclick=()=>{selected=item.id;controls();save();requestDraw();};return button;}));
 fontSelect.replaceChildren(...allowed.map(i=>{const option=document.createElement('option');option.value=catalog[i].id;option.textContent=catalog[i].name;option.disabled=!catalog[i].effect&&differentLetters([...attractors.filter(item=>item.id!==selected&&!catalog[index(item.font)].effect).map(item=>index(item.font)),i]).length>0;option.selected=a.font===catalog[i].id;return option;}));
 if(!allowed.includes(index(a.font))){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=catalog[index(a.font)].name;placeholder.disabled=true;placeholder.selected=true;fontSelect.prepend(placeholder);}
 $('selected-name').textContent='Attractor '+(attractors.indexOf(a)+1);mode.value=a.mode;radius.value=String(a.radius);decay.value=String(a.decay);speed.value=String(Math.round(Math.hypot(a.vx,a.vy)));$<HTMLInputElement>('radius-value').value=String(a.radius);$('decay-value').textContent=String(a.decay);$('speed-value').textContent=speed.value+' px/s';$('spatial-controls').hidden=a.mode==='ambient';$('speed-control').hidden=a.mode!=='bounce';$<HTMLButtonElement>('remove-attractor').disabled=attractors.length===1;
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
const rawRows=()=>text.value.replace(/\r/g,'').split('\n').map(row=>Array.from(row));
function rowsAt(em:number){const rows=rawRows();return wrap?wrapRows(rows,Math.max(1,view.clientWidth-2*Number(padding.value))*100/em,c=>referenceAdvances.get(c)??0):rows;}
function layout(){if(designMode){contentWidth=view.clientWidth;canvas.style.width='100%';canvas.style.height='100%';requestDraw();return;}const em=Number(size.value);lines=rowsAt(em);lineHeight=em*Number(leading.value);contentWidth=Math.max(0,...lines.map(row=>row.reduce((n,c)=>n+referenceAdvances.get(c)!,0)))*em/100+2*Number(padding.value);canvas.style.width=contentWidth+'px';canvas.style.height=(lines.length*lineHeight+2*Number(padding.value)+em*.3)+'px';surface.setAttribute('aria-label',text.value);$<HTMLInputElement>('size-value').value=size.value;$('line-value').textContent=leading.value;canvas.dataset.wrapped=String(wrap);requestDraw();}
async function rebuild(){
 const ticket=++revision;canvas.dataset.ready='false';$<HTMLButtonElement>('fit-text').disabled=true;status.textContent='Preparing font curves…';controls();save();
 try{
  const selectedSources=[...new Set(attractors.map(a=>index(a.font)))],regularSources=selectedSources.filter(i=>!catalog[i].effect);assertCompatible(regularSources);
  const base=regularSources[0]??blendFonts[0];
  const [reference,...instances]=await Promise.all([getFont('gf-librebaskerville'),...selectedSources.map(i=>getFont(catalog[catalog[i].effect?base:i].id)),getFont('redacted')]);if(ticket!==revision)return;
  redactedFont=instances.pop();redactedIndex=selectedSources.indexOf(index('redacted'));redactedPaths.clear();
  const forms=compatibleFormsFor(regularSources.every(i=>blendFonts.includes(i))?blendFonts:regularSources);sources=selectedSources;fonts=instances.map(f=>(f.source.variant?f.withConstructions(forms):f).getVariation({wght:450,wdth:100,slnt:0}));lines=text.value.replace(/\r/g,'').split('\n').map(row=>Array.from(row));glyphs.clear();referenceAdvances.clear();nativeAdvances.clear();
  let start=performance.now();
  for(const c of new Set(lines.flat())){
   const cp=c.codePointAt(0)!;if(c.trim())redactedPaths.set(c,new Path2D(sourcePath(redactedFont.glyphForCodePoint(cp).path.commands,0,0,100/redactedFont.unitsPerEm)));const gs=fonts.map(f=>f.glyphForCodePoint(cp));if(c.trim()&&gs.some(g=>g.id===0))throw new Error('A selected font has no “'+c+'” glyph.');referenceAdvances.set(c,reference.glyphForCodePoint(cp).advanceWidth/reference.unitsPerEm*100);nativeAdvances.set(c,gs.map((g,i)=>g.advanceWidth/fonts[i].unitsPerEm*100));if(c.trim())glyphs.set(c,prepareCanvasGlyph(gs,fonts,c));
   if(performance.now()-start>8){await pause();start=performance.now();if(ticket!==revision)return;}
  }
  prepared=ticket;layout();$<HTMLButtonElement>('fit-text').disabled=false;status.textContent='';delete canvas.dataset.error;
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
  if(a.mode!=='cursor'||pointer)poles.push({source:sources.indexOf(index(a.font)),x:x-rect.left-view.clientLeft,y:y-rect.top-view.clientTop,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'});
 });
 if(designMode&&prepared===revision){drawDesign();lastTime=0;return;}
 if(prepared===revision&&sources.length){
  try{
   const width=view.clientWidth,height=view.clientHeight,dpr=devicePixelRatio||1,scrollX=view.scrollLeft,scrollY=view.scrollTop,offset=Math.max(0,(width-contentWidth)/2),em=Number(size.value),pad=Number(padding.value);
   if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);surface.style.width=width+'px';surface.style.height=height+'px';}
   surface.style.left=(scrollX-offset)+'px';surface.style.top=scrollY+'px';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.fillStyle=getComputedStyle(view).color;
   const field=(x:number,y:number)=>attractionWeights(poles,sources.length,x,y),background=backgroundWeights(poles,sources.length),from=Math.max(0,Math.floor((scrollY-pad)/lineHeight)),to=Math.min(lines.length-1,Math.ceil((scrollY+height-pad)/lineHeight));
   const positioned:Array<{c:string,x:number,baseline:number,advance:number,blockAdvance:number}>=[];
   for(let r=from;r<=to;r++){
    const chars=lines[r],target=chars.reduce((n,c)=>n+referenceAdvances.get(c)!*em/100,0),baseline=pad+r*lineHeight+em-scrollY;
    const advances=chars.map(c=>nativeAdvances.get(c)!.reduce((n,a,i)=>n+a*background[i],0)*em/100),xs=linePositions(advances,target,pad);
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
const designGlyphs=new Map<string,ReturnType<typeof prepareDesignGlyph>>();
let designRevision=-1;
function designSetup(){
 const fixed=attractors.filter(a=>a.mode==='placed'||a.mode==='ambient');
 if(!fixed.length)throw new Error('Add a placed or Everywhere attractor.');
 if(fixed.some(a=>catalog[index(a.font)].effect)&&fixed.some(a=>!catalog[index(a.font)].effect))throw new Error('Redacted uses transparency. Choose an outline font for OTF export.');
 const indices=[...new Set(fixed.map(a=>sources.indexOf(index(a.font))))],rect=view.getBoundingClientRect();
 return {fonts:indices.map(i=>catalog[sources[i]].effect?redactedFont:fonts[i]),key:indices.join(','),frame:{width:view.clientWidth,height:view.clientHeight,size:Number(size.value)},poles:fixed.map(a=>({source:indices.indexOf(sources.indexOf(index(a.font))),x:a.x*innerWidth-rect.left-view.clientLeft,y:a.y*innerHeight-rect.top-view.clientTop,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'}))};
}
function drawDesign(){
 const dpr=devicePixelRatio||1,width=view.clientWidth,height=view.clientHeight;
 if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);surface.style.width=width+'px';surface.style.height=height+'px';}
 surface.style.left='0';surface.style.top='0';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.globalAlpha=1;
 try{
  const setup=designSetup(),character=Array.from($<HTMLInputElement>('font-glyph').value)[0]??'A',key=setup.key+':'+character;
  if(designRevision!==revision){designGlyphs.clear();designRevision=revision;}
  let glyph=designGlyphs.get(key);if(!glyph){glyph=prepareDesignGlyph(setup.fonts,character);designGlyphs.set(key,glyph);}
  const result=glyph(setup.poles,setup.frame),scale=dpr*setup.frame.size/100;
  context.setTransform(scale,0,0,scale,dpr*result.x,dpr*result.y);context.fillStyle=getComputedStyle(view).color;context.fill(new Path2D(result.d));
  canvas.dataset.ready='true';canvas.dataset.design='true';canvas.dataset.designPath=result.d;canvas.dataset.designOrigin=JSON.stringify([result.x,result.y]);surface.setAttribute('aria-label',character);delete canvas.dataset.error;
  $<HTMLButtonElement>('fit-text').disabled=false;$<HTMLButtonElement>('export-attractor-font').disabled=exporting;if(!exporting)status.textContent='';
 }catch(e){canvas.dataset.error=String(e);$<HTMLButtonElement>('fit-text').disabled=true;$<HTMLButtonElement>('export-attractor-font').disabled=true;if(!exporting)status.textContent=(e as Error).message;}
}
$('design-font').onclick=()=>{designMode=!designMode;$<HTMLButtonElement>('fit-text').disabled=prepared!==revision;delete canvas.dataset.error;status.textContent='';view.scrollTo(0,0);delete canvas.dataset.design;controls();layout();save();};
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
mode.onchange=()=>{const a=current();a.mode=mode.value as Attractor['mode'];if(a.mode==='bounce'){const r=view.getBoundingClientRect();a.x=(r.left+r.width*.5)/innerWidth;a.y=(r.top+r.height*.4)/innerHeight;}controls();save();requestDraw();};
for(const input of [radius,decay,speed])input.oninput=()=>{const a=current();a.radius=Number(radius.value);a.decay=Number(decay.value);if(input===speed){const length=Math.hypot(a.vx,a.vy)||1;a.vx=a.vx/length*Number(speed.value);a.vy=a.vy/length*Number(speed.value);}$<HTMLInputElement>('radius-value').value=radius.value;$('decay-value').textContent=decay.value;$('speed-value').textContent=speed.value+' px/s';save();requestDraw();};
$('add-attractor').onclick=()=>{const available=allowed,unused=available.find(i=>!attractors.some(a=>index(a.font)===i))??available[0],r=view.getBoundingClientRect();const a:Attractor={id:newId(),font:catalog[unused].id,mode:'placed',x:(r.left+r.width*.5)/innerWidth,y:(r.top+r.height*.5)/innerHeight,radius:180,decay:2,vx:70,vy:55};attractors.push(a);selected=a.id;void rebuild();};
$('remove-attractor').onclick=()=>{if(attractors.length===1)return;attractors=attractors.filter(a=>a.id!==selected);selected=attractors[0].id;void rebuild();};
$('show-poles').onclick=()=>{showPoles=!showPoles;controls();save();requestDraw();};$('motion').onclick=()=>{paused=!paused;controls();save();requestDraw();};$('sampling').onclick=()=>{within=!within;controls();save();requestDraw();};
const placeButton=$('place-attractor');placeButton.onclick=()=>{placing=!placing;layer.classList.toggle('placing',placing);placeButton.setAttribute('aria-pressed',String(placing));};
layer.addEventListener('pointerdown',e=>{if(!placing||e.target!==layer)return;const a=current();a.mode='placed';a.x=e.clientX/innerWidth;a.y=e.clientY/innerHeight;placing=false;layer.classList.remove('placing');placeButton.setAttribute('aria-pressed','false');controls();save();requestDraw();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&placing){placing=false;layer.classList.remove('placing');placeButton.setAttribute('aria-pressed','false');}});
window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(!designMode&&attractors.some(a=>a.mode==='cursor'))requestDraw();},{passive:true});document.documentElement.addEventListener('pointerleave',()=>{pointer=null;requestDraw();});
const sizeNumber=$<HTMLInputElement>('size-value');
sizeNumber.oninput=()=>{if(sizeNumber.validity.valid&&Number.isFinite(sizeNumber.valueAsNumber)){size.value=sizeNumber.value;size.dispatchEvent(new Event('input'));}};
sizeNumber.onblur=()=>{sizeNumber.value=size.value;};
for(const input of [size,leading,padding])input.oninput=()=>{if(prepared===revision)layout();controls();save();};
$('theme-toggle').onclick=()=>{light=!light;controls();save();requestDraw();};
$('wrap-text').onclick=()=>{wrap=!wrap;if(prepared===revision)layout();controls();save();};
$('fit-text').onclick=()=>{if(prepared!==revision)return;if(designMode){const setup=designSetup(),c=Array.from($<HTMLInputElement>('font-glyph').value)[0]??'A',metrics=prepareDesignGlyph(setup.fonts,c)(setup.poles,setup.frame),width=metrics.inkWidth/100,height=metrics.inkHeight/100;size.value=String(Math.max(1,Math.min(Number(size.max),Math.floor(Math.min((view.clientWidth-2*Number(padding.value))/Math.max(.01,width),(view.clientHeight-2*Number(padding.value))/Math.max(.01,height))*10)/10)));controls();layout();save();return;}if(wrap){let low=1,high=Number(size.max);for(let i=0;i<14;i++){const em=(low+high)/2,rows=rowsAt(em),height=rows.length*em*Number(leading.value)+2*Number(padding.value)+em*.3;const width=Math.max(0,...rows.map(row=>row.reduce((n,c)=>n+referenceAdvances.get(c)!,0)))*em/100+2*Number(padding.value);if(height<=view.clientHeight&&width<=view.clientWidth)low=em;else high=em;}size.value=String(Math.floor(low*10)/10);layout();controls();save();return;}const longest=Math.max(1,...lines.map(row=>row.reduce((n,c)=>n+referenceAdvances.get(c)!,0)))/100,fit=Math.min((view.clientWidth-2*Number(padding.value))/(longest+.25),(view.clientHeight-2*Number(padding.value))/(lines.length*Number(leading.value)+.3));size.value=String(Math.max(1,Math.min(Number(size.max),Math.floor(fit*10)/10)));layout();controls();save();};
let textTimer:number|undefined;text.oninput=()=>{save();clearTimeout(textTimer);textTimer=window.setTimeout(()=>void rebuild(),150);};$('edit-text').onclick=()=>{const editor=$('text-editor');editor.hidden=!editor.hidden;$('edit-text').setAttribute('aria-expanded',String(!editor.hidden));if(!editor.hidden)text.focus();};view.ondblclick=()=>{if($('text-editor').hidden)$('edit-text').click();};
view.addEventListener('scroll',requestDraw,{passive:true});new ResizeObserver(()=>{if(prepared===revision)layout();else requestDraw();}).observe(view);window.addEventListener('resize',requestDraw);document.addEventListener('visibilitychange',()=>{lastTime=0;requestDraw();});window.addEventListener('pagehide',save);
resizeCard('fontzero.attractors.card.v1');void rebuild();
