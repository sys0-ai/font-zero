import {catalog} from './catalog';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {differentLetters,compatibleFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import {cursorInfluence} from './cursor-math';
import {poem} from './cursor-text';
import {resizeCard} from './demo-card';
import {linePositions} from './demo-spacing';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const base=$<HTMLSelectElement>('base-font'),accent=$<HTMLSelectElement>('cursor-font'),radius=$<HTMLInputElement>('radius'),decay=$<HTMLInputElement>('decay'),viewport=$('cursor-viewport'),svg=document.getElementById('cursor-poem')! as unknown as SVGSVGElement,status=$('cursor-status');
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]);
let selected=['gf-librebaskerville','gf-zillaslab'].map(id=>catalog.findIndex(f=>f.id===id));
const key='fontzero.cursor.v1',text=$<HTMLTextAreaElement>('demo-text'),size=$<HTMLInputElement>('demo-size');text.value=poem;let within=false;
try{const raw=localStorage.getItem(key);if(raw){const s=JSON.parse(raw),ids=s.fonts.map((id:string)=>catalog.findIndex(f=>f.id===id));if(ids.length===2&&ids.every((i:number)=>pool.includes(i))&&!differentLetters(ids).length){selected=ids;if(typeof s.text==='string')text.value=s.text;if(Number.isFinite(s.size))size.value=String(s.size);within=s.within===true;if(Number.isFinite(s.radius))radius.value=String(s.radius);if(Number.isFinite(s.decay))decay.value=String(s.decay);}}}catch{status.textContent='Could not restore cursor settings.';}
function save(){try{localStorage.setItem(key,JSON.stringify({fonts:selected.map(i=>catalog[i].id),radius:Number(radius.value),decay:Number(decay.value),text:text.value,size:Number(size.value),within}));}catch{status.textContent='Could not save cursor settings.';}}
function controls(){
 for(const [picker,indices,value] of [[base,pool,selected[0]],[accent,pool.filter(i=>!differentLetters([selected[0],i]).length),selected[1]]] as const){picker.replaceChildren(...indices.map(i=>{const o=document.createElement('option');o.value=String(i);o.textContent=catalog[i].name;o.selected=i===value;return o;}));}
 $('demo-size-value').textContent=size.value;$('blend-sampling').textContent=within?'Within letter':'Whole letter';$('blend-sampling').setAttribute('aria-pressed',String(within));
 $('radius-value').textContent=radius.value+' px';$('decay-value').textContent=String(Number(decay.value));
}
type Shape=ReturnType<typeof prepareGlyph>;
type Letter={path:SVGPathElement,x:number,y:number,shape:Shape,last:number};
type Row={chars:string[],advances:number[][],target:number,xs:number[],letters:Map<number,Letter>,baseline:number};
let rows:Row[]=[];
let letters:Letter[]=[],revision=0,frame=0,pointer:{x:number,y:number}|null=null;
let em=Number(size.value),lineHeight=em*1.8;const padding=48;
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(){
 frame=0;const rect=svg.getBoundingClientRect(),view=viewport.getBoundingClientRect();
 const px=pointer?pointer.x-rect.left:0,py=pointer?pointer.y-rect.top:0;
 for(const row of rows){
  if(rect.top+row.baseline<view.top-em||rect.top+row.baseline>view.bottom+em)continue;
  const influence=(x:number,y:number)=>pointer?cursorInfluence(Math.hypot(x-px,y-py),Number(radius.value),Number(decay.value)):0;
  for(let pass=0;pass<2;pass++)row.xs=linePositions(row.advances.map((a,j)=>{const w=influence(row.xs[j]+a[0]/2,row.baseline-em*.4);return a[0]*(1-w)+a[1]*w;}),row.target);
  for(const [j,letter] of row.letters){
   const x=row.xs[j],weight=influence(x+row.advances[j][0]/2,row.baseline-em*.4);
   letter.path.setAttribute('transform',`translate(${x} ${row.baseline}) scale(${em/100})`);
   if(weight===letter.last&&!within)continue;
   const d=within&&pointer?letter.shape.drawField((gx,gy)=>{const w=influence(x+gx*em/100,row.baseline+gy*em/100);return [1-w,w];},0,true):letter.shape.draw([1-weight,weight],0,true);
   letter.path.setAttribute('d',d);letter.path.dataset.weight=String(weight);letter.last=weight;
  }
 }
 svg.dataset.pointer=pointer?'active':'none';
}
async function rebuild(){
 const ticket=++revision;em=Number(size.value);lineHeight=em*1.8;controls();save();status.textContent='Drawing fonts…';svg.dataset.ready='false';
 try{
  const forms=compatibleFormsFor(selected);
  const reference=(await loadFont('gf-librebaskerville')).getVariation({wght:450,wdth:100,slnt:0});
  const fonts=await Promise.all(selected.map(async i=>{let f=await loadFont(catalog[i].id);if(f.source.variant)f=f.withConstructions(forms);return f.getVariation({wght:450,wdth:100,slnt:0});}));if(ticket!==revision)return;
  const shapes=new Map<string,Shape>(),fragment=document.createDocumentFragment(),next:Letter[]=[],nextRows:Row[]=[];let width=0;
  const lines=text.value.replace(/\r/g,'').split('\n');
  for(let r=0;r<lines.length;r++){
   const chars=Array.from(lines[r]),target=chars.reduce((n,c)=>n+reference.glyphForCodePoint(c.codePointAt(0)!).advanceWidth/reference.unitsPerEm*em,0),advances=chars.map(c=>fonts.map(f=>f.glyphForCodePoint(c.codePointAt(0)!).advanceWidth/f.unitsPerEm*em)),xs=linePositions(advances.map(a=>a[0]),target);
   const row:Row={chars,advances,target,xs,letters:new Map(),baseline:padding+r*lineHeight+em};nextRows.push(row);
   for(let j=0;j<chars.length;j++){
    const c=chars[j],x=xs[j];
    const glyphs=fonts.map(f=>f.glyphForCodePoint(c.codePointAt(0)!));
    if(glyphs.some(g=>g.id===0))throw new Error(`The selected font has no “${c}” glyph.`);
    // A shared reference keeps the layout unchanged across font selections.
    const advance=reference.glyphForCodePoint(c.codePointAt(0)!).advanceWidth/reference.unitsPerEm*em;
    if(c.trim()){
     let shape=shapes.get(c);if(!shape){shape=prepareGlyph(glyphs,fonts,c,[0,1]);shapes.set(c,shape);}
     const path=document.createElementNS(svg.namespaceURI,'path') as SVGPathElement;
     path.setAttribute('transform',`translate(${x} ${padding+r*lineHeight+em}) scale(${em/100})`);path.dataset.character=c;path.dataset.weight='0';path.setAttribute('d',shape.draw([1,0],0,true));fragment.append(path);
     const letter={path,x:x+advance/2,y:padding+r*lineHeight+em*.6,shape,last:0};next.push(letter);row.letters.set(j,letter);
    }
   }
   width=Math.max(width,target+padding*2);
  }
  svg.setAttribute('aria-label',text.value);svg.setAttribute('width',String(Math.max(width,96)));svg.setAttribute('height',String(lines.length*lineHeight+padding*2));svg.replaceChildren(fragment);letters=next;rows=nextRows;
  svg.dataset.ready='true';delete svg.dataset.error;status.textContent='Move your cursor over the poem';requestDraw();
 }catch(error){if(ticket===revision){status.textContent=(error as Error).message;svg.dataset.error=String(error);}}
}
base.onchange=()=>{selected[0]=Number(base.value);if(differentLetters(selected).length)selected[1]=pool.find(i=>i!==selected[0]&&!differentLetters([selected[0],i]).length)??selected[0];void rebuild();};
accent.onchange=()=>{selected[1]=Number(accent.value);void rebuild();};
for(const input of [radius,decay])input.oninput=()=>{controls();save();requestDraw();};
viewport.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};requestDraw();});
viewport.addEventListener('pointerleave',()=>{pointer=null;requestDraw();});
viewport.addEventListener('scroll',requestDraw,{passive:true});
new ResizeObserver(requestDraw).observe(viewport);
void rebuild();

resizeCard('fontzero.cursor.card.v1');
let editTimer:number|undefined;
text.oninput=()=>{save();clearTimeout(editTimer);editTimer=window.setTimeout(()=>void rebuild(),150);};
size.oninput=()=>void rebuild();
$('edit-text').onclick=()=>{const editor=$('text-editor');editor.hidden=!editor.hidden;$('edit-text').setAttribute('aria-expanded',String(!editor.hidden));if(!editor.hidden)text.focus();};
viewport.ondblclick=()=>{if($('text-editor').hidden)$('edit-text').click();};
$('blend-sampling').onclick=()=>{within=!within;controls();save();letters.forEach(l=>l.last=-1);requestDraw();};
