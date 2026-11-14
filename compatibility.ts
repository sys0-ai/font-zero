import signatures from './construction-signatures.json';
import {catalog} from './catalog';
import {papyrusAlternateKeys} from './papyrus-forms';
const native=(i:number)=>(signatures as Record<string,string[]>)[catalog[i].variant?'papyrus':catalog[i].id];
function options(index:number,character:number){const key=native(index)[character];return catalog[index].variant?[key,...(papyrusAlternateKeys[String.fromCharCode(character+33)]??[])]:[key];}
export function differentLetters(indices:number[]):string[]{
 if(indices.length<2)return [];
 return native(indices[0]).flatMap((_,i)=>options(indices[0],i).some(key=>indices.every(id=>options(id,i).includes(key)))?[]:[String.fromCharCode(i+33)]);
}
export function papyrusFormsFor(indices:number[]):string[]{
 assertCompatible(indices);
 return signatures.papyrus.map((key,i)=>{const required=indices.find(id=>!catalog[id].variant);return required===undefined?key:native(required)[i];});
}
export function assertCompatible(indices:number[]){
 const different=differentLetters(indices);if(different.length)throw new Error('These fonts cannot blend: different constructions for '+different.join(', ')+'.');
}
