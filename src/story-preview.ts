import {healWords,inkOf,transformInk,wordIds} from './word-healing';
import {pathCurves} from './outline-union';
import {sourcePath,type Command} from './curves';
import {staticCommands} from './static-axes';
import {prepareGlyph,pause,type Settings} from './render';
import {finishPath} from './edge-texture';
import {routeSpan,routeStyle,effectAttributes,type TextStop,type TextStyle} from './style-route';
import type {TransitionSampling} from './field';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export class StoryPreview {
 private geometryKey='';private glyphs=new Map<string,ReturnType<typeof prepareGlyph>>();
 private page=0;pages=1;
 private drawn:{d:string;style:TextStyle;index:number;scaleX:number;node:SVGGElement;commands?:Command[]}[]=[];
 private uniformPosition:number|undefined;
 preview(stops:TextStop[]){
  for(const entry of this.drawn){
   const style=routeStyle(stops,this.uniformPosition??entry.index),base=entry.style;
   for(const match of effectAttributes(style).matchAll(/([\w-]+)="([^"]*)"/g))entry.node.setAttribute(match[1],match[2]);
   const path=entry.node.querySelector('path')!;path.setAttribute('transform',`scale(${style.size/100*entry.scaleX} ${style.size/100})`);
   if(style.wght===base.wght&&style.wdth===base.wdth&&style.slnt===base.slnt){path.setAttribute('d',entry.d);continue;}
   entry.commands??=pathCurves(entry.d).flatMap(c=>[{command:'moveTo',args:[c[0][0][0],-c[0][0][1]]},...c.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0],-p[1]])})),{command:'closePath',args:[]}]);
   path.setAttribute('d',sourcePath(staticCommands(entry.commands,100,{wght:450+style.wght-base.wght,wdth:100*style.wdth/base.wdth,slnt:style.slnt-base.slnt})));
  }
 }
 constructor(private svg:SVGSVGElement){}
 movePage(delta:number){this.page=Math.max(0,Math.min(this.pages-1,this.page+delta));}
 async paint(text:string,fonts:any[],indices:number[],stops:TextStop[],settings:Settings,sampling:TransitionSampling,uniformPosition?:number,wordHealing=0){
  if(/[^\x20-\x7e\n]/.test(text))throw new Error('This prototype supports ASCII text.');
  const key=JSON.stringify({fonts:fonts.map(f=>[f.source.id,f.source.constructionSignature]),axes:stops.map(s=>[s.id,s.style.wght,s.style.wdth,s.style.slnt]),support:settings.support,seed:settings.seed,temperature:stops.map(s=>s.style.temperature)});
  if(key!==this.geometryKey){this.geometryKey=key;this.glyphs.clear();}
  const width=this.svg.parentElement!.clientWidth||800,height=this.svg.parentElement!.clientHeight||350,pad=Math.min(width/4,Math.max(20,...stops.map(({style:s})=>Math.max(s.outline,s.blur*3,s.glow*3,s.shadowOpacity>0?Math.max(Math.abs(s.shadowX),Math.abs(s.shadowY))+s.shadowBlur*3:0)+8)));
  const words=wordIds(text);
  const variations=stops.map(stop=>fonts.map(f=>f.getVariation({wght:stop.style.wght,wdth:stop.style.wdth,slnt:stop.style.slnt})));
  const project=(s:TextStyle)=>indices.map(i=>s.weights[i]);
  const entries:{d:string;style:TextStyle;x:number;line:number;advance:number;index:number}[]=[],lines:{height:number;page:number;y:number}[]=[{height:0,page:0,y:0}];
  let x=pad,line=0,lastYield=performance.now();
  for(let index=0;index<text.length;index++){
   const char=text[index],position=uniformPosition??index,{a,b,t,index:span}=routeSpan(stops,position),style=routeStyle(stops,position);
   if(char==='\n'){line++;x=pad;lines.push({height:0,page:0,y:0});continue;}
   const cacheKey=span+':'+char;let glyph=this.glyphs.get(cacheKey);
   if(!glyph){const fs=[...variations[span],...variations[span+1]];glyph=prepareGlyph(fs.map(f=>f.glyphForCodePoint(char.charCodeAt(0))),fs,char,settings.support?[...settings.support,...settings.support.map(i=>i+fonts.length)]:undefined);this.glyphs.set(cacheKey,glyph);}
   const aw=project(a.style),bw=project(b.style),weights=[...aw.map(v=>v*(1-t)),...bw.map(v=>v*t)],advance=Math.max(1,glyph.advances.reduce((n,v,i)=>n+v*weights[i],0)*style.size/100+style.tracking);
   if(char===' '&&x>pad){
    const word=text.slice(index+1).match(/^[^ \n]+/)?.[0]??'';let wordWidth=0;
    for(let j=0;j<word.length;j++){const pos=uniformPosition??index+1+j,{a:wa,b:wb,t:wt,index:wi}=routeSpan(stops,pos),ws=routeStyle(stops,pos),av=project(wa.style),bv=project(wb.style);wordWidth+=fonts.reduce((n,f,k)=>n+(variations[wi][k].glyphForCodePoint(word.charCodeAt(j)).advanceWidth*av[k]*(1-wt)+variations[wi+1][k].glyphForCodePoint(word.charCodeAt(j)).advanceWidth*bv[k]*wt)/f.unitsPerEm*ws.size,0)+ws.tracking;}
    if(x+advance+wordWidth>width-pad){line++;x=pad;lines.push({height:0,page:0,y:0});continue;}
   }
   if(x+advance>width-pad&&x>pad){line++;x=pad;lines.push({height:0,page:0,y:0});}
   const local=(px:number)=>{const progress=position+px/(glyph.advances.reduce((n,v,i)=>n+v*weights[i],0)||1);const sample=routeSpan(stops,Math.min(b.at,progress)),u=sample.index===span?sample.t:1;return [...aw.map(v=>v*(1-u)),...bw.map(v=>v*u)];};
   const path=uniformPosition===undefined&&sampling==='continuous'?glyph.drawField((px,py)=>local(px),style.smoothing,settings.structured):glyph.draw(weights,style.smoothing,settings.structured);
   const d=finishPath(path,{...style,seed:settings.seed},index);
   entries.push({d,style,x,line,advance,index});x+=advance;lines[line].height=Math.max(lines[line].height,style.size*style.leading);
   if(performance.now()-lastYield>12){await pause();lastYield=performance.now();}
  }
  let page=0,y=pad;
  for(const row of lines){row.height=row.height||24;if(y+row.height>height-pad&&y>pad){page++;y=pad;}row.page=page;row.y=y;y+=row.height;}
  this.pages=page+1;this.page=Math.min(this.page,page);
  this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);this.svg.setAttribute('width',String(width));this.svg.setAttribute('height',String(height));
  const visible=entries.filter(e=>lines[e.line].page===this.page),healed=wordHealing>0?healWords(visible.map(e=>({word:words[e.index]>=0?e.line*10000+words[e.index]:-1,slot:e.x,advance:e.advance,ink:transformInk(inkOf(e.d),e.x,e.style.size/100)})),wordHealing):undefined;
  this.svg.innerHTML=visible.map((e,i)=>{
   const row=lines[e.line],baseline=row.y+row.height*.78,s=e.style,scale=healed?.[i].scale??1,x=e.x*scale+(healed?.[i].translate??0);
   return `<g data-character="${e.index}" transform="translate(${x.toFixed(3)} ${baseline.toFixed(3)})" ${effectAttributes(s)}><title>${escape(text[e.index])} · ${s.size.toFixed(1)}px · weight ${s.wght.toFixed(0)}</title><path d="${e.d}" transform="scale(${s.size/100*scale} ${s.size/100})" vector-effect="non-scaling-stroke" fill-rule="nonzero"/></g>`;
  }).join('');
  this.drawn=visible.map((e,i)=>({d:e.d,style:{...e.style},index:e.index,scaleX:healed?.[i].scale??1,node:this.svg.children[i] as SVGGElement}));this.uniformPosition=uniformPosition;
  this.svg.dataset.axes=JSON.stringify({wght:settings.wght,wdth:settings.wdth,slnt:settings.slnt});this.svg.dataset.ready='true';this.svg.dataset.stops=String(stops.length);this.svg.dataset.page=String(this.page+1);this.svg.dataset.pages=String(this.pages);
 }
}
