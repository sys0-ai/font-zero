import {timesAlternateKeys} from './times-forms';
import {arialAlternateKeys} from './arial-forms';
import signatures from './construction-signatures.json';
import {catalog} from './catalog';
import {papyrusAlternateKeys} from './papyrus-forms';
import {comicAlternateKeys} from './comic-forms';
export const variantBase=(entry:typeof catalog[number])=>entry.variant==='papyrus-alternates'?'papyrus':entry.variant==='comic-sans-universal'?'comic-sans':entry.variant==='arial-alternates'?'arial':entry.variant==='times-universal'?'times-new-roman':entry.id;
const native=(i:number)=>(signatures as Record<string,string[]>)[variantBase(catalog[i])];
function options(index:number,character:number){const key=native(index)[character];return catalog[index].variant?[key,...((catalog[index].variant==='comic-sans-universal'?comicAlternateKeys:catalog[index].variant==='arial-alternates'?arialAlternateKeys:catalog[index].variant==='times-universal'?timesAlternateKeys:papyrusAlternateKeys)[String.fromCharCode(character+33)]??[])]:[key];}
/** Each construction option a font offers for every printable ASCII character, in the order the signatures keep. */
export const formOptions=(index:number)=>native(index).map((_,i)=>options(index,i));
// `chars`, when given, limits the check to the characters actually drawn: two fonts whose ampersands differ still
// blend a text without one.
const used=(chars?:string)=>{const set=chars===undefined?undefined:new Set(chars);return (i:number)=>!set||set.has(String.fromCharCode(i+33));};
export function differentLetters(indices:number[],chars?:string):string[]{
 if(indices.length<2)return [];
 const drawn=used(chars);
 return native(indices[0]).flatMap((_,i)=>!drawn(i)||options(indices[0],i).some(key=>indices.every(id=>options(id,i).includes(key)))?[]:[String.fromCharCode(i+33)]);
}
export function compatibleFormsFor(indices:number[],chars?:string):string[]{
 assertCompatible(indices,chars);
 const preferred=indices.find(i=>!catalog[i].variant)??indices[0];
 if(preferred===undefined)return signatures.papyrus;
 const drawn=used(chars);
 return native(preferred).map((_,i)=>drawn(i)?options(preferred,i).find(key=>indices.every(id=>options(id,i).includes(key)))!:options(preferred,i)[0]);
}
export function assertCompatible(indices:number[],chars?:string){
 const different=differentLetters(indices,chars);if(different.length)throw new Error('These fonts cannot blend: different constructions for '+different.join(', ')+'.');
}
