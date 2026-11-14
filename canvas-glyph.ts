import {prepareGlyph} from './render';
import {unifiedContours} from './outline-union';
import {groupContours} from './curves';
import {compileUniformCurves} from './uniform-curves';
export function prepareCanvasGlyph(glyphs:any[],fonts:any[],character:string){
 const shape=prepareGlyph(glyphs,fonts,character,fonts.map((_,i)=>i));
 const originals=shape.originals.map(d=>new Path2D(d));
 const compiled=compileUniformCurves(groupContours(shape.originals.map(unifiedContours),true,character),true);
 return {
  contours:compiled.contours,
  paint(context:CanvasRenderingContext2D,weights:number[]){
   shape.resolve(weights);
   const pole=weights.findIndex(w=>w>1-1e-10);
   if(pole>=0){context.fill(originals[pole]);return;}
   context.beginPath();
   for(const contour of compiled.contours(weights)){
    context.moveTo(...contour[0][0]);
    for(const c of contour)context.bezierCurveTo(...c[1],...c[2],...c[3]);
    context.closePath();
   }
   context.fill();
  }
 };
}
