import paper from 'paper';
import {sourcePath,type Command} from './curves';
import {pathCurves,unifiedContours} from './outline-union';
import {constructions} from './construction';
import type {FontEntry} from './catalog';
import {timesAlternateKeys} from './times-forms';
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
export function buildTimesAlternates(raw:any,entry:FontEntry){
 const item=(d:string)=>new scope.CompoundPath({pathData:d,insert:false});
 const original=(c:string)=>item(sourcePath(raw.glyphForCodePoint(c.charCodeAt(0)).path.commands,0,0,1000/raw.unitsPerEm));
 const result:Record<string,Record<string,Command[]>>={};
 const add=(c:string,key:string,shape:any)=>{
  const d=shape.pathData,source={...entry,...(c==='a'||c==='g'?{[c]:key.split(':')[0]}:{})};
  const actual=constructions(c,[unifiedContours(d)],[source])[0].key;
  if(actual!==key)throw new Error(`Times alternate ${c}: expected ${key}, got ${actual}`);
  result[c]??={};result[c][key]=pathCurves(d).flatMap(contour=>[
   {command:'moveTo',args:[contour[0][0][0]*raw.unitsPerEm/1000,-contour[0][0][1]*raw.unitsPerEm/1000]},
   ...contour.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0]*raw.unitsPerEm/1000,-p[1]*raw.unitsPerEm/1000])})),{command:'closePath',args:[]}
  ]);shape.remove();
 };
 const join=(a:any,b:any)=>{const out=a.unite(b,{insert:false});a.remove();b.remove();return out;};
 const subtract=(a:any,b:any)=>{const out=a.subtract(b,{insert:false});a.remove();b.remove();return out;};
 const counter=(shape:any,index:number)=>{const children=shape.children??[shape],outer=children.reduce((a:any,b:any)=>Math.abs(a.area)>Math.abs(b.area)?a:b);return children.filter((p:any)=>p.area*outer.area<0).sort((a:any,b:any)=>a.bounds.center.y-b.bounds.center.y)[index];};
 // Native d supplies the bowl, contrast, right stem and foot serif of the a.
 const d=original('d'),clip=item('M-100,-460 H600 V100 H-100Z');let a=d.intersect(clip,{insert:false});d.remove();clip.remove();
 a.scale(.88,1,new scope.Point(0,0));add('a',timesAlternateKeys.a[0],a);
 // Keep q's native bowl and stem, replacing only its descender's terminal.
 const q=original('q'),trim=item('M-100,-800 H600 V112 H-100Z');let g=q.intersect(trim,{insert:false});q.remove();trim.remove();
 g=join(g,item('M346,94 L424,94 C425,181 376,219 285,219 C206,219 151,188 145,151 C141,119 190,106 207,133 C222,159 197,169 219,184 C259,210 340,187 346,94Z'));
 add('g',timesAlternateKeys.g[0],g);
 // Break only the dollar's upright bar, leaving the S outline intact.
 let dollar=original('$');for(const y of [-530,-145])dollar=subtract(dollar,item(`M210,${y-8} H275 V${y+8} H210Z`));add('$',timesAlternateKeys['$'][0],dollar);
 const zero=original('0'),dot=original('.');dot.scale(.48);dot.position=counter(zero,0).bounds.center;add('0',timesAlternateKeys['0'][0],join(zero,dot));
 add('0',timesAlternateKeys['0'][1],join(original('0'),item('M119,-80 L359,-620 L380,-607 L140,-67Z')));
 add('4',timesAlternateKeys['4'][0],subtract(original('4'),item('M266,-710 H294 V-286 H266Z')));
 return result;
}
