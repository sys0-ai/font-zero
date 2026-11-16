import paper from 'paper';
import {sourcePath,type Command} from './curves';
import {fitClosed} from './fit-closed';
import {pathCurves,unifiedContours} from './outline-union';
import {constructions} from './construction';
import type {FontEntry} from './catalog';
import {comicAlternateKeys} from './comic-forms';
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
const item=(d:string)=>new scope.CompoundPath({pathData:d,insert:false,fillRule:'nonzero'});
function stroke(d:string,width:number){
 const line=new scope.Path({pathData:d,insert:false}),n=Math.max(16,Math.ceil(line.length/6));
 const edge=(sign:number)=>Array.from({length:n+1},(_,i)=>{const p=line.getPointAt(line.length*i/n)!,normal=line.getNormalAt(line.length*i/n)!,w=width*(.96+.04*Math.sin(i/n*Math.PI));return [p.x+normal.x*w*sign/2,p.y+normal.y*w*sign/2] as [number,number];});
 const curves=fitClosed([...edge(1),...edge(-1).reverse()],.35),fmt=(p:number[])=>p.join(',');let shape:any=item('M'+fmt(curves[0][0])+curves.map(c=>'C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3])).join('')+'Z');
 for(const point of [line.firstSegment.point,line.lastSegment.point]){const cap=new scope.Path.Circle({center:point,radius:width*.48,insert:false}),next=shape.unite(cap,{insert:false});shape.remove();cap.remove();shape=next;}line.remove();return shape;
}
export function buildComicAlternates(raw:any,entry:FontEntry){
 const original=(c:string)=>item(sourcePath(raw.glyphForCodePoint(c.charCodeAt(0)).path.commands,0,0,1000/raw.unitsPerEm));
 const result:Record<string,Record<string,Command[]>>={};
 const add=(c:string,key:string,shape:any)=>{
  const d=shape.pathData,source={...entry,...(c==='a'||c==='g'?{[c]:key.split(':')[0]}:{})},actual=constructions(c,[unifiedContours(d)],[source])[0].key;
  if(actual!==key)throw new Error(`Comic Sans Universal ${c}: expected ${key}, got ${actual}`);
  result[c]??={};result[c][key]=pathCurves(d).flatMap(contour=>[{command:'moveTo',args:[contour[0][0][0]*raw.unitsPerEm/1000,-contour[0][0][1]*raw.unitsPerEm/1000]},...contour.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0]*raw.unitsPerEm/1000,-p[1]*raw.unitsPerEm/1000])})),{command:'closePath',args:[]}]);shape.remove();
 };
 const union=(a:any,b:any)=>{const out=a.unite(b,{insert:false});a.remove();b.remove();return out;};
 const holes=(shape:any)=>{const children=shape.children??[shape],outer=children.reduce((a:any,b:any)=>Math.abs(a.area)>Math.abs(b.area)?a:b);return children.filter((p:any)=>p.area*outer.area<0).sort((a:any,b:any)=>a.bounds.center.y-b.bounds.center.y);};
 const open=(shape:any,index=0,direction='right')=>{
  const hole=holes(shape)[index];if(!hole)throw new Error('Missing counter');const p=hole.bounds.center,end=direction==='up'?new scope.Point(p.x,shape.bounds.top-30):new scope.Point(shape.bounds.right+30,p.y),cut=stroke(`M${p.x},${p.y} L${end.x},${end.y}`,28),out=shape.subtract(cut,{insert:false});shape.remove();cut.remove();return out;
 };
 for(const c of ['6','9','B','R'])add(c,comicAlternateKeys[c][0],open(original(c)));
 const four=original('4'),wedge=item('M-100,-900 H365 V-350 H-100 Z'),stem=four.subtract(wedge,{insert:false});four.remove();wedge.remove();add('4',comicAlternateKeys['4'][0],union(stem,stroke('M155,-710 C135,-600 110,-460 92,-342 L435,-342',66)));
 add('&',comicAlternateKeys['&'][0],open(original('&')));
 const openAmp=open(open(original('&')));const ampParts=openAmp.children.slice().sort((a:any,b:any)=>Math.abs(b.area)-Math.abs(a.area));for(const part of ampParts.slice(1))part.remove();add('&',comicAlternateKeys['&'][1],openAmp);
 let dollar=original('$');for(const y of [-510,-145]){const cut=stroke(`M270,${y} L400,${y}`,28),next=dollar.subtract(cut,{insert:false});dollar.remove();cut.remove();dollar=next;}add('$',comicAlternateKeys['$'][0],dollar);
 const zero=original('0'),hole=holes(zero)[0],dot=original('.');dot.scale(.5);dot.position=hole.bounds.center;add('0',comicAlternateKeys['0'][0],union(zero,dot));
 add('0',comicAlternateKeys['0'][1],union(original('0'),stroke('M165,-80 C270,-270 370,-470 450,-660',35)));
 // The open inner bowl of Comic Sans @ closes with its own rounded stroke.
 add('@',comicAlternateKeys['@'][0],union(original('@'),stroke('M490,-545 C530,-520 541,-470 531,-407',48)));
 // Reuse the native a bowl and native o loops to retain Comic Sans stroke rhythm.
 const a=original('a');a.scale(1,.61,new scope.Point(0,0));
 add('a',comicAlternateKeys.a[0],union(a,stroke('M98,-437 C185,-522 382,-507 426,-430 C452,-385 445,-306 448,-230',65)));
 const oval=(x:number,y:number,w:number,h:number)=>{const o=original('o');o.scale(w/o.bounds.width,h/o.bounds.height);o.position=new scope.Point(x,y);return o;};
 let g=union(oval(260,-342,385,340),oval(260,120,420,290));g=union(g,stroke('M353,-205 C399,-108 178,-122 176,2',53));g=union(g,stroke('M406,-447 Q452,-480 481,-459',49));
 add('g',comicAlternateKeys.g[0],g.clone({insert:false}));add('g',comicAlternateKeys.g[1],open(g,1));
 return result;
}
