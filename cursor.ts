import {catalog} from './catalog';
import {localFonts} from './runtime';
import {loadFont} from './font-library';
import {differentLetters,papyrusFormsFor} from './compatibility';
import {prepareGlyph} from './render';
import {cursorInfluence} from './cursor-math';
import {poem} from './cursor-text';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const base=$<HTMLSelectElement>('base-font'),accent=$<HTMLSelectElement>('cursor-font'),radius=$<HTMLInputElement>('radius'),decay=$<HTMLInputElement>('decay'),viewport=$('cursor-viewport'),svg=document.getElementById('cursor-poem')! as unknown as SVGSVGElement,status=$('cursor-status');
const pool=catalog.flatMap((f,i)=>(f.asset||(localFonts&&f.file))?[i]:[]);
let selected=['gf-librebaskerville','gf-zillaslab'].map(id=>catalog.findIndex(f=>f.id===id));
const key='fontzero.cursor.v1';
try{const raw=localStorage.getItem(key);if(raw){const s=JSON.parse(raw),ids=s.fonts.map((id:string)=>catalog.findIndex(f=>f.id===id));if(ids.length===2&&ids.every((i:number)=>pool.includes(i))&&!differentLetters(ids).length){selected=ids;if(Number.isFinite(s.radius))radius.value=String(s.radius);if(Number.isFinite(s.decay))decay.value=String(s.decay);}}}catch{status.textContent='Could not restore cursor settings.';}
function save(){try{localStorage.setItem(key,JSON.stringify({fonts:selected.map(i=>catalog[i].id),radius:Number(radius.value),decay:Number(decay.value)}));}catch{status.textContent='Could not save cursor settings.';}}
function controls(){
 for(const [picker,indices,value] of [[base,pool,selected[0]],[accent,pool.filter(i=>!differentLetters([selected[0],i]).length),selected[1]]] as const){picker.replaceChildren(...indices.map(i=>{const o=document.createElement('option');o.value=String(i);o.textContent=catalog[i].name;o.selected=i===value;return o;}));}
 $('radius-value').textContent=radius.value+' px';$('decay-value').textContent=String(Number(decay.value));
}
type Shape=ReturnType<typeof prepareGlyph>;
type Letter={path:SVGPathElement,x:number,y:number,shape:Shape,last:number};
let letters:Letter[]=[],revision=0,frame=0,pointer:{x:number,y:number}|null=null;
const em=36,lineHeight=64,padding=48;
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(){
 frame=0;const rect=svg.getBoundingClientRect(),view=viewport.getBoundingClientRect();
 const px=pointer?pointer.x-rect.left:0,py=pointer?pointer.y-rect.top:0;
 for(const letter of letters){
  if(rect.top+letter.y<view.top-em||rect.top+letter.y>view.bottom+em)continue;
  const weight=pointer?cursorInfluence(Math.hypot(letter.x-px,letter.y-py),Number(radius.value),Number(decay.value)):0;
  if(weight===letter.last)continue;
  letter.path.setAttribute('d',letter.shape.draw([1-weight,weight],0,true));letter.path.dataset.weight=String(weight);letter.last=weight;
 }
 svg.dataset.pointer=pointer?'active':'none';
}
async function rebuild(){
 const ticket=++revision;controls();save();status.textContent='Drawing fonts…';svg.dataset.ready='false';
 try{
  const forms=papyrusFormsFor(selected);
  const fonts=await Promise.all(selected.map(async i=>{let f=await loadFont(catalog[i].id);if(f.source.variant)f=f.withConstructions(forms);return f.getVariation({wght:450,wdth:100,slnt:0});}));if(ticket!==revision)return;
  const shapes=new Map<string,Shape>(),fragment=document.createDocumentFragment(),next:Letter[]=[];let width=0;
  const lines=poem.split('\n');
  for(let r=0;r<lines.length;r++){
   let x=padding;
   for(const c of lines[r]){
    const glyphs=fonts.map(f=>f.glyphForCodePoint(c.codePointAt(0)!));
    if(glyphs.some(g=>g.id===0))throw new Error(`The selected font has no “${c}” glyph.`);
    // Positions remain tied to the base font while the cursor changes outlines.
    const advance=glyphs[0].advanceWidth/fonts[0].unitsPerEm*em;
    if(c.trim()){
     let shape=shapes.get(c);if(!shape){shape=prepareGlyph(glyphs,fonts,c,[0,1]);shapes.set(c,shape);}
     const path=document.createElementNS(svg.namespaceURI,'path') as SVGPathElement;
     path.setAttribute('transform',`translate(${x} ${padding+r*lineHeight+em}) scale(${em/100})`);path.dataset.character=c;path.dataset.weight='0';path.setAttribute('d',shape.draw([1,0],0,true));fragment.append(path);
     next.push({path,x:x+advance/2,y:padding+r*lineHeight+em*.6,shape,last:0});
    }
    x+=advance;
   }
   width=Math.max(width,x+padding);
  }
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(lines.length*lineHeight+padding*2));svg.replaceChildren(fragment);letters=next;
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
