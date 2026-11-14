import {catalog} from './catalog';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {assertCompatible,differentLetters,compatibleFormsFor} from './compatibility';
import {prepareCanvasGlyph} from './canvas-glyph';
import {linePositions} from './demo-spacing';
import {resizeCard} from './demo-card';
import {poem} from './cursor-text';
import {attractionWeights,bounceAxis,type Attractor,type Pole} from './attractor-math';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const view=$('viewport'),canvas=$('text-canvas'),status=$('status'),layer=$('pole-layer'),list=$('attractor-list');
const text=$<HTMLTextAreaElement>('demo-text'),size=$<HTMLInputElement>('demo-size'),leading=$<HTMLInputElement>('line-height'),fontSelect=$<HTMLSelectElement>('attractor-font'),mode=$<HTMLSelectElement>('attractor-mode'),radius=$<HTMLInputElement>('radius'),decay=$<HTMLInputElement>('decay'),speed=$<HTMLInputElement>('speed'),construction=$<HTMLSelectElement>('construction-set');
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]),index=(id:string)=>catalog.findIndex(f=>f.id===id),colors=['#a9dcf5','#f0bb8b','#c5b2f5','#a6d7b0','#f1aebd','#eee1a2'];
const storageKey='fontzero.attractors.v1';
let attractors:Attractor[]=[{id:'ambient',font:'gf-librebaskerville',mode:'ambient',x:.5,y:.5,radius:200,decay:2,vx:70,vy:55},{id:'cursor',font:'gf-zillaslab',mode:'cursor',x:.5,y:.5,radius:180,decay:2,vx:70,vy:55}];
let selected='cursor',within=false,showPoles=true,paused=false,placing=false,pointer:{x:number,y:number}|null=null;
text.value=poem;
try{const raw=localStorage.getItem(storageKey);if(raw){const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.attractors)||!s.attractors.length||typeof s.text!=='string'||!Number.isFinite(s.size)||!Number.isFinite(s.leading))throw new Error('Invalid saved attractor settings.');for(const a of s.attractors)if(!pool.includes(index(a.font))||!['placed','cursor','bounce','ambient'].includes(a.mode)||!['x','y','radius','decay','vx','vy'].every(k=>Number.isFinite(a[k]))||a.radius<=0||a.decay<=0)throw new Error('Saved attractor has unavailable fonts or invalid values.');assertCompatible(s.attractors.map((a:Attractor)=>index(a.font)));attractors=s.attractors;selected=attractors.some(a=>a.id===s.selected)?s.selected:attractors[0].id;text.value=s.text;size.value=String(s.size);leading.value=String(s.leading);within=!!s.within;showPoles=s.showPoles!==false;paused=!!s.paused;}}catch(e){status.textContent=String(e);}
const current=()=>attractors.find(a=>a.id===selected)!;
const newId=()=>{let i=1;while(attractors.some(a=>a.id==='pole-'+i))i++;return 'pole-'+i;};
function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,attractors,selected,text:text.value,size:Number(size.value),leading:Number(leading.value),within,showPoles,paused}));}catch(e){status.textContent='Could not save settings: '+String(e);}}
const groups=new Map<string,number[]>();
for(const i of pool.filter(i=>!catalog[i].variant)){const members=pool.filter(j=>!catalog[j].variant&&!differentLetters([i,j]).length);groups.set(members.join(','),members);}
for(const [key,members] of groups){const o=document.createElement('option');o.value=key;o.textContent=members.map(i=>catalog[i].name).join(' / ');construction.append(o);}
const markers=new Map<string,HTMLButtonElement>();
function controls(){
 const a=current();$('size-value').textContent=size.value;$('line-value').textContent=leading.value;$('sampling').textContent=within?'Within letter':'Whole letter';$('sampling').setAttribute('aria-pressed',String(within));$('show-poles').textContent=showPoles?'Hide poles':'Show poles';$('show-poles').setAttribute('aria-pressed',String(showPoles));$('motion').textContent=paused?'Play motion':'Pause motion';$('motion').setAttribute('aria-pressed',String(paused));
 list.replaceChildren(...attractors.map((item,i)=>{const button=document.createElement('button');button.setAttribute('aria-pressed',String(item.id===selected));const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--pole-color',colors[i%colors.length]);const label=document.createElement('span');label.textContent=catalog[index(item.font)].name;const small=document.createElement('small');small.textContent={placed:'Placed on page',cursor:'Following cursor',bounce:'Bouncing ball',ambient:'Everywhere'}[item.mode];button.append(swatch,label,small);button.onclick=()=>{selected=item.id;controls();save();requestDraw();};return button;}));
 const others=attractors.filter(item=>item.id!==selected).map(item=>index(item.font));
 fontSelect.replaceChildren(...pool.filter(i=>!differentLetters([...others,i]).length).map(i=>{const option=document.createElement('option');option.value=catalog[i].id;option.textContent=catalog[i].name;option.selected=a.font===catalog[i].id;return option;}));
 $('selected-name').textContent='Attractor '+(attractors.indexOf(a)+1);mode.value=a.mode;radius.value=String(a.radius);decay.value=String(a.decay);speed.value=String(Math.round(Math.hypot(a.vx,a.vy)));$('radius-value').textContent=Math.round(a.radius)+' px';$('decay-value').textContent=String(a.decay);$('speed-value').textContent=speed.value+' px/s';$('spatial-controls').hidden=a.mode==='ambient';$('speed-control').hidden=a.mode!=='bounce';$<HTMLButtonElement>('remove-attractor').disabled=attractors.length===1;
 const group=[...groups].find(([,members])=>attractors.filter(a=>!catalog[index(a.font)].variant).every(a=>members.includes(index(a.font))));construction.value=group?.[0]??'';
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
let sources:number[]=[],fonts:any[]=[],lines:string[][]=[],contentWidth=0,lineHeight=0;
const glyphs=new Map<string,ReturnType<typeof prepareCanvasGlyph>>(),referenceAdvances=new Map<string,number>(),nativeAdvances=new Map<string,number[]>(),loaded=new Map<string,Promise<any>>();
const getFont=(id:string)=>{let promise=loaded.get(id);if(!promise){promise=loadFont(id);loaded.set(id,promise);}return promise;};
const surface=document.createElement('canvas');surface.setAttribute('role','img');canvas.append(surface);const context=surface.getContext('2d')!,ink=getComputedStyle(view).color;
const pause=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
function layout(){const em=Number(size.value);lineHeight=em*Number(leading.value);contentWidth=Math.max(0,...lines.map(row=>row.reduce((n,c)=>n+referenceAdvances.get(c)!,0)))*em/100+48;canvas.style.width=contentWidth+'px';canvas.style.height=(lines.length*lineHeight+48+em*.3)+'px';surface.setAttribute('aria-label',text.value);$('size-value').textContent=size.value;$('line-value').textContent=leading.value;requestDraw();}
async function rebuild(){
 const ticket=++revision;canvas.dataset.ready='false';$<HTMLButtonElement>('fit-text').disabled=true;status.textContent='Preparing font curves…';controls();save();
 try{
  const selectedSources=[...new Set(attractors.map(a=>index(a.font)))];assertCompatible(selectedSources);
  const [reference,...instances]=await Promise.all([getFont('gf-librebaskerville'),...selectedSources.map(i=>getFont(catalog[i].id))]);if(ticket!==revision)return;
  const forms=compatibleFormsFor(selectedSources);sources=selectedSources;fonts=instances.map(f=>(f.source.variant?f.withConstructions(forms):f).getVariation({wght:450,wdth:100,slnt:0}));lines=text.value.replace(/\r/g,'').split('\n').map(row=>Array.from(row));glyphs.clear();referenceAdvances.clear();nativeAdvances.clear();
  let start=performance.now();
  for(const c of new Set(lines.flat())){
   const cp=c.codePointAt(0)!,gs=fonts.map(f=>f.glyphForCodePoint(cp));if(c.trim()&&gs.some(g=>g.id===0))throw new Error('A selected font has no “'+c+'” glyph.');referenceAdvances.set(c,reference.glyphForCodePoint(cp).advanceWidth/reference.unitsPerEm*100);nativeAdvances.set(c,gs.map((g,i)=>g.advanceWidth/fonts[i].unitsPerEm*100));if(c.trim())glyphs.set(c,prepareCanvasGlyph(gs,fonts,c));
   if(performance.now()-start>8){await pause();start=performance.now();if(ticket!==revision)return;}
  }
  prepared=ticket;layout();$<HTMLButtonElement>('fit-text').disabled=false;status.textContent='';delete canvas.dataset.error;
 }catch(e){if(ticket===revision){canvas.dataset.error=String(e);status.textContent=String((e as Error).message);}}
}
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(time:number){
 frame=0;const seconds=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
 const rect=view.getBoundingClientRect();let moving=false;
 for(const a of attractors)if(a.mode==='bounce'&&!paused){const x=bounceAxis(Math.max(rect.left+10,Math.min(rect.right-10,a.x*innerWidth)),a.vx,seconds,rect.left+10,rect.right-10),y=bounceAxis(Math.max(rect.top+10,Math.min(rect.bottom-10,a.y*innerHeight)),a.vy,seconds,rect.top+10,rect.bottom-10);a.x=x.position/innerWidth;a.y=y.position/innerHeight;a.vx=x.velocity;a.vy=y.velocity;moving=true;}
 const poles:Pole[]=[];
 attractors.forEach((a,i)=>{
  const x=a.mode==='cursor'?pointer?.x??a.x*innerWidth:a.x*innerWidth,y=a.mode==='cursor'?pointer?.y??a.y*innerHeight:a.y*innerHeight,marker=markers.get(a.id)!;
  marker.hidden=a.mode==='ambient'||(a.mode==='cursor'&&(!pointer||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom))||(!showPoles&&a.mode!=='bounce');marker.dataset.mode=a.mode;marker.dataset.selected=String(a.id===selected);marker.style.transform=`translate(${x}px,${y}px)`;marker.style.setProperty('--pole-color',colors[i%colors.length]);marker.setAttribute('aria-label','Move '+catalog[index(a.font)].name+' attractor');marker.firstElementChild!.textContent=showPoles?catalog[index(a.font)].name:'';
  if(a.mode!=='cursor'||pointer)poles.push({source:sources.indexOf(index(a.font)),x:x-rect.left-view.clientLeft,y:y-rect.top-view.clientTop,radius:a.radius,decay:a.decay,ambient:a.mode==='ambient'});
 });
 if(prepared===revision&&sources.length){
  try{
   const width=view.clientWidth,height=view.clientHeight,dpr=devicePixelRatio||1,scrollX=view.scrollLeft,scrollY=view.scrollTop,offset=Math.max(0,(width-contentWidth)/2),em=Number(size.value);
   if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);surface.style.width=width+'px';surface.style.height=height+'px';}
   surface.style.left=(scrollX-offset)+'px';surface.style.top=scrollY+'px';context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.fillStyle=ink;
   const field=(x:number,y:number)=>attractionWeights(poles,sources.length,x,y),from=Math.max(0,Math.floor((scrollY-24)/lineHeight)),to=Math.min(lines.length-1,Math.ceil((scrollY+height-24)/lineHeight));
   for(let r=from;r<=to;r++){
    const chars=lines[r],target=chars.reduce((n,c)=>n+referenceAdvances.get(c)!*em/100,0),baseline=24+r*lineHeight+em-scrollY;
    let xs=linePositions(chars.map(c=>referenceAdvances.get(c)!*em/100),target,24),advances:number[]=[];
    for(let pass=0;pass<2;pass++){advances=chars.map((c,j)=>{const weights=field(offset+xs[j]-scrollX,baseline-em*.4);return nativeAdvances.get(c)!.reduce((n,a,i)=>n+a*weights[i],0)*em/100;});xs=linePositions(advances,target,24);}
    for(let j=0;j<chars.length;j++){const c=chars[j],x=offset+xs[j]-scrollX;if(!c.trim()||x+advances[j]<-em||x>width+em)continue;const weights=field(x+advances[j]/2,baseline-em*.4);context.setTransform(dpr*em/100,0,0,dpr*em/100,dpr*x,dpr*baseline);glyphs.get(c)!.paint(context,weights,within?(gx,gy)=>field(x+gx*em/100,baseline+gy*em/100):undefined);}
   }
   canvas.dataset.ready='true';canvas.dataset.sampling=within?'within':'letter';canvas.dataset.scrollY=String(scrollY);canvas.dataset.attractors=JSON.stringify(attractors.map(a=>({id:a.id,x:a.x,y:a.y,mode:a.mode,font:a.font})));canvas.dataset.lineHeight=String(lineHeight);
  }catch(e){status.textContent=String(e);canvas.dataset.error=String(e);moving=false;}
 }
 if(moving&&!document.hidden)requestDraw();else lastTime=0;
}
fontSelect.onchange=()=>{current().font=fontSelect.value;void rebuild();};
mode.onchange=()=>{const a=current();a.mode=mode.value as Attractor['mode'];if(a.mode==='bounce'){const r=view.getBoundingClientRect();a.x=(r.left+r.width*.5)/innerWidth;a.y=(r.top+r.height*.4)/innerHeight;}controls();save();requestDraw();};
for(const input of [radius,decay,speed])input.oninput=()=>{const a=current();a.radius=Number(radius.value);a.decay=Number(decay.value);if(input===speed){const length=Math.hypot(a.vx,a.vy)||1;a.vx=a.vx/length*Number(speed.value);a.vy=a.vy/length*Number(speed.value);}$('radius-value').textContent=radius.value+' px';$('decay-value').textContent=decay.value;$('speed-value').textContent=speed.value+' px/s';save();requestDraw();};
$('add-attractor').onclick=()=>{const available=pool.filter(i=>!differentLetters([...attractors.map(a=>index(a.font)),i]).length),unused=available.find(i=>!attractors.some(a=>index(a.font)===i))??available[0],r=view.getBoundingClientRect();const a:Attractor={id:newId(),font:catalog[unused].id,mode:'placed',x:(r.left+r.width*.5)/innerWidth,y:(r.top+r.height*.5)/innerHeight,radius:180,decay:2,vx:70,vy:55};attractors.push(a);selected=a.id;void rebuild();};
$('remove-attractor').onclick=()=>{if(attractors.length===1)return;attractors=attractors.filter(a=>a.id!==selected);selected=attractors[0].id;void rebuild();};
construction.onchange=()=>{const members=groups.get(construction.value)!;attractors.forEach((a,i)=>a.font=catalog[members[i%members.length]].id);void rebuild();};
$('show-poles').onclick=()=>{showPoles=!showPoles;controls();save();requestDraw();};$('motion').onclick=()=>{paused=!paused;controls();save();requestDraw();};$('sampling').onclick=()=>{within=!within;controls();save();requestDraw();};
const placeButton=$('place-attractor');placeButton.onclick=()=>{placing=!placing;layer.classList.toggle('placing',placing);placeButton.setAttribute('aria-pressed',String(placing));};
layer.addEventListener('pointerdown',e=>{if(!placing||e.target!==layer)return;const a=current();a.mode='placed';a.x=e.clientX/innerWidth;a.y=e.clientY/innerHeight;placing=false;layer.classList.remove('placing');placeButton.setAttribute('aria-pressed','false');controls();save();requestDraw();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&placing){placing=false;layer.classList.remove('placing');placeButton.setAttribute('aria-pressed','false');}});
window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(attractors.some(a=>a.mode==='cursor'))requestDraw();},{passive:true});document.documentElement.addEventListener('pointerleave',()=>{pointer=null;requestDraw();});
for(const input of [size,leading])input.oninput=()=>{if(prepared===revision)layout();controls();save();};
$('fit-text').onclick=()=>{if(prepared!==revision)return;const longest=Math.max(1,...lines.map(row=>row.reduce((n,c)=>n+referenceAdvances.get(c)!,0)))/100,fit=Math.min((view.clientWidth-48)/(longest+.25),(view.clientHeight-48)/(lines.length*Number(leading.value)+.3));size.value=String(Math.max(1,Math.min(128,Math.floor(fit*10)/10)));layout();controls();save();};
let textTimer:number|undefined;text.oninput=()=>{save();clearTimeout(textTimer);textTimer=window.setTimeout(()=>void rebuild(),150);};$('edit-text').onclick=()=>{const editor=$('text-editor');editor.hidden=!editor.hidden;$('edit-text').setAttribute('aria-expanded',String(!editor.hidden));if(!editor.hidden)text.focus();};view.ondblclick=()=>{if($('text-editor').hidden)$('edit-text').click();};
view.addEventListener('scroll',requestDraw,{passive:true});new ResizeObserver(requestDraw).observe(view);window.addEventListener('resize',requestDraw);document.addEventListener('visibilitychange',()=>{lastTime=0;requestDraw();});window.addEventListener('pagehide',save);
resizeCard('fontzero.attractors.card.v1');void rebuild();
