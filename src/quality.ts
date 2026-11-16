import type {Weights} from './weights';
import {measureGeometry,type GeometryMeasures} from './outline-union';
export interface QualityResult {measures:GeometryMeasures;issues:string[];inkDrift:number;strokeDrift:number|null}
export function assessGeometry(path:string,sources:GeometryMeasures[],weights:Weights):QualityResult {
 const measures=measureGeometry(path),active=sources.filter((_,i)=>weights[i]>1e-6),issues:string[]=[];
 const expected=sources.reduce((n,s,i)=>n+s.inkArea*weights[i],0);
 const inkDrift=expected?(measures.inkArea/expected-1)*100:0;
 const expectedStroke=sources.reduce((n,s,i)=>n+s.stroke*weights[i],0);
 const strokeDrift=expectedStroke&&active.every(s=>s.stroke>0)?(measures.stroke/expectedStroke-1)*100:null;
 const introducedCrossings=Math.max(0,measures.crossings-(active.length===1?active[0].crossings:0));
 if(introducedCrossings)issues.push(`${introducedCrossings} introduced crossing${introducedCrossings===1?'':'s'}`);
 if(active.every(s=>s.counters===active[0].counters)&&measures.counters!==active[0].counters)issues.push('Counter count changed');
 const expectedCounter=sources.reduce((n,s,i)=>n+s.counterArea*weights[i],0);
 if(active.every(s=>s.counters>0)&&measures.counterArea<expectedCounter*.6)issues.push('Counter closing');
 if(Math.abs(inkDrift)>12)issues.push('Ink area drift');
 if(strokeDrift!==null&&Math.abs(strokeDrift)>20)issues.push('Stroke measure drift');
 return {measures,issues,inkDrift,strokeDrift};
}
