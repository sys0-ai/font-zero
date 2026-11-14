import {entryForFont} from './catalog';
import {finishPath} from './edge-texture';
import {Font,Glyph,Path} from 'opentype.js';
import {axes,prepareGlyph,pause,type Settings} from './render';
import {pathCurves} from './outline-union';
import type {Weights} from './weights';
import license from './OFL.txt' with {type:'text'};
export async function makeFont(fonts:any[],weights:Weights,s:Settings,progress=(n:number)=>{}){
 const glyphs:any[]=[],used=new Set(weights.flatMap((w,i)=>w>0?[i]:[]));
 const missing=new Path();missing.moveTo(80,0);missing.lineTo(80,700);missing.lineTo(500,700);missing.lineTo(500,0);missing.close();missing.moveTo(130,50);missing.lineTo(450,50);missing.lineTo(450,650);missing.lineTo(130,650);missing.close();
 glyphs.push(new Glyph({name:'.notdef',advanceWidth:600,path:missing}));
 const base=fonts.map(f=>f.getVariation(axes({...s,temperature:0},0)));
 for(let code=32;code<127;code++){
  const index=code-32,fs=s.temperature?fonts.map(f=>f.getVariation(axes(s,index))):base;
  const gs=fs.map(f=>f.glyphForCodePoint(code));
  const shape=prepareGlyph(gs,fs,String.fromCharCode(code),s.support),path=new Path();
  shape.resolve(weights).weights.forEach((w,i)=>{if(w>0)used.add(i);});
  const d=finishPath(shape.draw(weights,s.smoothing,s.structured),s,index);
  const transform=(p:number[])=>[p[0]*10,-p[1]*10];
  for(const contour of pathCurves(d)){
   const first=transform(contour[0][0]);path.moveTo(first[0],first[1]);
   for(const c of contour){const a=transform(c[1]),b=transform(c[2]),e=transform(c[3]);path.curveTo(a[0],a[1],b[0],b[1],e[0],e[1]);}path.close();
  }
  glyphs.push(new Glyph({name:'uni'+code.toString(16).toUpperCase().padStart(4,'0'),unicode:code,advanceWidth:Math.round(base.reduce((sum,f,i)=>sum+f.glyphForCodePoint(code).advanceWidth*1000/f.unitsPerEm*weights[i],0)),path}));
  progress(index+1);if(index%4===0)await pause();
 }
 const sources=fonts.map(entryForFont),active=sources.filter((_,i)=>used.has(i)),open=active.every(f=>!f.file);
 const signature=JSON.stringify({sources:sources.map(f=>({id:f.id,construction:f.constructionSignature})),weights,...s}),hash=[...signature].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
 const name='Type Space '+active.length+' Fonts '+hash.toString(16);

 const font=new Font({familyName:name,styleName:'Regular',unitsPerEm:1000,ascender:1200,descender:-400,glyphs});
 font.names.copyright={en:fonts.flatMap((f,i)=>used.has(i)?[sources[i].name+': '+(f.copyright??'Original source copyright retained.')]:[]).join('\n')};
 font.names.license={en:open?license:'Derived for local use from '+active.map(f=>f.name).join(', ')+'. Original source font licenses apply; no additional license is granted.'};if(open)font.names.licenseURL={en:'https://openfontlicense.org'};
 font.names.description={en:'Static ASCII curve blend. '+JSON.stringify({sources:active.map(f=>f.name),weights,...s})};
 return {bytes:font.toArrayBuffer(),filename:name.replaceAll(' ','-')+'.otf'};
}
