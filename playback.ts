import {Timeline,clockProgress,pace,timeLabel} from './timeline';
import type {Weights} from './weights';
export function setupPlayback(options:{route:()=>[Weights,Weights];begin:()=>void;frame:(weights:Weights,position:number)=>Promise<void>;exit:()=>void;error:(e:unknown)=>void}){
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const mode=$<HTMLSelectElement>('time-mode'),amount=$<HTMLInputElement>('time-duration'),unit=$<HTMLSelectElement>('time-unit'),easing=$<HTMLSelectElement>('time-pace');
 const slider=$<HTMLInputElement>('time-position'),play=$<HTMLButtonElement>('time-play'),state=$('time-state');
 const clockStart=$<HTMLInputElement>('time-start'),clockEnd=$<HTMLInputElement>('time-end');
 const timeline=new Timeline();let following=false,position=0,raf=0,busy=false,pending=false,forcePending=false,lastDrawn=-1;
 const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
 const running=()=>following||timeline.running;
 function current(){position=following?clockProgress(new Date(),minutes(clockStart.value),minutes(clockEnd.value)):timeline.sample(Date.now());return position;}
 function labels(){
  slider.value=String(position*100);$('time-percent').textContent=(position*100).toFixed(1)+'%';
  play.textContent=running()?'Pause':mode.value==='clock'?'Follow clock':position===1?'Replay':'Play';
  $('time-elapsed').textContent=mode.value==='clock'?`${clockStart.value} → ${clockEnd.value} · local time`:`${timeLabel(position*timeline.duration)} / ${timeLabel(timeline.duration)}`;
  const message=running()?(following?'Following the clock':'Playing'):position===1?'Complete':'Paused';if(state.textContent!==message)state.textContent=message;
  $('monaspace-field').dataset.playing=String(running());$('monaspace-field').dataset.timePosition=String(position);
 }
 function pause(){if(following){position=current();following=false;timeline.seek(position,Date.now());}timeline.pause(Date.now());position=timeline.position;cancelAnimationFrame(raf);raf=0;labels();}
 async function present(force=false){
  forcePending||=force;if(busy){pending=true;return;}busy=true;
  try{do{pending=false;const p=current(),t=pace(p,easing.value==='ease');labels();
   if(forcePending||Math.abs(t-lastDrawn)>.00005||((t===0||t===1)&&t!==lastDrawn)){forcePending=false;const [a,b]=options.route();const w=(t===0?[...a]:t===1?[...b]:a.map((v,i)=>v+(b[i]-v)*t)) as Weights;await options.frame(w,t);lastDrawn=t;}
  }while(pending);}catch(e){pause();options.error(e);}finally{busy=false;}
 }
 async function tick(){raf=0;if(!running())return;await present();if(running()&&!raf)raf=requestAnimationFrame(tick);}
 function validate(){try{if(mode.value==='duration'){if(!amount.checkValidity())throw new Error('Enter a valid duration.');timeline.setDuration(Number(amount.value)*Number(unit.value)*1000,Date.now());}else clockProgress(new Date(),minutes(clockStart.value),minutes(clockEnd.value));state.removeAttribute('role');return true;}catch(e){state.textContent=String((e as Error).message);state.setAttribute('role','alert');return false;}}
 play.addEventListener('click',async()=>{if(running()){pause();await present(true);return;}if(!validate())return;options.begin();if(mode.value==='clock')following=true;else timeline.play(Date.now());await present(true);if(running()&&!raf)raf=requestAnimationFrame(tick);});
 slider.addEventListener('input',()=>{const next=Number(slider.value)/100;pause();timeline.seek(next,Date.now());position=timeline.position;options.begin();present(true);});
 $('time-reset').addEventListener('click',()=>{pause();timeline.seek(0,Date.now());position=0;options.begin();present(true);});
 $('time-exit').addEventListener('click',()=>{pause();options.exit();});
 const changed=()=>{pause();$('time-duration-fields').hidden=mode.value!=='duration';$('time-clock-fields').hidden=mode.value!=='clock';labels();validate();};
 for(const input of [mode,amount,unit,clockStart,clockEnd])input.addEventListener('change',changed);
 easing.addEventListener('change',()=>{pause();options.begin();present(true);});
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-time-preset]'))button.addEventListener('click',()=>{mode.value='duration';const seconds=Number(button.dataset.timePreset);unit.value=seconds>=3600?'3600':seconds>=60?'60':'1';amount.value=String(seconds/Number(unit.value));changed();});
 labels();return {pause,restore:(p:number)=>{changed();timeline.seek(p,Date.now());position=timeline.position;labels();},refresh:()=>present(true),leave:()=>{pause();options.exit();}};
}
