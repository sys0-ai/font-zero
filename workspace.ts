export function openControl(name:string){
 const section=document.getElementById('section-'+name) as HTMLDetailsElement;
 section.open=true;const summary=section.querySelector('summary')!;summary.focus({preventScroll:true});summary.scrollIntoView({block:'nearest'});
}
export function setupWorkspace(onView:(name:string)=>void){
 const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-view]'));
 const select=(button:HTMLButtonElement)=>{
  for(const b of buttons){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.getElementById(b.getAttribute('aria-controls')!)!.hidden=!active;}
  onView(button.dataset.view!);
 };
 buttons.forEach(b=>b.addEventListener('click',()=>select(b)));
 buttons[0].parentElement!.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  let index=buttons.findIndex(b=>b===document.activeElement);
  index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  buttons[index].focus();select(buttons[index]);
 });
 document.getElementById('collapse-controls')!.onclick=()=>document.querySelectorAll<HTMLDetailsElement>('.control-section').forEach(section=>section.open=false);
}
