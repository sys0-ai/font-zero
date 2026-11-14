import {catalog} from './catalog';
import {differentLetters,compatibleFormsFor,variantBase} from './compatibility';
import signatures from './construction-signatures.json';
import {sourcePath} from './curves';
export function showCompatibility(indices:number[]){
 const variants=indices.filter(i=>catalog[i].variant);
 document.getElementById('forms-summary')!.textContent=indices.map(i=>catalog[i].name).join(' · ');
 const selected=compatibleFormsFor(indices);
 document.getElementById('papyrus-coverage')!.textContent=variants.length?variants.map(index=>{
  const entry=catalog[index],native=(signatures as Record<string,string[]>)[variantBase(entry)],changed=selected.flatMap((key,i)=>key!==native[i]?[String.fromCharCode(i+33)]:[]),coverage=catalog.filter((f,i)=>!f.variant&&!differentLetters([index,i]).length).length;
  return `${entry.name}: 14 drawn alternatives for 11 characters; compatible with ${coverage} ordinary font profiles. Active alternates: ${changed.join(', ')||'none'}.`;
 }).join(' '):'Universal variants supply drawn ordinary-text alternatives. Dotted, stencil and other unsupported constructions remain blocked.';

}
export function showPapyrusProof(font:any){
 const target=document.getElementById('papyrus-form-proof')!;if(target.dataset.font===font.source.id)return;target.dataset.font=font.source.id;target.replaceChildren();
 for(const form of font.alternateProof()){
  const figure=document.createElement('figure'),label=document.createElement('figcaption');const labels:Record<string,string[]>={'0':['Dotted zero','Slashed zero'],'4':['Open four'],'6':['Closed six'],'9':['Closed nine'],'B':['Open upper bowl'],'R':['Open bowl'],'@':['Open inner bowl'],'$':['Broken bar'],'&':['One loop','Two loops']};label.textContent=form.character+' · '+(labels[form.character]?.[Number(form.key.split(':').at(-1))===2?1:0]??form.key.split(':')[0]);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','-20 -85 170 145');svg.setAttribute('role','img');svg.setAttribute('aria-label',form.character+': original left, alternate right');
  for(const [i,commands]of [form.original,form.commands].entries()){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',sourcePath(commands,i*85,0,100/font.unitsPerEm));path.setAttribute('fill',i?'currentColor':'#888');svg.append(path);}
  figure.append(svg,label);target.append(figure);
 }
}
