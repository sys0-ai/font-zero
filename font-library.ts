import {buildPapyrusAlternates} from './papyrus-alternates';
import signatures from './construction-signatures.json';
import * as hb from 'harfbuzzjs';
import data from './fonts.json';
import {catalog,type FontEntry} from './catalog';
import {staticCommands} from './static-axes';
export async function loadFont(id:string){
 const entry=catalog.find(e=>e.id===id);if(!entry)throw new Error('Unknown font '+id);
 let bytes:Uint8Array;
 if(entry.file||entry.asset){const response=await fetch('fonts/'+entry.id);if(!response.ok)throw new Error('Could not load '+entry.name);bytes=new Uint8Array(await response.arrayBuffer());}
 else bytes=Uint8Array.from(atob(data[catalog.indexOf(entry)].data),c=>c.charCodeAt(0));
 const {create}=await import('fontkit');return makeTypeface(create(bytes),bytes,entry);
}
export function makeTypeface(collection:any,bytes:Uint8Array,source:FontEntry){
 const raw=collection.fonts?collection.fonts[source.face??0]:collection;
 if((source.file||source.asset)&&raw.postscriptName!==source.postscript)throw new Error('Unexpected font face for '+source.name);
 const shaper=new hb.Font(new hb.Face(new hb.Blob(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),source.face??0));
 const variable=Object.keys(raw.variationAxes).length>0;
 const alternates=source.variant?buildPapyrusAlternates(raw,source):undefined;
 const characters=new Map(Object.keys(alternates??{}).map(c=>[raw.glyphForCodePoint(c.charCodeAt(0)).id,c]));
 const at=(values:{wght:number;wdth:number;slnt:number},forms:string[]=signatures.papyrus)=>{
  const activeSource=source.variant?{...source,a:forms[97-33].split(':')[0],g:forms[103-33].split(':')[0],constructionSignature:forms.join('|')}:source;
  const alternate=(g:any)=>{const c=characters.get(g.id);if(!c)return g;const key=forms[c.charCodeAt(0)-33];if(key===signatures.papyrus[c.charCodeAt(0)-33])return g;const commands=alternates![c][key];if(!commands)throw new Error('Papyrus alternate not drawn: '+c+' '+key);return {id:g.id,codePoints:g.codePoints,name:g.name,advanceWidth:g.advanceWidth,path:{commands}};};
  const native=Object.fromEntries(Object.entries(raw.variationAxes).map(([tag,axis]:[string,any])=>[tag,Math.max(axis.min,Math.min(axis.max,(values as any)[tag]??axis.default))]));
  const font=variable?raw.getVariation(native):raw;
  const synthetic={wght:450+values.wght-(native.wght??450),wdth:values.wdth/(native.wdth??100)*100,slnt:values.slnt-(native.slnt??0)};
  const transform=(g:any)=>synthetic.wght===450&&synthetic.wdth===100&&synthetic.slnt===0?g:{id:g.id,codePoints:g.codePoints,name:g.name,advanceWidth:g.advanceWidth*synthetic.wdth/100,get path(){return {commands:staticCommands(g.path.commands,raw.unitsPerEm,synthetic)}}};
  const glyph=(g:any)=>transform(alternate(g));
  const instance={source:activeSource,axisValues:{...values},familyName:raw.familyName,postscriptName:raw.postscriptName,unitsPerEm:raw.unitsPerEm,variationAxes:raw.variationAxes,copyright:raw.copyright,license:raw.license,
   alternateProof:source.variant?()=>Object.entries(alternates!).flatMap(([character,forms])=>Object.entries(forms).map(([key,commands])=>({character,key,commands,original:raw.glyphForCodePoint(character.charCodeAt(0)).path.commands}))):undefined,
   getVariation:(v:typeof values)=>at(v,forms),withConstructions:(keys:string[])=>at(values,keys),glyphForCodePoint:(cp:number)=>glyph(font.glyphForCodePoint(cp)),getGlyph:(id:number)=>glyph(font.getGlyph(id)),
   shape(text:string,features:Record<string,boolean>){
    shaper.setVariations(variable?Object.entries(native).map(([tag,value])=>new hb.Variation(tag,value)):[]);
    const buffer=new hb.Buffer();buffer.addText(text);buffer.guessSegmentProperties();const shapingFeatures=Object.entries(features).map(([tag,value])=>new hb.Feature(tag,Number(value)));
    hb.shape(shaper,buffer,shapingFeatures);
    const infos=buffer.getGlyphInfos(),positions=buffer.getGlyphPositions().map(p=>({...p,xAdvance:p.xAdvance*(synthetic.wdth/100),xOffset:p.xOffset*(synthetic.wdth/100)}));
    return {glyphs:infos.map(g=>glyph(font.getGlyph(g.codepoint))),positions,clusters:infos.map(g=>g.cluster)};
   }
  };
  return instance;
 };
 return at({wght:450,wdth:100,slnt:0});
}
