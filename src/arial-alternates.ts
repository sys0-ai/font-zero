import paper from 'paper';
import {sourcePath,type Command} from './curves';
import {pathCurves,unifiedContours} from './outline-union';
import {constructions} from './construction';
import type {FontEntry} from './catalog';
const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));scope.settings.insertItems=false;
export function buildArialAlternates(raw:any,entry:FontEntry){
 const oval=(x:number,y:number,width:number,height:number)=>{
  const path=new scope.CompoundPath({pathData:sourcePath(raw.glyphForCodePoint(111).path.commands,0,0,1000/raw.unitsPerEm),insert:false});
  path.scale(width/path.bounds.width,height/path.bounds.height);
  const outer=path.children.reduce((a:any,b:any)=>Math.abs(a.area)>Math.abs(b.area)?a:b);
  for(const inner of path.children.filter((p:any)=>p.area*outer.area<0))inner.scale(Math.max(.1,(inner.bounds.width-28)/inner.bounds.width),Math.max(.1,(inner.bounds.height-28)/inner.bounds.height));
  path.position=new scope.Point(x,y);return path;
 };
 const path=(d:string)=>new scope.CompoundPath({pathData:d,insert:false});
 const join=(a:any,b:any)=>{const result=a.unite(b,{insert:false});a.remove();b.remove();return result;};
 let g=join(oval(260,-365,350,315),oval(260,95,385,265));
 // The link and ear continue Arial's unbracketed, near-monoline terminals.
 g=join(g,path('M330,-246 C407,-197 408,-130 287,-111 C226,-102 184,-91 209,-32 L164,-15 C117,-101 194,-139 277,-153 C348,-165 356,-181 318,-207 Z'));
 g=join(g,path('M370,-482 C407,-509 442,-516 477,-506 L475,-458 C441,-469 415,-461 401,-448 Z'));
 const key='double-storey:1:2',d=g.pathData;
 const actual=constructions('g',[unifiedContours(d)],[{...entry,g:'double-storey'}])[0].key;
 if(actual!==key)throw new Error('Arial alternate g: expected '+key+', got '+actual);
 const commands:Command[]=pathCurves(d).flatMap(contour=>[
  {command:'moveTo',args:[contour[0][0][0]*raw.unitsPerEm/1000,-contour[0][0][1]*raw.unitsPerEm/1000]},
  ...contour.map(s=>({command:'bezierCurveTo',args:s.slice(1).flatMap(p=>[p[0]*raw.unitsPerEm/1000,-p[1]*raw.unitsPerEm/1000])})),
  {command:'closePath',args:[]}
 ]);g.remove();return {g:{[key]:commands}};
}
