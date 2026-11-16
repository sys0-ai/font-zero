import {readContours,type Command,type Point} from './curves';
export function staticCommands(commands:Command[],units:number,values:{wght:number;wdth:number;slnt:number}):Command[]{
 const width=values.wdth/100,lean=Math.tan(-values.slnt*Math.PI/180),offset=(values.wght-450)/350*units*.0125;
 if(offset===0)return commands.map(c=>({command:c.command,args:c.args.map((v,i)=>i%2?v:v*width+(c.args[i+1]??0)*lean)}));
 const contours=readContours(commands),area=(ps:Point[])=>ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p[0]*q[1]-q[0]*p[1];},0);
 const areas=contours.map(c=>area(c.map(s=>s[0]))),sign=Math.sign(areas.reduce((a,b)=>Math.abs(a)>Math.abs(b)?a:b,1));
 const normal=(a:Point,b:Point):Point=>{const x=b[0]-a[0],y=b[1]-a[1],d=Math.hypot(x,y)||1;return [sign*y/d,-sign*x/d];};
 const transform=(p:Point)=>[p[0]*width-p[1]*lean,-p[1]];
 return contours.flatMap(contour=>{
  const anchors=contour.map((c,i)=>{const previous=contour[(i+contour.length-1)%contour.length],a=normal(previous[2],previous[3]),b=normal(c[0],c[1]),x=a[0]+b[0],y=a[1]+b[1],dot=Math.max(.5,x*b[0]+y*b[1]);return [c[0][0]+offset*x/dot,c[0][1]+offset*y/dot] as Point;});
  return [{command:'moveTo',args:transform(anchors[0])},...contour.map((c,i)=>{
   const a=normal(c[0],c[1]),b=normal(c[2],c[3]);return {command:'bezierCurveTo',args:[...transform([c[1][0]+offset*a[0],c[1][1]+offset*a[1]]),...transform([c[2][0]+offset*b[0],c[2][1]+offset*b[1]]),...transform(anchors[(i+1)%contour.length])]};
  }),{command:'closePath',args:[]}];
 });
}
