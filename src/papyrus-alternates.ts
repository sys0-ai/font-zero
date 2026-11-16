import paper from 'paper';
import {sourcePath,type Command} from './curves';
import {fitClosed} from './fit-closed';
import {pathCurves,unifiedContours} from './outline-union';
import {constructions} from './construction';
import type {FontEntry} from './catalog';
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
import {papyrusAlternateKeys} from './papyrus-forms';
const item=(d:string)=>new scope.CompoundPath({pathData:d,insert:false,fillRule:'nonzero'});
const ribbon=(d:string,width:number)=>{
 const line=new scope.Path({pathData:d,insert:false}),n=Math.max(12,Math.ceil(line.length/5));
 const edge=(sign:number)=>Array.from({length:n+1},(_,i)=>{const t=i/n,p=line.getPointAt(line.length*t)!,normal=line.getNormalAt(line.length*t)!;
  const rough=Math.sin(i*2.31)*.65+Math.sin(i*.79)*.8,w=width*(.85+.15*Math.sin(t*Math.PI))+rough;
  return [p.x+normal.x*w*sign/2,p.y+normal.y*w*sign/2] as [number,number];});
 const curves=fitClosed([...edge(1),...edge(-1).reverse()],.5),fmt=(p:number[])=>p.join(',');line.remove();
 return item('M'+fmt(curves[0][0])+curves.map(c=>'C'+fmt(c[1])+' '+fmt(c[2])+' '+fmt(c[3])).join('')+'Z');
};
export function buildPapyrusAlternates(raw:any,entry:FontEntry){
 const original=(c:string)=>sourcePath(raw.glyphForCodePoint(c.charCodeAt(0)).path.commands,0,0,1000/raw.unitsPerEm);
 const result:Record<string,Record<string,Command[]>>={};
 const add=(c:string,key:string,shape:any)=>{
  const d=shape.pathData,source={...entry,a:key.startsWith('single-storey')?'single-storey':entry.a,g:key.startsWith('single-storey')?'single-storey':entry.g};
  const actual=constructions(c,[unifiedContours(d)],[source])[0].key;
  if(actual!==key)throw new Error(`Papyrus alternate ${c}: expected ${key}, got ${actual}`);
  result[c]??={};result[c][key]=pathCurves(d).flatMap(contour=>[{command:'moveTo',args:contour[0][0].map((v,i)=>v*(i%2?-1:1)*raw.unitsPerEm/1000)},...contour.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0]*raw.unitsPerEm/1000,-p[1]*raw.unitsPerEm/1000])})),{command:'closePath',args:[]}]);shape.remove();
 };
 const joined=(c:string,d:string,width:number)=>{const a=item(original(c)),b=ribbon(d,width),out=a.unite(b,{insert:false});a.remove();b.remove();return out;};
 const cut=(c:string,d:string,width:number)=>{const a=item(original(c)),b=ribbon(d,width),out=a.subtract(b,{insert:false});a.remove();b.remove();return out;};
 add('6',papyrusAlternateKeys['6'][0],joined('6','M112,-310 C135,-329 157,-333 190,-322',18));
 add('9',papyrusAlternateKeys['9'][0],joined('9','M317,-277 C346,-268 371,-261 397,-266',18));
 add('g',papyrusAlternateKeys.g[1],joined('g','M64,174 C108,146 109,103 104,35',24));
 const a=item(original('d')),clip=item('M-100,-470 L700,-485 L700,100 L-100,100Z'),single=a.intersect(clip,{insert:false});a.remove();clip.remove();single.scale(.9,1,new scope.Point(0,0));add('a',papyrusAlternateKeys.a[0],single);
 const q=item(original('q')),trim=item('M-100,-600H700V290H-100Z'),body=q.intersect(trim,{insert:false});q.remove();trim.remove();
 const tail=ribbon('M489,260 C494,367 464,427 361,431 C283,434 207,420 164,385',36),singleG=body.unite(tail,{insert:false});body.remove();tail.remove();add('g',papyrusAlternateKeys.g[0],singleG);
 const amp=joined('&','M300,-204 C239,-179 155,-193 80,-220',24);add('&',papyrusAlternateKeys['&'][0],amp.clone({insert:false}));
 const upper=ribbon('M467,-612 C568,-606 552,-431 462,-400',25),doubleAmp=amp.unite(upper,{insert:false});amp.remove();upper.remove();add('&',papyrusAlternateKeys['&'][1],doubleAmp);
 const zero=item(original('0')),dot=item(original('.'));dot.scale(.6);dot.position=new scope.Point(330,-316);const dotted=zero.unite(dot,{insert:false});zero.remove();dot.remove();add('0',papyrusAlternateKeys['0'][0],dotted);
 add('0',papyrusAlternateKeys['0'][1],joined('0','M144,-68 C237,-212 359,-399 527,-576',20));
 const four=item(original('4')),wedge=item('M-100,-900H400V-385H-100Z'),stem=four.subtract(wedge,{insert:false}),arm=ribbon('M42,-346 C145,-430 237,-550 330,-645',24),openFour=stem.unite(arm,{insert:false});four.remove();wedge.remove();stem.remove();arm.remove();add('4',papyrusAlternateKeys['4'][0],openFour);
 add('B',papyrusAlternateKeys.B[0],cut('B','M250,-554 L700,-554',32));
 add('R',papyrusAlternateKeys.R[0],cut('R','M250,-548 L730,-548',32));
 add('@',papyrusAlternateKeys['@'][0],cut('@','M140,-300 L280,-300',30));
 const dollar=cut('$','M210,-500 L310,-500',25),notch=ribbon('M200,-100 L310,-100',25),openDollar=dollar.subtract(notch,{insert:false});dollar.remove();notch.remove();add('$',papyrusAlternateKeys['$'][0],openDollar);
 return result;
}
