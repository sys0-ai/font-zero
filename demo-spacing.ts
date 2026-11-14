// Keep the line's total advance fixed, but preserve each font's relative glyph widths.
export function linePositions(advances:number[],target:number,start=48){
 const extra=advances.length>1?(target-advances.reduce((a,b)=>a+b,0))/(advances.length-1):0;
 let x=start;return advances.map((advance,i)=>{const position=x;x+=advance+(i<advances.length-1?extra:0);return position;});
}
