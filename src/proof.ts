import {texturePath} from './edge-texture';
import {axes,prepareGlyph,mix,progression,pause,type Settings} from './render';
import {measureGeometry} from './outline-union';
import {assessGeometry} from './quality';
import type {Weights} from './weights';
export async function inspectTransition(fonts:any[],start:Weights,end:Weights,settings:Settings,target:HTMLElement,status:HTMLElement,sample?:(t:number)=>{weights:Weights;settings:Settings;fonts?:any[]}){
 target.replaceChildren();status.textContent='Checking construction across 11 stops…';
 const characters=[...'argsenmo'];
 let flagged=0;
 for(let step=0;step<=10;step++){
  const selectedScene=sample?.(step/10),scene=selectedScene?.settings??settings,weights=selectedScene?.weights??mix(start,end,progression(step,11));
  const fs=selectedScene?.fonts??fonts.map(f=>f.getVariation(axes({...scene,temperature:0},0))),shapes=characters.map(c=>prepareGlyph(fs.map(f=>f.glyphForCodePoint(c.charCodeAt(0))),fs,c,scene.support?fs.flatMap((_,i)=>scene.support!.includes(i%fonts.length)?[i]:[]):undefined)),sources=shapes.map(s=>s.originals.map(measureGeometry));
  const paths=shapes.map(s=>texturePath(s.draw(weights,scene.smoothing,scene.structured),scene.edgeRoughness,scene.edgeScale,scene.seed));
  const selected=shapes.map(s=>s.resolve(weights));
  const results=paths.map((p,i)=>assessGeometry(p,sources[i],selected[i].weights));
  const issues=results.flatMap((r,i)=>r.issues.map(issue=>characters[i]+': '+issue));
  if(issues.length)flagged++;
  const row=document.createElement('div');row.className='quality-stop';row.dataset.needsWork=String(issues.length>0);
  const label=document.createElement('span');label.textContent=step*10+'%';label.title=fs.map(f=>f.source.name).join(' / ')+': '+weights.map(v=>Math.round(v*100)+'%').join(' / ');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 -75 ${characters.length*72} 110`);svg.setAttribute('role','img');svg.setAttribute('aria-label',characters.join(' ')+' at stop '+step);
  paths.forEach((d,i)=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('transform',`translate(${i*72} 0)`);path.setAttribute('fill','currentColor');path.setAttribute('fill-rule','nonzero');svg.append(path);});
  const note=document.createElement('small');note.textContent=(issues.length?issues.join(' · '):'No geometry flags');
  note.title=results.map((r,i)=>`${characters[i]} (${selected[i].family.name}): ink ${r.inkDrift.toFixed(1)}%; stroke ${r.strokeDrift===null?'not measured':r.strokeDrift.toFixed(1)+'%'}; counters ${r.measures.counters}; crossings ${r.measures.crossings}`).join('\n');
  row.append(label,svg,note);target.append(row);await pause();
 }
 status.textContent=`${flagged} of 11 stops have geometry flags. Only matching native constructions can blend. This is a proof for inspection, not a quality certificate.`;
}
