import {test,expect} from 'bun:test';
import {measureGeometry} from './outline-union';
import {assessGeometry} from './quality';
import {blendPath,type Contour} from './curves';
const ring='M0,0L40,0L40,50L0,50Z M8,8L8,42L32,42L32,8Z';
test('criteria distinguish counters and ink weight within a selected construction',()=>{
 const source=measureGeometry(ring);expect(source.counters).toBe(1);expect(source.stroke).toBeCloseTo(8);
 const sources=[source,source,source];
 expect(assessGeometry(ring,sources,[1,0,0]).issues).toEqual([]);
 const middle=assessGeometry(ring,sources,[.5,0,.5]);expect(middle.issues).toEqual([]);
 const closed=assessGeometry('M0,0L40,0L40,50L0,50Z',sources,[.5,.5,0]);
 expect(closed.issues).toContain('Counter count changed');expect(closed.issues).toContain('Counter closing');expect(closed.issues).toContain('Ink area drift');
});
test('native overlapping strokes are not misreported as introduced defects',()=>{
 const d='M0,0L30,0L30,30L0,30Z M15,-10L40,-10L40,15L15,15Z';const source=measureGeometry(d);
 expect(source.crossings).toBeGreaterThan(0);expect(assessGeometry(d,[source,source,source],[1,0,0]).issues).toEqual([]);
 expect(assessGeometry(d,[source,source,source],[.5,.5,0]).issues.some(s=>s.includes('introduced crossing'))).toBe(true);
});
test('direction blending preserves tangent continuity despite unequal master handle lengths',()=>{
 const a:Contour=[[[0,0],[1,0],[9,0],[10,0]],[[10,0],[12,0],[20,8],[20,10]]];
 const b:Contour=[[[0,0],[0,1],[10,-8],[10,0]],[[10,0],[10,1],[20,8],[20,10]]];
 const d=blendPath([[a,b]],()=>[.5,.5],true);
 const numbers=d.match(/-?\d+\.\d+/g)!.map(Number);
 const incoming=[numbers[6]-numbers[4],numbers[7]-numbers[5]],outgoing=[numbers[8]-numbers[6],numbers[9]-numbers[7]];
 expect(Math.abs(incoming[0]*outgoing[1]-incoming[1]*outgoing[0])).toBeLessThan(.01);
});
