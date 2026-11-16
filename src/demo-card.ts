export function resizeCard(key:string){
 const stage=document.querySelector<HTMLElement>('.card-stage')!,root=stage.parentElement!;
 const limit=()=>({width:root.clientWidth,height:Math.max(160,root.clientHeight-Array.from(root.children).filter(e=>e!==stage&&!(e as HTMLElement).hidden).reduce((n,e)=>n+(e as HTMLElement).offsetHeight,0)-(Array.from(root.children).filter(e=>!(e as HTMLElement).hidden).length-1)*parseFloat(getComputedStyle(root).gap)-12)});
 const apply=(width:number,height?:number)=>{const max=limit();stage.style.aspectRatio='auto';stage.style.width=Math.max(180,Math.min(max.width,width))+'px';if(height!==undefined){stage.style.flex='0 0 auto';stage.style.height=Math.max(160,Math.min(max.height,height))+'px';stage.style.marginBlock='auto';}};
 const save=()=>{const r=stage.getBoundingClientRect();localStorage.setItem(key,JSON.stringify({width:r.width,height:stage.style.height?r.height:null}));};
 try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(saved&&Number.isFinite(saved.width))apply(saved.width,Number.isFinite(saved.height)?saved.height:undefined);}catch{}
 for(const edge of ['left','right','bottom']){
  const handle=document.createElement('button');handle.className='resize-edge '+edge;handle.type='button';handle.setAttribute('aria-label','Resize card '+edge+' edge');handle.title='Drag to resize';stage.append(handle);
  let drag:{x:number,y:number,width:number,height:number}|undefined;
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const r=stage.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,width:r.width,height:r.height};handle.setPointerCapture(e.pointerId);};
  handle.onpointermove=e=>{if(!drag)return;apply(edge==='bottom'?drag.width:drag.width+(e.clientX-drag.x)*2*(edge==='left'?-1:1),edge==='bottom'?drag.height+e.clientY-drag.y:undefined);};
  const end=()=>{if(drag){drag=undefined;save();}};handle.onpointerup=end;handle.onpointercancel=end;
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r=stage.getBoundingClientRect(),delta=(e.shiftKey?1:10)*(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1);apply(edge==='bottom'?r.width:r.width+delta,edge==='bottom'?r.height+delta:undefined);save();};
 }
}
