import {defaults,type FontEntry} from './catalog';
import {at,type Contour} from './curves';
export interface Construction {name:string;key:string;sources:number[]}
function topology(contours:Contour[]){
 const areas=contours.map(c=>{const ps=c.flatMap(s=>[s[0],at(s,.5)]);return ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p[0]*q[1]-q[0]*p[1];},0);});
 const largest=areas.reduce((best,a)=>Math.abs(a)>Math.abs(best)?a:best,0);
 return [areas.filter(a=>a*largest>0).length,areas.filter(a=>a*largest<0).length];
}
export function constructions(character:string,shapes:Contour[][],entries:FontEntry[]=defaults):Construction[]{
 const groups:Construction[]=[];
 shapes.forEach((shape,i)=>{
  const [bodies,counters]=topology(shape),name=(character==='a'||character==='g'?entries[i][character]:undefined)??`${bodies} bodies, ${counters} counters`,key=`${name}:${bodies}:${counters}`;
  let group=groups.find(g=>g.key===key);if(!group){group={name,key,sources:[]};groups.push(group);}group.sources.push(i);
 });
 return groups;
}
