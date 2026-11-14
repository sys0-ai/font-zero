import type {TextStyle} from './style-route';
export function setupStyleControls(get:()=>TextStyle,set:(style:TextStyle,attribute:keyof TextStyle)=>void){
 const $=(id:string)=>document.getElementById(id)!;
 const groups:Record<string,[keyof TextStyle,string,number?,number?,number?][]>= {
  size:[['size','Font size',10,160,1]],
  layout:[['tracking','Letter spacing',-4,12,.1],['leading','Line spacing',1,2.5,.05]],
  texture:[['edgeRoughness','Ragged edges',0,100,1],['edgeScale','Grain size',.5,3,.1]],
  ink:[['color','Ink color'],['opacity','Opacity',0,1,.01],['outline','Outline',0,5,.1],['outlineColor','Outline color'],['blur','Blur',0,8,.1]],
  shadow:[['shadowX','Horizontal offset',-30,30,.5],['shadowY','Vertical offset',-30,30,.5],['shadowBlur','Softness',0,25,.5],['shadowOpacity','Strength',0,1,.01],['shadowColor','Shadow color']],
  glow:[['glow','Glow radius',0,20,.5],['glowColor','Glow color']]
 };
 for(const [group,fields]of Object.entries(groups))for(const [key,label,min,max,step]of fields){
  const row=document.createElement('label');row.className='style-attribute';row.htmlFor='style-'+key;
  row.innerHTML=`<span>${label}<output id="style-${key}-value"></output></span><input id="style-${key}" type="${min===undefined?'color':'range'}" ${min===undefined?'':`min="${min}" max="${max}" step="${step}"`}>`;
  $(group==='size'?'quick-size':group==='layout'?'layout-controls':'effects-'+group).append(row);
  row.querySelector('input')!.addEventListener('input',e=>{const input=e.target as HTMLInputElement;set({...get(),[key]:min===undefined?input.value:Number(input.value)},key);});
 }
 const size=$('style-size') as HTMLInputElement;
 const row=size.closest('label')!,heading=row.querySelector('span')!,output=$('style-size-value');
 const container=document.createElement('div');container.className=row.className;
 const caption=document.createElement('label');caption.htmlFor=size.id;caption.textContent='Font size';
 const value=document.createElement('span');value.className='size-value';
 const number=document.createElement('input');number.id='style-size-number';number.type='number';number.min=size.min;number.max=size.max;number.step=size.step;number.setAttribute('aria-label','Font size in pixels');
 const unit=document.createElement('span');unit.textContent='px';value.append(number,unit);heading.replaceChildren(caption,value);output.hidden=true;heading.append(output);container.append(heading,size);row.replaceWith(container);
 number.addEventListener('input',()=>{const n=number.valueAsNumber;if(Number.isFinite(n)&&n>=Number(size.min)&&n<=Number(size.max))set({...get(),size:n},'size');});
 number.addEventListener('change',()=>{number.value=String(get().size);});
 return ()=>{const style=get();number.value=String(style.size);for(const fields of Object.values(groups))for(const [key]of fields){($('style-'+key) as HTMLInputElement).value=String(style[key]);$('style-'+key+'-value').textContent=typeof style[key]==='number'?String(Number((style[key] as number).toFixed(2))):'';}};
}
