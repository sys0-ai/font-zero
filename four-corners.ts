import {catalog} from './catalog';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {assertCompatible,differentLetters,papyrusFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import {sourceWeights} from './four-corners-math';
import {boots} from './four-corners-text';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const viewport=$('poem-viewport'),canvas=$('poem-canvas'),status=$('demo-status'),text=$<HTMLTextAreaElement>('demo-text'),size=$<HTMLInputElement>('demo-size'),set=$<HTMLSelectElement>('font-set');
const pickers=[0,1,2,3].map(i=>$<HTMLSelectElement>('corner-'+i));
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]);
const groups=new Map<string,number[]>();
for(const i of pool.filter(i=>!catalog[i].variant)){
 const members=pool.filter(j=>!catalog[j].variant&&!differentLetters([i,j]).length),key=members.join(',');groups.set(key,members);
}
for(const [key,members] of groups){const option=document.createElement('option');option.value=key;option.textContent=members.map(i=>catalog[i].name).join(' / ')+` (${members.length} font${members.length===1?'':'s'})`;set.append(option);}
let corners=['gf-inter','gf-raleway','gf-librebaskerville','gf-zillaslab'].map(id=>catalog.findIndex(f=>f.id===id));
text.value=boots;
const storageKey='fontzero.four-corners.v1';let storedScroll:number[]|undefined;
function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,fonts:corners.map(i=>catalog[i].id),size:Number(size.value),text:text.value,scroll:[viewport.scrollLeft,viewport.scrollTop],editor:!$('text-editor').hidden}));}catch{status.textContent='This browser could not save the demo settings.';}}
try{
 const raw=localStorage.getItem(storageKey);
 if(raw){const s=JSON.parse(raw),ids=s.fonts?.map((id:string)=>catalog.findIndex(f=>f.id===id));if(s.version!==1||ids?.length!==4||ids.some((i:number)=>!pool.includes(i))||typeof s.text!=='string'||!Number.isFinite(s.size))throw new Error('The saved demo uses unavailable fonts or settings.');assertCompatible(ids);corners=ids;text.value=s.text;size.value=String(s.size);storedScroll=s.scroll??[0,0];$('text-editor').hidden=!s.editor;}
}catch(error){status.textContent=String(error);}
function controls(){
 pickers.forEach((picker,corner)=>{
  picker.replaceChildren(...pool.filter(i=>!differentLetters(corners.map((value,j)=>j===corner?i:value)).length).map(i=>{const option=document.createElement('option');option.value=String(i);option.textContent=catalog[i].name;option.selected=corners[corner]===i;return option;}));
 });
 const group=[...groups].find(([,members])=>corners.filter(i=>!catalog[i].variant).every(i=>members.includes(i)));set.value=group?.[0]??'';
 $('demo-size-value').textContent=size.value;$('edit-text').setAttribute('aria-expanded',String(!$('text-editor').hidden));
}
let preparedRevision=-1;
let revision=0,fonts:any[]=[],sources:number[]=[],lines:string[][]=[],lineHeight=0,contentWidth=0;
const advances=new Map<string,number[]>();
const glyphs=new Map<string,ReturnType<typeof prepareGlyph>>(),loaded=new Map<number,any>();
let pending=false,drawing=false,frame=0;
const pause=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function rebuild(){
 const ticket=++revision;controls();save();status.textContent='Drawing four-font blend…';canvas.dataset.ready='false';canvas.replaceChildren();glyphs.clear();advances.clear();
 try{
  const selected=[...new Set(corners)];assertCompatible(selected);
  const instances=await Promise.all(selected.map(async i=>{if(!loaded.has(i))loaded.set(i,await loadFont(catalog[i].id));return loaded.get(i);}));if(ticket!==revision)return;
  const forms=papyrusFormsFor(selected);sources=selected;fonts=instances.map(f=>(f.source.variant?f.withConstructions(forms):f).getVariation({wght:450,wdth:100,slnt:0}));
  while(loaded.size>8){const old=[...loaded.keys()].find(i=>!selected.includes(i));if(old===undefined)break;loaded.delete(old);}
  lines=text.value.replace(/\r/g,'').split('\n').map(line=>Array.from(line));
  for(const character of new Set(lines.flat().filter(c=>c.trim())))for(const font of fonts)if(font.glyphForCodePoint(character.codePointAt(0)!).id===0)throw new Error(`${font.source.name} has no “${character}” glyph.`);
  for(const c of new Set(lines.flat()))advances.set(c,fonts.map(f=>f.glyphForCodePoint(c.codePointAt(0)!).advanceWidth*100/f.unitsPerEm));
  // A sum of per-character maximum advances bounds every mixture without
  // inserting extra space between letters or justifying short lines.
  const naturalWidth=Math.max(0,...lines.map(line=>line.reduce((sum,c)=>sum+Math.max(...advances.get(c)!),0)))*Number(size.value)/100;
  lineHeight=Number(size.value)*1.8;contentWidth=naturalWidth+96;
  canvas.dataset.fieldWidth=String(viewport.clientWidth);
  canvas.style.width=contentWidth+'px';canvas.style.height=(lines.length*lineHeight+80)+'px';
  if(storedScroll){viewport.scrollLeft=storedScroll[0]||Math.max(0,(contentWidth-viewport.clientWidth)/2);viewport.scrollTop=storedScroll[1];storedScroll=undefined;}else viewport.scrollLeft=Math.max(0,(contentWidth-viewport.clientWidth)/2);
  preparedRevision=ticket;requestDraw();
 }catch(error){if(ticket===revision){status.textContent=String((error as Error).message);canvas.dataset.error=String(error);}}
}
function requestDraw(){pending=true;if(!frame&&!drawing)frame=requestAnimationFrame(()=>{frame=0;void draw();});}
async function draw(){
 if(preparedRevision!==revision||!fonts.length||!lines.length)return;drawing=true;pending=false;const ticket=revision;
 try{
  const scrollX=viewport.scrollLeft,scrollY=viewport.scrollTop,viewWidth=viewport.clientWidth,viewHeight=viewport.clientHeight,offsetX=Math.max(0,(viewWidth-contentWidth)/2);
  const paintKey=[ticket,scrollX,scrollY,viewWidth,viewHeight].join(':');
  const from=Math.max(0,Math.floor((scrollY-40)/lineHeight)-1),to=Math.min(lines.length-1,Math.ceil((scrollY+viewHeight-40)/lineHeight)+1);
  for(const row of Array.from(canvas.children))if(Number((row as HTMLElement).dataset.row)<from||Number((row as HTMLElement).dataset.row)>to)row.remove();
  let started=performance.now();
  for(let r=from;r<=to;r++){
   const previous=canvas.querySelector<SVGSVGElement>(`[data-row="${r}"]`);
   if(previous?.dataset.paint===paintKey||!lines[r].length)continue;
   const chars=lines[r],first=chars.findIndex(c=>c.trim()),last=chars.findLastIndex(c=>c.trim());if(first<0)continue;
   const row=document.createElementNS('http://www.w3.org/2000/svg','svg');row.dataset.row=String(r);row.dataset.paint=paintKey;row.setAttribute('width',String(contentWidth));row.setAttribute('height',String(lineHeight));row.setAttribute('viewBox',`0 0 ${contentWidth} ${lineHeight}`);row.style.top=40+r*lineHeight+'px';row.setAttribute('role','img');row.setAttribute('aria-label',chars.join(''));
   let cursor=0;
   for(let j=0;j<=last;j++){
    const c=chars[j],em=Number(size.value),u=Math.max(0,Math.min(1,(offsetX+48+cursor-scrollX)/viewWidth)),v=Math.max(0,Math.min(1,(40+r*lineHeight+em*.75-scrollY)/viewHeight)),weights=sourceWeights(corners,sources,u,v);
    const advance=advances.get(c)!.reduce((sum,a,i)=>sum+a*weights[i],0)*em/100,x=48+cursor;cursor+=advance;
    if(!c.trim()||offsetX+x+advance-scrollX < -em||offsetX+x-scrollX>viewWidth+em)continue;
    let glyph=glyphs.get(c);if(!glyph){glyph=prepareGlyph(fonts.map(f=>f.glyphForCodePoint(c.codePointAt(0)!)),fonts,c,fonts.map((_,i)=>i));glyphs.set(c,glyph);}
    const d=glyph.draw(weights,0,true);
    const path=document.createElementNS(row.namespaceURI,'path');path.setAttribute('d',d);path.setAttribute('transform',`translate(${x} ${em*1.1}) scale(${em/100})`);path.setAttribute('fill-rule','nonzero');path.dataset.character=c;path.dataset.column=String(j);path.dataset.x=String(x);path.dataset.advance=String(advance);path.dataset.weights=JSON.stringify(weights);path.dataset.uv=JSON.stringify([u,v]);row.append(path);
    if(performance.now()-started>10){await pause();started=performance.now();if(ticket!==revision)return;}
   }
   if(ticket!==revision)return;if(previous)previous.replaceWith(row);else canvas.append(row);
  }
  if(ticket===revision){canvas.dataset.ready='true';delete canvas.dataset.error;canvas.dataset.sources=JSON.stringify(sources);canvas.dataset.scrollX=String(scrollX);canvas.dataset.scrollY=String(scrollY);canvas.dataset.viewWidth=String(viewWidth);canvas.dataset.viewHeight=String(viewHeight);canvas.dataset.offsetX=String(offsetX);status.textContent='Viewport corners stay fixed · scroll to morph the text';}
 }catch(error){if(ticket===revision){status.textContent=String((error as Error).message);canvas.dataset.error=String(error);}}
 finally{drawing=false;if(pending)requestDraw();}
}
pickers.forEach((picker,i)=>picker.addEventListener('change',()=>{corners[i]=Number(picker.value);void rebuild();}));
set.addEventListener('change',()=>{const members=groups.get(set.value)!;corners=Array.from({length:4},(_,i)=>members[i%members.length]);void rebuild();});
let resizeTimer:number|undefined,inputTimer:number|undefined;
size.addEventListener('input',()=>{window.clearTimeout(inputTimer);$('demo-size-value').textContent=size.value;inputTimer=window.setTimeout(()=>void rebuild(),60);});
text.addEventListener('input',()=>{window.clearTimeout(inputTimer);inputTimer=window.setTimeout(()=>void rebuild(),180);});
$('edit-text').onclick=()=>{$('text-editor').hidden=!$('text-editor').hidden;controls();save();requestDraw();};
viewport.addEventListener('scroll',()=>{requestDraw();window.clearTimeout(resizeTimer);resizeTimer=window.setTimeout(save,150);},{passive:true});
new ResizeObserver(()=>{requestDraw();}).observe(viewport);
window.addEventListener('pagehide',save);
void rebuild();
