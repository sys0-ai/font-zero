import paper from 'paper';
import {Font,Glyph,Path} from 'opentype.js';
import {prepareGlyph,pause} from './render';
import {groupContours} from './curves';
import {unifiedContours,pathCurves} from './outline-union';
import {compileUniformCurves} from './uniform-curves';
import {attractionWeights,backgroundWeights,type Pole} from './attractor-math';
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
const item=(d:string)=>new scope.CompoundPath({pathData:d,insert:false,fillRule:'nonzero'});
export interface DesignFrame {width:number;height:number;size:number}
export function prepareDesignGlyph(fonts:any[],character:string){
 const code=character.codePointAt(0)!;
 const glyphs=fonts.map(f=>f.glyphForCodePoint(code));
 if(glyphs.some(g=>g.id===0))throw new Error('Missing glyph: '+character);
 const shape=prepareGlyph(glyphs,fonts,character,fonts.map((_,i)=>i));
 let compiled:ReturnType<typeof compileUniformCurves>|undefined;
 return (poles:Pole[],frame:DesignFrame,within=true)=>{
  const background=backgroundWeights(poles,fonts.length),advance=shape.advances.reduce((sum,a,i)=>sum+a*background[i],0);
  if(!character.trim())return {d:'',advance,x:frame.width/2,y:frame.height/2,inkWidth:0,inkHeight:0};
  const base=shape.draw(within?background:attractionWeights(poles,fonts.length,frame.width/2,frame.height/2),0,true),original=item(base),bounds=original.bounds,scale=frame.size/100;
  const x=frame.width/2-bounds.center.x*scale,y=frame.height/2-bounds.center.y*scale;
  const active=poles.filter(p=>!p.ambient&&p.x+p.radius>x+bounds.left*scale&&p.x-p.radius<x+bounds.right*scale&&p.y+p.radius>y+bounds.top*scale&&p.y-p.radius<y+bounds.bottom*scale);
  if(!within||!active.length||fonts.length===1){original.remove();return {d:base,advance,x,y,inkWidth:bounds.width,inkHeight:bounds.height};}
  compiled??=compileUniformCurves(groupContours(shape.originals.map(unifiedContours),true,character),true);
  const field=(gx:number,gy:number)=>attractionWeights(poles,fonts.length,x+gx*scale,y+gy*scale),center=field(bounds.center.x,bounds.center.y);
  const contours=compiled.contours(center,field),fmt=(p:number[])=>p.join(',');
  const blended=item(contours.map(c=>'M'+fmt(c[0][0])+c.map(s=>'C'+fmt(s[1])+' '+fmt(s[2])+' '+fmt(s[3])).join('')+'Z').join(''));
  let mask:any;
  for(const p of active){const circle=new scope.Path.Circle({center:[(p.x-x)/scale,(p.y-y)/scale],radius:p.radius/scale,insert:false});if(!mask)mask=circle;else{const combined=mask.unite(circle,{insert:false});mask.remove();circle.remove();mask=combined;}}
  const outside=original.subtract(mask,{insert:false}),inside=blended.intersect(mask,{insert:false}),result=outside.unite(inside,{insert:false}),d=result.pathData,ink=result.bounds;
  const previewX=frame.width/2-ink.center.x*scale,previewY=frame.height/2-ink.center.y*scale,inkWidth=ink.width,inkHeight=ink.height;
  for(const p of [original,blended,mask,outside,inside,result])p.remove();
  return {d,advance,x:previewX,y:previewY,inkWidth,inkHeight};
 };
}
export async function exportAttractorFont(fonts:any[],poles:Pole[],frame:DesignFrame,name:string,extraText='',progress=(done:number,total:number)=>{}){
 if(!fonts.length)throw new Error('Add a placed or Everywhere attractor.');
 const codes=[...new Set([...Array.from({length:95},(_,i)=>i+32),...Array.from(extraText).map(c=>c.codePointAt(0)!).filter(c=>c>=32&&c!==127)])].sort((a,b)=>a-b);
 const missing=new Path();missing.moveTo(80,0);missing.lineTo(80,700);missing.lineTo(500,700);missing.lineTo(500,0);missing.close();
 const glyphs=[new Glyph({name:'.notdef',advanceWidth:600,path:missing})];let ascender=800,descender=-200;
 for(const [index,code]of codes.entries()){
  const result=prepareDesignGlyph(fonts,String.fromCodePoint(code))(poles,frame),path=new Path();
  for(const contour of pathCurves(result.d)){
   path.moveTo(contour[0][0][0]*10,-contour[0][0][1]*10);
   for(const c of contour)path.curveTo(c[1][0]*10,-c[1][1]*10,c[2][0]*10,-c[2][1]*10,c[3][0]*10,-c[3][1]*10);path.close();
  }
  if(path.commands.length){const b=path.getBoundingBox();ascender=Math.max(ascender,Math.ceil(b.y2));descender=Math.min(descender,Math.floor(b.y1));}
  glyphs.push(new Glyph({name:'uni'+code.toString(16).toUpperCase().padStart(4,'0'),unicode:code,advanceWidth:Math.round(result.advance*10),path}));
  progress(index+1,codes.length);if(index%3===0)await pause();
 }
 const family=name.trim()||'Font Zero Attractors',font=new Font({familyName:family,styleName:'Regular',unitsPerEm:1000,ascender,descender,glyphs});
 font.names.copyright={en:fonts.map(f=>f.source.name+': '+(f.copyright??'Original source copyright retained.')).join('\n')};
 font.names.license={en:'Derived from '+fonts.map(f=>f.source.name).join(', ')+'. Original source font licenses apply.'};
 font.names.description={en:'Static font: each glyph centered on the design card. '+JSON.stringify({fonts:fonts.map(f=>f.source.id),poles,frame})};
 return {bytes:font.toArrayBuffer(),filename:(family.replace(/[^A-Za-z0-9-]+/g,'-').replace(/^-|-$/g,'')||'Font-Zero-Attractors')+'.otf',count:codes.length};
}

export function fitDesignGlyph(glyph:ReturnType<typeof prepareDesignGlyph>,poles:Pole[],frame:DesignFrame,padding:number,maxSize:number,within=true){
 const width=Math.max(1,frame.width-2*padding),height=Math.max(1,frame.height-2*padding);
 let low=1,high=maxSize;
 for(let i=0;i<16;i++){
  const size=(low+high)/2,ink=glyph(poles,{...frame,size},within);
  if(ink.inkWidth*size/100<=width&&ink.inkHeight*size/100<=height)low=size;else high=size;
 }
 return Math.floor(low*10)/10;
}
