import {differentLetters} from './compatibility';
import {catalog} from './catalog';
import {defaultStyle,mixStyle,type TextStyle} from './style-route';
export const moods=[
 ['soft','soft rounded cute gentle friendly booba warm pastel',{wght:350,wdth:112,color:'#8c77ac',shadowOpacity:.12,shadowBlur:8,shadowY:3}],
 ['sharp','sharp angular bold severe assertive kiki precise',{wght:680,wdth:100,color:'#25252b',tracking:1}],
 ['space','futuristic science fiction spaceship robotic technical cyberpunk',{wght:500,tracking:2,color:'#445d99',glow:2,glowColor:'#88caff'}],
 ['circus','playful circus carnival joyful colorful fun cartoon festive',{wght:750,color:'#ce3c45',shadowOpacity:.65,shadowX:3,shadowY:4,shadowColor:'#efb84c',outline:.5}],
 ['luxury','elegant luxury refined fashion graceful romantic sophisticated',{wght:300,tracking:1.2,color:'#8b7042',shadowOpacity:.12,shadowBlur:5}],
 ['book','traditional literary newspaper scholarly serious formal editorial',{wght:450,color:'#302e29',size:30}],
 ['human','natural handwritten spontaneous friendly human personal diary',{wght:420,slnt:-3,temperature:.2,edgeRoughness:35,color:'#4a5269'}],
 ['forest','organic forest earthy green nature rustic quiet calm',{wght:450,edgeRoughness:55,color:'#4b6650',shadowOpacity:.18,shadowColor:'#879b66',shadowBlur:4}],
 ['neon','neon glowing luminous nightlife electric nightclub colorful light',{wght:450,color:'#cc55ff',glow:7,glowColor:'#aa55ff',shadowOpacity:.4,shadowColor:'#6366ff',shadowBlur:8}],
 ['retro','retro vintage nostalgic old fashioned nostalgic warm poster',{wght:600,color:'#af6546',shadowOpacity:.3,shadowX:2,shadowY:3,shadowColor:'#d8b87f'}],
 ['minimal','minimal clean clear simple modern understated neutral',{wght:400,color:'#333333',tracking:.3}],
 ['dramatic','dramatic dark gothic mysterious powerful theatrical cinematic',{wght:700,color:'#572b3b',shadowOpacity:.45,shadowBlur:5,shadowY:6}]
] as const;
const baseDescriptions=['angular precise technical monospace computer Krypton','modern clean geometric friendly monospace Argon','human lively handwritten informal organic Radon','playful friendly casual hand printed childlike Comic Sans','organic ancient rustic hand drawn Egyptian Papyrus','traditional newspaper literary formal editorial Times New Roman','neutral clean simple modern familiar Arial','warm literary clear traditional refined serif Georgia','typewriter vintage mechanical technical Courier New'];
export const descriptions=[...catalog.map((f,i)=>'Typography with a '+(f.description??baseDescriptions[i])+' personality.'),...moods.map(m=>'An aesthetic that is '+m[1]+'.')];
export function semanticStyle(scores:number[],allowed=catalog.map((_,i)=>i)):{style:TextStyle;matches:{index:number;score:number}[];moods:string[]}{
 const matches=scores.slice(0,catalog.length).map((score,index)=>({score,index})).filter(m=>allowed.includes(m.index)).sort((a,b)=>b.score-a.score||a.index-b.index).reduce((picked,m)=>picked.length<3&&!differentLetters([...picked.map(p=>p.index),m.index]).length?[...picked,m]:picked,[] as {score:number;index:number}[]),high=matches[0].score,shares=matches.map(m=>Math.exp((m.score-high)/.035)),sum=shares.reduce((a,b)=>a+b,0);
 const weights=catalog.map(()=>0);matches.forEach((m,i)=>weights[m.index]=shares[i]/sum);
 const ranked=scores.slice(catalog.length).map((score,index)=>({score,index})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3),max=ranked[0].score,amounts=ranked.map(m=>Math.exp((m.score-max)/.045));
 let style=defaultStyle(weights),total=0;
 ranked.forEach((m,i)=>{const recipe={...defaultStyle(weights),...moods[m.index][2]} as TextStyle;const fraction=amounts[i]/(total+amounts[i]);style=mixStyle(style,recipe,fraction);total+=amounts[i];});
 return {style,matches,moods:ranked.map(m=>moods[m.index][0])};
}
export function setupSeeds(apply:(style:TextStyle)=>void,allowed:()=>number[]){
 const $=(id:string)=>document.getElementById(id)!,input=$('seed-words') as HTMLTextAreaElement,files=$('seed-images') as HTMLInputElement,status=$('seed-status'),button=$('seed-match') as HTMLButtonElement;
 let worker:Worker|undefined,request=0,images:string[]=[];
 files.addEventListener('change',async()=>{images=await Promise.all(Array.from(files.files??[]).map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);})));$('seed-previews').replaceChildren(...images.map(src=>{const image=new Image();image.src=src;image.alt='Seed image';return image;}));});
 button.addEventListener('click',()=>{
  if(!input.value.trim()&&!images.length){status.textContent='Enter seed words or choose an image.';return;}
  button.disabled=true;request++;worker??=new Worker('semantic-worker.js',{type:'module'});
  worker.onerror=e=>{status.textContent='Semantic matching could not start: '+e.message;button.disabled=false;};
  worker.onmessage=e=>{const d=e.data;if(d.type==='progress'){status.textContent=d.message;return;}if(d.id!==request)return;button.disabled=false;if(d.type==='error'){status.textContent='Could not match seeds: '+d.message;return;}
   const result=semanticStyle(d.scores,allowed());apply(result.style);status.textContent=result.moods.join(' · ');$('seed-results').replaceChildren(...result.matches.map(m=>{const p=document.createElement('p');p.textContent=catalog[m.index].name+' · '+Math.round(result.style.weights[m.index]*100)+'%';return p;}));
  };
  worker.postMessage({id:request,words:input.value,images,descriptions});
 });
}
