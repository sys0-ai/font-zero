import {test,expect} from 'bun:test';
import {defaultStyle,insertStop,routeStyle,mixStyle,effectAttributes,type TextStop} from './style-route';
import {pole} from './weights';
test('every stop captures a complete style and transitions reach exact endpoints',()=>{
 const a=defaultStyle(pole(109,0)),b={...defaultStyle(pole(109,100)),size:80,wght:750,tracking:4,color:'#ff4422',shadowOpacity:.8,shadowBlur:12,glow:8};
 let stops:TextStop[]=[{id:0,at:0,style:a,ease:'linear'},{id:1,at:100,style:b,ease:'smooth'}];
 expect(routeStyle(stops,0)).toEqual(a);expect(routeStyle(stops,100)).toEqual(b);const middle=routeStyle(stops,50);expect(middle.size).toBe(56);expect(middle.wght).toBe(600);expect(middle.shadowBlur).toBe(6);expect(middle.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
 stops=insertStop(stops,50,2);expect(stops[1].style).toEqual(middle);stops[1].style.color='#112233';expect(routeStyle(stops,50).color).toBe('#112233');expect(routeStyle(stops,100)).toEqual(b);expect(()=>insertStop(stops,50,3)).toThrow();
 expect(effectAttributes(middle)).toContain('drop-shadow');expect(mixStyle(a,b,.5).weights[100]).toBe(.5);
});
