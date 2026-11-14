import {timesAlternateKeys} from './times-forms';
import {arialAlternateKeys} from './arial-forms';
import signatures from './construction-signatures.json';
import {catalog} from './catalog';
import {papyrusAlternateKeys} from './papyrus-forms';
import {comicAlternateKeys} from './comic-forms';
export const variantBase=(entry:typeof catalog[number])=>entry.variant==='papyrus-alternates'?'papyrus':entry.variant==='comic-sans-universal'?'comic-sans':entry.variant==='arial-alternates'?'arial':entry.variant==='times-universal'?'times-new-roman':entry.id;
const native=(i:number)=>(signatures as Record<string,string[]>)[variantBase(catalog[i])];
function options(index:number,character:number){const key=native(index)[character];return catalog[index].variant?[key,...((catalog[index].variant==='comic-sans-universal'?comicAlternateKeys:catalog[index].variant==='arial-alternates'?arialAlternateKeys:catalog[index].variant==='times-universal'?timesAlternateKeys:papyrusAlternateKeys)[String.fromCharCode(character+33)]??[])]:[key];}
export function differentLetters(indices:number[]):string[]{
 if(indices.length<2)return [];
 return native(indices[0]).flatMap((_,i)=>options(indices[0],i).some(key=>indices.every(id=>options(id,i).includes(key)))?[]:[String.fromCharCode(i+33)]);
}
export function compatibleFormsFor(indices:number[]):string[]{
 assertCompatible(indices);
 const preferred=indices.find(i=>!catalog[i].variant)??indices[0];
 if(preferred===undefined)return signatures.papyrus;
 return native(preferred).map((_,i)=>options(preferred,i).find(key=>indices.every(id=>options(id,i).includes(key)))!);
}
export function assertCompatible(indices:number[]){
 const different=differentLetters(indices);if(different.length)throw new Error('These fonts cannot blend: different constructions for '+different.join(', ')+'.');
}
