import {staticCommands} from './static-axes';
import {sourcePath,type Command} from './curves';
import {pathCurves} from './outline-union';
import {healWords,inkOf,transformInk,wordIds,type Ink} from './word-healing';
import {flowWeights,type TransitionSampling,type FlowContext} from './field';
import {finishPath} from './edge-texture';
import {sharedClusters,clusterGlyph} from './shaping';
import {axes,features,prepareGlyph,mix,progression,pause,type Settings} from './render';
import type {Weights} from './weights';
import {tokenColors} from './specimens';
export function wrapText(text:string,columns=48){return text.split('\n').flatMap(line=>{const lines:string[]=[];while(line.length>columns){let cut=line.lastIndexOf(' ',columns);if(cut<1)cut=columns;lines.push(line.slice(0,cut));line=line.slice(cut).replace(/^ /,'');}lines.push(line);return lines;});}
export class TextPreview {
 private rendered?:{html:string;settings:Settings;commands?:Command[][]};
 previewAxes(settings:Settings){
  const base=this.rendered;if(!base)return;
  const width=settings.wdth/base.settings.wdth,weight=settings.wght-base.settings.wght,slant=settings.slnt-base.settings.slnt;
  if(Math.abs(width-1)+Math.abs(weight)+Math.abs(slant)<1e-8){if(this.svg.dataset.axisPreview==='true')this.svg.innerHTML=base.html;this.svg.dataset.axisPreview='false';return;}
  base.commands??=[...base.html.matchAll(/ d="([^"]*)"/g)].map(m=>pathCurves(m[1]).flatMap(c=>[
   {command:'moveTo',args:[c[0][0][0],-c[0][0][1]]},...c.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0],-p[1]])})),{command:'closePath',args:[]}
  ]));
  let index=0;
  this.svg.innerHTML=base.html.replace(/ d="([^"]*)"/g,()=>` d="${sourcePath(staticCommands(base.commands![index++],100,{wght:450+weight,wdth:width*100,slnt:slant}))}"`).replace(/translate\(([\d.e+-]+) /g,(_,x)=>'translate('+(Number(x)*width)+' ');
  this.svg.dataset.axisPreview='true';
 }
 private page=0;pages=1;
 movePage(delta:number){this.page=Math.max(0,Math.min(this.pages-1,this.page+delta));}
 private prepareTicket=0;
 private paintTicket=0;
 private flowLength=1;
 private entries:{glyph:ReturnType<typeof prepareGlyph>;x:number;y:number;index:number;color:string;progress:number;flowStart:number;word:number;slot:number;advance:number;row:number}[]=[];
 constructor(private svg:SVGSVGElement){}
 async prepare(text:string,fonts:any[],s:Settings,size:number,code=false,flow?:FlowContext){
  if(/[^\x20-\x7e\n]/.test(text))throw new Error('This prototype supports ASCII letters, numbers and punctuation.');
  const ticket=++this.prepareTicket;this.paintTicket++;this.svg.dataset.ready='false';
  const viewportWidth=this.svg.clientWidth||this.svg.parentElement!.clientWidth||800,viewportHeight=this.svg.clientHeight||this.svg.parentElement!.clientHeight||350;
  const lines=code?text.split('\n'):wrapText(text,Math.max(1,Math.floor((viewportWidth-40)/(size*.7*s.wdth/100))));
  const total=flow?.letterTotal??lines.join('').replace(/\s/g,'').length;
  const variations=fonts.map(f=>f.getVariation(axes({...s,temperature:0},0)));
  const cache=new Map<string,ReturnType<typeof prepareGlyph>>();
  const cellAdvance=variations[0].glyphForCodePoint(32).advanceWidth*100/variations[0].unitsPerEm;
  const entries:typeof this.entries=[];let ordinal=flow?.letterOffset??0,index=flow?.cellOffset??0,maxWidth=0,cursor=(flow?.cellOffset??0)*cellAdvance;
  let lastYield=performance.now();
  for(let row=0;row<lines.length;row++){
   const line=lines[row],colors=tokenColors(line),words=wordIds(line);
   const runs=variations.map(f=>f.shape(line,features(s)));
   let x=code?42:10;
   for(const cluster of sharedClusters(runs,line.length)){
    const characterIndex=cluster.start,character=line.slice(cluster.start,cluster.end),cp=[...character].map(c=>c.codePointAt(0)!);
    const fs=s.temperature?fonts.map(f=>f.getVariation(axes(s,index))):variations;
    const key=character+'/'+runs.map((r,i)=>cluster.indices[i].map((j:number)=>[r.glyphs[j].id,r.positions[j].xAdvance,r.positions[j].xOffset,r.positions[j].yOffset].join(':')).join(',')).join('/')+(s.temperature?'/'+index:'');
    let glyph=cache.get(key);if(!glyph){glyph=prepareGlyph(runs.map((r,i)=>clusterGlyph(r,cluster.indices[i],fs[i])),fs,character,s.support);cache.set(key,glyph);}
    const advance=glyph.advance*size/100;
    entries.push({glyph,row,word:words[characterIndex]>=0?row*1000+words[characterIndex]:-1,slot:x,advance,x,y:(row+1)*size*1.65,index,color:code?colors[characterIndex]||'var(--code-plain)':'currentColor',progress:progression(ordinal,total),flowStart:cursor});
    x+=advance;cursor+=glyph.advance;
    if(character.trim())ordinal+=cp.length;index+=cp.length;
    if(performance.now()-lastYield>8){await pause();lastYield=performance.now();if(ticket!==this.prepareTicket)return;}
   }
   maxWidth=Math.max(maxWidth,x+20);
  }
  if(ticket!==this.prepareTicket)return;
  const rowsPerPage=Math.max(1,Math.floor((viewportHeight-size*.5)/(size*1.65)));
  this.pages=code?1:Math.max(1,Math.ceil(lines.length/rowsPerPage));this.page=Math.min(this.page,this.pages-1);
  this.entries=code?entries:entries.filter(e=>Math.floor(e.row/rowsPerPage)===this.page).map(e=>({...e,y:e.y-this.page*rowsPerPage*size*1.65}));this.flowLength=flow?flow.cellTotal*cellAdvance:cursor;
  this.svg.dataset.page=String(this.page+1);this.svg.dataset.pages=String(this.pages);
  const width=code?Math.max((this.svg.parentElement?.clientWidth||884)-24,maxWidth):viewportWidth,height=code?(lines.length+.5)*size*1.65:viewportHeight;
  this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  this.svg.setAttribute('width',String(width));this.svg.setAttribute('height',String(height));
  this.svg.dataset.size=String(size);this.svg.dataset.lines=String(lines.length);
  this.svg.dataset.flowStart=String(entries[0]?.flowStart??0);this.svg.dataset.flowLength=String(this.flowLength);
 }
 async paint(start:Weights,end:Weights,s:Settings,code=false,sampling:TransitionSampling='letter',wordHealing=0){
  const ticket=++this.paintTicket,size=Number(this.svg.dataset.size||20),entries=this.entries.map(e=>({...e}));
  const uniform=start.every((w,i)=>Math.abs(w-end[i])<1e-10);
  const fragments:string[]=[],definitions:string[]=[];const drawn=new Map<ReturnType<typeof prepareGlyph>,{d:string;id:string}>();
  const shapes:{d:string;id?:string}[]=[],inkCache=new Map<string,Ink>();
  let lastYield=performance.now(),row=-1,cursor=0;
  for(let i=0;i<entries.length;i++){
   const e=entries[i],weights=sampling==='continuous'&&!uniform?flowWeights(start,end,e.flowStart+e.glyph.advance/2,this.flowLength):mix(start,end,e.progress);
   if(row!==e.row){row=e.row;cursor=code?42:10;}e.x=e.slot=cursor;e.advance=e.glyph.advances.reduce((n,a,i)=>n+a*weights[i],0)*size/100;cursor+=e.advance;
   let saved=uniform&&!s.temperature?drawn.get(e.glyph):undefined;let d=saved?.d;if(d===undefined){const raw=sampling==='continuous'&&!uniform?e.glyph.drawField((x,y)=>flowWeights(start,end,e.flowStart+x,this.flowLength),s.smoothing,s.structured):e.glyph.draw(weights,s.smoothing,s.structured);d=finishPath(raw,s,e.index);if(uniform&&!s.temperature){saved={d,id:this.svg.id+'-glyph-'+drawn.size};drawn.set(e.glyph,saved);definitions.push(`<path id="${saved.id}" d="${d}" fill-rule="nonzero"/>`);}}
   shapes.push({d:d!,id:saved?.id});
   if(performance.now()-lastYield>8){await pause();lastYield=performance.now();if(ticket!==this.paintTicket)return;}
  }
  const healed=wordHealing>0?healWords(entries.map((e,i)=>{
   const path=shapes[i].d;let ink=inkCache.get(path);if(!ink){ink=inkOf(path);inkCache.set(path,ink);}
   return {word:e.word,slot:e.slot,advance:e.advance,ink:transformInk(ink,e.x,size/100)};
  }),wordHealing):undefined;
  entries.forEach((e,i)=>{
   const h=healed?.[i],scale=h?.scale??1,x=e.x*scale+(h?.translate??0),shape=shapes[i];
   const transform=`translate(${x} ${e.y}) scale(${size/100*scale} ${size/100})`;
   fragments.push(shape.id?`<use href="#${shape.id}" fill="${e.color}" transform="${transform}"/>`:`<path d="${shape.d}" fill="${e.color}" fill-rule="nonzero" transform="${transform}"/>`);
  });
  if(code)for(let row=0;row<Number(this.svg.dataset.lines);row++)fragments.push(`<text x="0" y="${(row+1)*size*1.65}" fill="var(--code-comment)" font-family="monospace" font-size="${size*.8}">${row+1+Number(this.svg.dataset.firstLine||0)}</text>`);
  if(ticket===this.paintTicket){this.svg.innerHTML=(definitions.length?'<defs>'+definitions.join('')+'</defs>':'')+fragments.join('');this.svg.dataset.ready='true';this.svg.dataset.axes=JSON.stringify(axes({...s,temperature:0},0));this.svg.dataset.sampling=sampling;this.svg.dataset.wordHealing=String(wordHealing);this.rendered={html:this.svg.innerHTML,settings:{...s}};this.svg.dataset.axisPreview='false';}
 }
}
