// Compact radial field: pure cursor font at the center, pure base at the rim.
export function cursorInfluence(distance:number,radius:number,decay:number){
 const t=Math.max(0,Math.min(1,distance/Math.max(1,radius)));
 return Math.pow(1-t*t*(3-2*t),decay);
}
