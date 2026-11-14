import {PreviewSize} from './preview-size';
import {localFonts} from './runtime';
import {StoryPreview} from './story-preview';
import {downloadFont} from './download-font';
import {setupStyleControls} from './style-controls';
import {setupSeeds} from './semantic';
import {defaultStyle,cloneStyle,insertStop,routeStyle,routeSpan,effectAttributes,type TextStyle,type TextStop} from './style-route';
import {setupFontMap,lockMapWeights} from './font-map';
import {showCompatibility,showPapyrusProof} from './forms';
import {differentLetters,assertCompatible,papyrusFormsFor} from './compatibility';
import {healWords,inkOf,stretchPath,wordIds} from './word-healing';
import {setupPlayback} from './playback';
import {type TransitionSampling} from './field';
import {finishPath} from './edge-texture';
import {clamp} from './math';
import {axes,prepareOutline,translateOutline,type Settings} from './render';
import {TextPreview,wrapText} from './text-preview';
import {setupWorkspace,openControl} from './workspace';
import {specimens} from './specimens';
import {makeFont} from './export-font';
import {inspectTransition} from './proof';
import {sourcePath, outlineFillRule} from './curves';
import {catalog,entryForFont} from './catalog';
import {loadFont} from './font-library';
import {pole, setWeight, freeBudget, type Locks, type Weights} from './weights';

const root=document.getElementById('monaspace-field')!;
const $=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
const status=$('type-status');
const text=$<HTMLTextAreaElement>('sample-text');
const target=$<HTMLSelectElement>('field-target');
const names=catalog.map(f=>f.name),count=names.length;
const initialFonts=localFonts?[5,7]:['gf-crimsonpro','gf-librecaslontext'].map(id=>catalog.findIndex(f=>f.id===id));
if(initialFonts.some(i=>i<0))throw new Error('Missing initial font');
const available=(i:number)=>localFonts||!catalog[i].file;
const equal=()=>names.map((_,i)=>initialFonts.includes(i)?.5:0);
const temperature=$<HTMLInputElement>('temperature');
const direction=$<HTMLSelectElement>('field-direction');
const boundary=$<HTMLInputElement>('show-boundary');
const perLetter=$<HTMLInputElement>('per-letter');
const svg=$<SVGSVGElement & HTMLElement>('outline-view');
const outline=root.querySelector<SVGPathElement>('#outline-path')!;
outline.setAttribute('fill-rule',outlineFillRule);
interface State {text:string;weights:Weights;target:number;temperature:number;direction:string;seed:number;perLetter:boolean;boundary:boolean}
let state:State={text:'kikibooba\nminimum',weights:equal(),target:initialFonts[1],temperature:0,direction:'uniform',seed:12,perLetter:false,boundary:false};
let fonts:any[]=[],fontIndices:number[]=[],fontFormsKey='';
const loadedFonts=new Map<number,any>();
const renderWeights=(w:Weights)=>fontIndices.map(i=>w[i]);
let timePreview=false,activeView='letters';
let playback:ReturnType<typeof setupPlayback>;
let sampling:TransitionSampling='letter',transitionCode=false,wordHealing=0;
const settings:Settings={wght:450,wdth:100,slnt:0,temperature:0,edgeRoughness:0,edgeScale:1,seed:12,smoothing:.6,healing:true,ligatures:true,structured:true};
let startWeights:Weights=pole(count,initialFonts[0]),endWeights:Weights=pole(count,initialFonts[1]),editing='preview',previewWeights:Weights=equal();
let look=defaultStyle(equal());look.size=64;let previewLook=cloneStyle(look),nextStop=2;
const textLength=()=>Math.max(2,$<HTMLTextAreaElement>('long-text').value.length);
let stops:TextStop[]=[{id:0,at:0,style:defaultStyle(startWeights),ease:'smooth'},{id:1,at:textLength()-1,style:defaultStyle(endWeights),ease:'smooth'}];
let useStops=true,timePosition=0,fontPage=0;
const pointLocks:Record<string,Locks>={preview:names.map(()=>false),start:names.map(()=>false),end:names.map(()=>false)};
const pointFonts:Record<string,number[]>={preview:[...initialFonts],start:[...initialFonts],end:[...initialFonts]};
const selectedFonts=()=>pointFonts[editing]??=[];
const selectedAcrossText=()=>[...new Set([...Object.values(pointFonts).flat(),state.target])];
const mixerLocks=()=>pointLocks[editing].map((locked,i)=>locked||!selectedFonts().includes(i));
let language='JavaScript',fontSize=20,proofRevision=0,codePage=0,codePages=1;
const passage=new TextPreview($<SVGSVGElement & HTMLElement>('passage-view'));
const story=new StoryPreview($<SVGSVGElement & HTMLElement>('passage-view'));
const codePreview=new TextPreview($<SVGSVGElement & HTMLElement>('code-view'));
for(const [i,name] of names.entries()){
 const row=document.createElement('div');row.className='font-share';row.dataset.font=String(i);
 row.innerHTML=`<div class="font-share-heading"><button id="anchor-${i}" aria-label="Use only ${name}" aria-pressed="false">${name}</button><output id="weight-value-${i}" for="weight-${i}"></output><label class="weight-lock"><input id="lock-${i}" type="checkbox" aria-label="Lock ${name} percentage">Lock</label><button class="remove-font" id="remove-font-${i}" aria-label="Remove ${name}">Remove</button></div><label class="sr-only" for="weight-${i}">${name} percentage</label><input id="weight-${i}" type="range" min="0" max="100" step=".1" value="${100/count}">`;
 $('font-mixer').append(row);
}
target.replaceChildren(...names.map((name,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=name;return o;}));
let updateMap=(_w:Weights,_a:Weights,_b:Weights)=>{};
let mapFonts='',fontListKey='';
function installMap(){
 const old=$<SVGSVGElement & HTMLElement>('font-map'),map=old.cloneNode(false) as SVGSVGElement;old.replaceWith(map);
 const indices=[...selectedFonts()];mapFonts=indices.join(',');const expand=(w:Weights)=>{const full=names.map(()=>0);indices.forEach((id,i)=>full[id]=w[i]);return full;};
 const update=setupFontMap(map,indices.map(i=>names[i]),w=>changeWeights(expand(w)),()=>indices.map(i=>state.weights[i]),()=>indices.map(i=>pointLocks[editing][i]));
 updateMap=(w,a,b)=>{const project=(v:Weights)=>indices.map(i=>v[i]),has=(v:Weights)=>v.every((n,i)=>n<1e-12||indices.includes(i));update(project(w),project(has(a)?a:w),project(has(b)?b:w));};
}
async function ensureFonts(){
 const points=()=>[state.weights,previewWeights,startWeights,endWeights,...stops.map(s=>s.style.weights),pole(count,state.target)];
 while(true){const missing=catalog.flatMap((_,i)=>!loadedFonts.has(i)&&available(i)&&(selectedAcrossText().includes(i)||points().some(w=>w[i]>1e-12))?[i]:[]);if(!missing.length)break;status.textContent='Loading '+missing.length+' font'+(missing.length===1?'':'s')+'…';await Promise.all(missing.map(async i=>loadedFonts.set(i,await loadFont(catalog[i].id))));}
 const indices=[...loadedFonts.keys()].sort((a,b)=>a-b);
 const forms=papyrusFormsFor([...selectedAcrossText(),state.target]),key=forms.join('|');
 if(indices.join(',')===fontIndices.join(',')&&key===fontFormsKey)return;
 fontFormsKey=key;fontIndices=indices;fonts=indices.map(i=>catalog[i].variant?loadedFonts.get(i).withConstructions(forms):loadedFonts.get(i));installMap();
 const alternate=fonts.find(f=>f.source.variant);if(alternate)showPapyrusProof(alternate);

 lettersDirty=passageDirty=codeDirty=true;labels();
}
function filterFonts(){
 const selected=selectedFonts(),all=selectedAcrossText(),compatibleOnly=$<HTMLInputElement>('compatible-only').checked,listKey=String(compatibleOnly)+'|'+all.join(',')+'|'+selected.join(',')+'/'+fontPage+'/'+$<HTMLInputElement>('font-search').value;
 if(listKey===fontListKey)return; fontListKey=listKey;
 root.querySelectorAll<HTMLElement>('.font-share').forEach(row=>row.hidden=!selected.includes(Number(row.dataset.font)));
 const query=$<HTMLInputElement>('font-search').value.toLowerCase(),matches=catalog.flatMap((f,i)=>available(i)&&!selected.includes(i)&&f.name.toLowerCase().includes(query)&&(!compatibleOnly||differentLetters([...all,i]).length===0)?[i]:[]),pages=Math.max(1,Math.ceil(matches.length/6));fontPage=Math.min(fontPage,pages-1);
 $('font-results').replaceChildren(...matches.slice(fontPage*6,fontPage*6+6).map(i=>{
  const row=document.createElement('div');row.className='font-result';const info=document.createElement('span');info.textContent=names[i];
  const differences=differentLetters([...all,i]),reason=document.createElement('small');reason.textContent=differences.length?'Different: '+differences.slice(0,8).join(', ')+(differences.length>8?'…':''):'Compatible';info.append(reason);
  const add=document.createElement('button');add.textContent='Add';add.setAttribute('aria-label','Add '+names[i]);add.disabled=differences.length>0;add.title=differences.length?'Different letter constructions: '+differences.join(', '):'Add to blend';
  add.onclick=()=>{assertCompatible([...selectedAcrossText(),i]);selectedFonts().push(i);labels();requestPaint();$<HTMLDetailsElement>('font-library').open=false;$('weight-'+i).focus();};
  const solo=document.createElement('button');solo.textContent='Use alone';solo.setAttribute('aria-label','Use '+names[i]+' alone');solo.title='Replace fonts at every text stop';solo.onclick=()=>useFontAlone(i);
  row.append(info,add,solo);return row;
 }));
 const allowed=names.map((_,i)=>differentLetters([...all,i]).length===0);Array.from(target.options).forEach((option,i)=>option.disabled=!available(i)||!allowed[i]);
 showCompatibility(all);

 $('font-page').textContent=matches.length?`${fontPage+1} / ${pages} · ${matches.length} available`:'No matching fonts';$<HTMLButtonElement>('font-prev').disabled=fontPage===0;$<HTMLButtonElement>('font-next').disabled=fontPage===pages-1;
 if(mapFonts!==selected.join(','))installMap();
}
$('compatible-only').addEventListener('change',()=>{fontPage=0;filterFonts();});
$('font-search').addEventListener('input',()=>{fontPage=0;filterFonts();});$('font-prev').onclick=()=>{fontPage--;filterFonts();};$('font-next').onclick=()=>{fontPage++;filterFonts();};
const currentStop=()=>editing==='start'?stops[0]:editing==='end'?stops.at(-1):stops.find(s=>'stop-'+s.id===editing);
function commitStyle(){
 look={...look,weights:[...state.weights],wght:settings.wght,wdth:settings.wdth,slnt:settings.slnt,smoothing:settings.smoothing,temperature:state.temperature};
 const stop=currentStop();if(stop)stop.style=cloneStyle(look);else{previewLook=cloneStyle(look);previewWeights=[...look.weights];}
 startWeights=[...stops[0].style.weights];endWeights=[...stops.at(-1)!.style.weights];updateStops();
}
function loadStyle(style:TextStyle){look=cloneStyle(style);state.weights=[...style.weights];state.temperature=style.temperature;for(const key of ['wght','wdth','slnt','smoothing','edgeRoughness','edgeScale'] as const)settings[key]=style[key];}
function editPoint(mode:string){endTime();editing=mode;if(mode==='preview')$<HTMLSelectElement>('passage-size-scope').value='passage';pointLocks[mode]??=names.map(()=>false);loadStyle(currentStop()?.style??previewLook);labels();updateStops();schedule();}
function updateStops(){
 const selected=currentStop(),select=$<HTMLSelectElement>('text-stop');select.replaceChildren(...stops.map((stop,i)=>{const o=document.createElement('option');o.value=String(stop.id);o.textContent=(i===0?'Start':i===stops.length-1?'End':'Stop '+i)+' · character '+stop.at;o.selected=stop.id===selected?.id;return o;}));
 const active=selected??stops[0],position=$<HTMLInputElement>('stop-position');position.value=String(active.at);position.max=String(textLength()-1);position.disabled=active===stops[0]||active===stops.at(-1);$<HTMLButtonElement>('remove-stop').disabled=position.disabled;$<HTMLSelectElement>('stop-ease').value=active.ease;
 $('stop-summary').textContent=stops.length+' style stops · '+(selected?'Editing character '+active.at:'Editing preview; select a text stop to change its style.');
 const strip=$('stop-strip');strip.innerHTML='<path d="M10 15H990" stroke="currentColor" opacity=".2"/>'+stops.map(stop=>`<circle data-stop="${stop.id}" cx="${10+980*stop.at/(textLength()-1)}" cy="15" r="${stop.id===active.id?7:5}" fill="${stop.style.color}" stroke="currentColor"><title>Character ${stop.at}</title></circle>`).join('');
 root.dataset.stopCount=String(stops.length);root.dataset.editing=editing;
}
function selectStop(id:number){const stop=stops.find(s=>s.id===id)!;editPoint(stop===stops[0]?'start':stop===stops.at(-1)?'end':'stop-'+id);}
$('text-stop').onchange=()=>selectStop(Number($<HTMLSelectElement>('text-stop').value));
$('stop-strip').onclick=e=>{const id=(e.target as Element).getAttribute('data-stop');if(id!==null){selectStop(Number(id));openControl('stops');}};
$('add-stop').onclick=()=>{
 let at=$<HTMLTextAreaElement>('long-text').selectionStart;
 if(at<=0||at>=textLength()-1||stops.some(s=>s.at===at)){let gap=0;for(let i=0;i<stops.length-1;i++)if(stops[i+1].at-stops[i].at>gap){gap=stops[i+1].at-stops[i].at;at=Math.floor((stops[i+1].at+stops[i].at)/2);}}
 try{stops=insertStop(stops,at,nextStop++);selectStop(stops.find(s=>s.at===at)!.id);$('view-tab-passage').click();}catch(e){status.textContent=String(e);}
};
$('remove-stop').onclick=()=>{const stop=currentStop();if(!stop||stop===stops[0]||stop===stops.at(-1))return;stops=stops.filter(s=>s!==stop);delete pointFonts[editing];delete pointLocks[editing];editPoint('start');};
$('stop-position').onchange=()=>{const stop=currentStop()??stops[0],at=Math.round(Number($<HTMLInputElement>('stop-position').value));if(stop===stops[0]||stop===stops.at(-1)||at<=0||at>=textLength()-1||stops.some(s=>s!==stop&&s.at===at)){updateStops();return;}stop.at=at;stops.sort((a,b)=>a.at-b.at);updateStops();requestPaint();};
$('stop-ease').onchange=()=>{(currentStop()??stops[0]).ease=$<HTMLSelectElement>('stop-ease').value as TextStop['ease'];requestPaint();};
$('use-stops').onchange=()=>{useStops=$<HTMLInputElement>('use-stops').checked;if(!useStops)$<HTMLSelectElement>('passage-size-scope').value='passage';passageDirty=true;labels();requestPaint();};
const refreshStyles=setupStyleControls(()=>({...look,size:activeView==='code'?fontSize:look.size}),(style,attribute)=>{
 if(activeView==='code'){fontSize=style.size;style={...style,size:look.size};}
 else if(activeView==='passage'&&style.size!==look.size&&$<HTMLSelectElement>('passage-size-scope').value==='passage'){
  for(const stop of stops)stop.style.size=style.size;
  previewLook.size=style.size;
 }
 loadStyle(style);commitStyle();labels();if(activeView==='passage'&&useStops)story.preview(stops);if(attribute==='edgeRoughness'||attribute==='edgeScale'){playback.pause();markProofStale();requestPaint();}else schedule();
});
$('passage-size-scope').onchange=()=>{if($<HTMLSelectElement>('passage-size-scope').value==='stop'&&editing==='preview')editPoint('start');};
setupSeeds(style=>{assertCompatible([...selectedAcrossText(),...style.weights.flatMap((w,i)=>w>0?[i]:[])]);loadStyle({...style,weights:lockMapWeights(state.weights,style.weights,pointLocks[editing])});commitStyle();labels();schedule();},()=>catalog.flatMap((_,i)=>!available(i)||differentLetters([...selectedAcrossText(),i]).length?[]:[i]));
for(const [id,delta]of [['story-prev',-1],['story-next',1]] as const)$(id).onclick=()=>{(useStops?story:passage).movePage(delta);passageDirty=true;requestPaint();};
function paintEffects(){
 const attrs=effectAttributes(look),filter=/style="filter:([^"]*)"/.exec(attrs)![1];outline.style.filter=filter;outline.style.opacity=String(look.opacity);outline.style.color=look.color;
 if(!state.boundary){outline.setAttribute('stroke',look.outline>0?look.outlineColor:'none');outline.setAttribute('stroke-width',String(look.outline));outline.setAttribute('paint-order','stroke fill');}
}

function syncSettings(){
 assertCompatible(selectedAcrossText());
 settings.temperature=state.temperature;settings.seed=state.seed;
 const points=[state.weights,startWeights,endWeights,...stops.map(s=>s.style.weights)],selected=Object.values(pointFonts).flat();
 const support=fontIndices.flatMap((id,i)=>selected.includes(id)||id===state.target||points.some(w=>w[id]>0)?[i]:[]);
 if(support.join(',')!==settings.support?.join(',')){settings.support=support;lettersDirty=passageDirty=codeDirty=true;}
}
function describe(w:Weights){const active=names.flatMap((n,i)=>w[i]>.0005?[n+' '+Math.round(w[i]*100)+'%']:[]);return active.length>3?active.slice(0,2).join(' · ')+' + '+(active.length-2)+' fonts':active.join(' · ');}
async function buildPreviews(){
 if(activeView==='code'){await buildCodePreview();return;}
 if(activeView!=='passage')return;
 syncSettings();const snapshot={...settings};
 if(useStops){await story.paint($<HTMLTextAreaElement>('long-text').value,fonts,fontIndices,stops.map(s=>({...s,style:cloneStyle(s.style)})),snapshot,sampling,timePreview?timePosition*(textLength()-1):undefined,wordHealing);story.preview(stops);status.textContent=stops.length+' text stops · fonts, attributes and effects';$('story-page').textContent=$('passage-view').dataset.page+' / '+story.pages;$<HTMLButtonElement>('story-prev').disabled=$('passage-view').dataset.page==='1';$<HTMLButtonElement>('story-next').disabled=Number($('passage-view').dataset.page)===story.pages;return;}
 if(passageDirty){passageDirty=false;await passage.prepare($<HTMLTextAreaElement>('long-text').value,fonts,snapshot,look.size);}
 await passage.paint(renderWeights(timePreview?state.weights:startWeights),renderWeights(timePreview?state.weights:endWeights),snapshot,false,sampling,wordHealing);passage.previewAxes(settings);$('story-page').textContent=$('passage-view').dataset.page+' / '+passage.pages;$<HTMLButtonElement>('story-prev').disabled=$('passage-view').dataset.page==='1';$<HTMLButtonElement>('story-next').disabled=Number($('passage-view').dataset.page)===passage.pages;
}
async function buildCodePreview(){
 if(!fonts.length)return;syncSettings();const snapshot={...settings},size=fontSize;
 const panel=$('code-panel'),width=panel.clientWidth||800,height=panel.clientHeight||380;
 const columns=Math.max(12,Math.floor((width-90)/(size*.66*snapshot.wdth/100)));
 const lines=wrapText(specimens[language],columns),count=Math.max(1,Math.floor((height-24)/(size*1.65)));
 codePages=Math.max(1,Math.ceil(lines.length/count));codePage=Math.min(codePage,codePages-1);
 $('code-page').textContent=`${codePage+1} / ${codePages}`;
 $<HTMLButtonElement>('code-prev').disabled=codePage===0;$<HTMLButtonElement>('code-next').disabled=codePage===codePages-1;
 $('code-view').dataset.firstLine=String(codePage*count);
 const before=lines.slice(0,codePage*count).join(''),whole=lines.join('');
 codeDirty=false;
 await codePreview.prepare(lines.slice(codePage*count,(codePage+1)*count).join('\n'),fonts,snapshot,size,true,{letterOffset:before.replace(/\s/g,'').length,letterTotal:whole.replace(/\s/g,'').length,cellOffset:before.length,cellTotal:whole.length});
 await codePreview.paint(renderWeights(!timePreview&&transitionCode?startWeights:state.weights),renderWeights(!timePreview&&transitionCode?endWeights:state.weights),snapshot,true,sampling,wordHealing);codePreview.previewAxes(settings);
}
let paintRequested=false,paintFrame=0,painting=false;
function requestPaint(){
 paintRequested=true;
 if(paintFrame||painting)return;
 paintFrame=requestAnimationFrame(async()=>{
  paintFrame=0;painting=true;paintRequested=false;root.dataset.busy='true';
  try{
   await ensureFonts();syncSettings();
   if(activeView==='letters'){if(lettersDirty)await build();else paint();}
   else if(activeView==='passage')await buildPreviews();
   else if(activeView==='code'){if(codeDirty)await buildCodePreview();else await codePreview.paint(renderWeights(!timePreview&&transitionCode?startWeights:state.weights),renderWeights(!timePreview&&transitionCode?endWeights:state.weights),{...settings},true,sampling,wordHealing);}
  }catch(e){fail(e);}finally{painting=false;root.dataset.busy='false';if(paintRequested)requestPaint();}
 });
}


const headlineSize=new PreviewSize();
let headlineShapes:ReturnType<typeof prepareOutline>[]=[];
let headlineWords:number[]=[];
let headlineAdvances:number[][]=[];
let cells:{x:number;y:number;w:number;h:number}[]=[];
let bounds={left:0,top:0,right:1,bottom:1};
let buildToken=0;
let lettersDirty=false,passageDirty=true,codeDirty=true;
const dimensions={w:900,h:320};

function labels(){
 $('passage-size-scope-row').hidden=activeView!=='passage';$<HTMLSelectElement>('passage-size-scope').querySelector<HTMLOptionElement>('option[value=stop]')!.disabled=!useStops;
 $('style-context').textContent=activeView==='code'?'Code preview':editing==='preview'?'Preview style':currentStop()?'Text style · character '+currentStop()!.at:'Preview style';
 root.dataset.weights=JSON.stringify(state.weights);refreshStyles();for(const [id,key]of [['native-weight','wght'],['native-width','wdth'],['native-slant','slnt']] as const){$<HTMLInputElement>(id).value=String(settings[key]);$(id+'-value').textContent=String(settings[key]);}
 $<HTMLInputElement>('smoothing').value=String(settings.smoothing*100);$('smoothing-value').textContent=Math.round(settings.smoothing*100)+'%';
 $('axis-note').textContent=fonts.some(f=>!Object.keys(f.variationAxes).length)?'Classic fonts use approximate weight, width and slant adjustments. Original shape at 450 / 100 / 0.':'Native variable axes.';
 temperature.value=String(Math.round(state.temperature*100));
 if(text.value!==state.text)text.value=state.text;direction.value=state.direction;boundary.checked=state.boundary;perLetter.checked=state.perLetter;perLetter.disabled=sampling==='letter';
 $<HTMLSelectElement>('transition-sampling').value=sampling;
 $('passage-by-letter').setAttribute('aria-pressed',String(sampling==='letter'));
 $('passage-within-letters').setAttribute('aria-pressed',String(sampling==='continuous'));
 for(const [mode,weights] of [['start',startWeights],['end',endWeights]] as const){
  const button=$('passage-'+mode),pole=weights.findIndex(w=>w===1);
  button.textContent=(mode==='start'?'Start':'End')+' · '+(pole<0?'Blend':names[pole]);
  button.setAttribute('aria-pressed',String(editing===mode));button.title=describe(weights);
 }
 $('temperature-value').textContent=Math.round(state.temperature*100)+'%';
 $('shape-description').setAttribute('aria-live',timePreview?'off':'polite');
 $('shape-description').textContent=describe(state.weights);$('shape-description').title=names.map((name,i)=>name+' '+(state.weights[i]*100).toFixed(1)+'%').join(' · ');
 state.weights.forEach((w,i)=>{if(w>1e-12&&!selectedFonts().includes(i))selectedFonts().push(i);});filterFonts();
 const locks=mixerLocks(),free=locks.filter(v=>!v).length,budget=freeBudget(state.weights,locks);
 selectedFonts().forEach(i=>{
  const slider=$<HTMLInputElement>('weight-'+i);slider.max=String((locks[i]?1:budget)*100);slider.disabled=locks[i]||free<2||budget<1e-10;
  $<HTMLButtonElement>('anchor-'+i).disabled=slider.disabled;
  $<HTMLInputElement>('lock-'+i).checked=pointLocks[editing][i];
  const remove=$<HTMLButtonElement>('remove-font-'+i);remove.disabled=selectedFonts().length<2||pointLocks[editing][i]||(state.weights[i]>1e-12&&free<2);remove.title=selectedFonts().length<2?'Keep at least one font':pointLocks[editing][i]?'Unlock this font to remove it':remove.disabled?'Unlock another font to receive its percentage':'';
  $<HTMLInputElement>('weight-'+i).value=String(state.weights[i]*100);
  $('weight-value-'+i).textContent=Math.round(state.weights[i]*100)+'%';
  $('anchor-'+i).setAttribute('aria-pressed',String(state.weights[i]===1));
 });
 for(const mode of ['preview','start','end'])for(const prefix of ['edit-','map-edit-'])$(prefix+mode).setAttribute('aria-pressed',String(editing===mode));
 updateMap(state.weights,startWeights,endWeights);
 $('time-route').textContent='Start: '+describe(startWeights)+' → End: '+describe(endWeights);
 $('route-description').textContent='Start: '+describe(startWeights)+' → End: '+describe(endWeights);
 target.value=String(state.target);
 $('new-impression').toggleAttribute('disabled',state.temperature===0&&settings.edgeRoughness===0);$('new-edge-pattern').toggleAttribute('disabled',settings.edgeRoughness===0);
 $('spatial-options').hidden=state.direction==='uniform';
 outline.setAttribute('fill',state.boundary?'none':'currentColor');outline.setAttribute('stroke',state.boundary?'currentColor':'none');paintEffects();

}
async function build(){
 if(!fonts.length)return;
 if(activeView!=='letters'){await buildPreviews();return;}
 const token=++buildToken;lettersDirty=false;
 $('code-panel').style.setProperty('--grid-x',fontSize*.6*settings.wdth/100+'px');$('code-panel').style.setProperty('--grid-y',fontSize*1.65+'px');
 const lines=state.text.replace(/\r/g,'').split('\n');
 if(lines.some(line=>/[^\x20-\x7e]/.test(line))){status.textContent='This first sketch supports English letters, numbers, and ASCII punctuation.';status.setAttribute('role','alert');return;}
 if(!lines.some(line=>line.trim())){headlineShapes=[];outline.setAttribute('d','');outline.removeAttribute('transform');status.textContent='Enter a few letters to draw.';return;}
 delete root.dataset.error;status.removeAttribute('role');status.textContent='Drawing curves…';
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 if(token!==buildToken)return;
 const columns=Math.max(...lines.map(l=>l.length));
 const size=look.size;
 const cell=size*.66*settings.wdth/100;const lineHeight=size*look.leading;
 const w=svg.parentElement!.clientWidth,h=svg.parentElement!.clientHeight,offsetY=(h-lines.length*lineHeight)/2;
 dimensions.w=w;dimensions.h=h;svg.setAttribute('width',String(w));svg.setAttribute('height',String(h));
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 cells=[];headlineShapes=[];headlineWords=[];headlineAdvances=[];
 bounds={left:size*.24,top:offsetY+size*.20,right:size*.24+columns*cell,bottom:offsetY+lines.length*lineHeight-size*.06};
 const entries:{character:string;x:number;baseline:number;index:number}[]=[];
 let index=0;
 lines.forEach((line,row)=>{
  const offset=(w-line.length*cell)/2,words=wordIds(line);
  for(let j=0;j<line.length;j++){
   const x=offset+j*cell,baseline=offsetY+size*.98+row*lineHeight;
   entries.push({character:line[j],x,baseline,index});headlineWords.push(words[j]>=0?row*1000+words[j]:-1);
   cells.push({x,y:offsetY+row*lineHeight,w:cell,h:lineHeight});index++;
  }
 });
 syncSettings();
 const bases=fonts.map(font=>font.getVariation(axes({...settings,temperature:0},0)));
 const prepared=new Map<string,{x:number;y:number;shape:ReturnType<typeof prepareOutline>;advances:number[]}>();
 const renderSettings={...settings},renderTemperature=state.temperature;let lastYield=performance.now();
 for(const e of entries){
  const saved=renderTemperature===0?prepared.get(e.character):undefined;
  if(saved){headlineShapes.push(translateOutline(saved.shape,e.x-saved.x,e.baseline-saved.y));headlineAdvances.push(saved.advances);continue;}
  const originals:string[]=[],advances:number[]=[];
  fonts.forEach((font,source)=>{
   const amount=renderTemperature;
   const variation=amount===0?bases[source]:font.getVariation(axes(renderSettings,e.index));
   const glyph=variation.glyphForCodePoint(e.character.charCodeAt(0));
   const scale=size/variation.unitsPerEm;
   advances.push(glyph.advanceWidth*scale);
   const x=e.x+(cell-glyph.advanceWidth*scale)/2;
   originals.push(sourcePath(glyph.path.commands,x,e.baseline,scale));
  });
  const shape=prepareOutline(originals,e.character,size,[e.x+cell/2,e.baseline-size*.25],fonts.map(entryForFont),renderSettings.support);
  headlineShapes.push(shape);headlineAdvances.push(advances);
  if(renderTemperature===0)prepared.set(e.character,{x:e.x,y:e.baseline,shape,advances});
  if(performance.now()-lastYield>8){await new Promise<void>(r=>setTimeout(r,0));if(token!==buildToken)return;lastYield=performance.now();}
 }
 if(state.weights.some((w,id)=>w>0&&!renderSettings.support?.some(i=>fontIndices[i]===id))||(state.direction!=='uniform'&&!renderSettings.support?.some(i=>fontIndices[i]===state.target))){lettersDirty=true;requestPaint();return;}
 paint();status.textContent=wordHealing>0?`Word healing ${Math.round(wordHealing*100)}% · temperature ${Math.round(state.temperature*100)}%`:state.temperature===0?'Identical repeated letters · temperature 0':`Impression ${state.seed} · curve variation · fixed orientation`;
 root.dataset.ready='true';root.dataset.build=String(token);svg.dataset.axes=JSON.stringify(axes({...renderSettings,temperature:0},0));
 await buildPreviews();
}
function fieldAt(x:number,y:number,cellIndex:number):Weights{
 let weights=[...state.weights] as Weights;
 if(!timePreview&&state.direction!=='uniform'){
  if(sampling==='letter'){const c=cells[cellIndex];x=c.x+c.w/2;y=c.y+c.h/2;}
  let u=(x-bounds.left)/(bounds.right-bounds.left),v=(y-bounds.top)/(bounds.bottom-bounds.top);
  if(state.perLetter&&sampling==='continuous'){const c=cells[cellIndex];u=(x-c.x)/c.w;v=(y-c.y-c.h*.16)/(c.h*.70);}
  const q=clamp(state.direction==='horizontal'?u:state.direction==='vertical'?v:(u+v)/2),t=q*q*(3-2*q);
  weights=weights.map((w,i)=>w*(1-t)+(i===state.target?t:0)) as Weights;
 }
 return renderWeights(weights);
}
function paint(){
 if(!headlineShapes.length)return;
 const paths=headlineShapes.map((shape,index)=>!timePreview&&sampling==='continuous'&&state.direction!=='uniform'?shape.drawField((x,y)=>fieldAt(x,y,index),settings.smoothing,settings.structured):shape.draw(fieldAt(cells[index].x,cells[index].y,index),settings.smoothing,settings.structured));
 const advances=headlineAdvances.map((a,i)=>{const weights=fieldAt(cells[i].x,cells[i].y,i);return a.reduce((sum,v,j)=>sum+v*weights[j],0)+look.tracking;});
 const rows:{first:number;end:number;width:number}[]=[];
 for(let first=0;first<cells.length;){let end=first+1;while(end<cells.length&&cells[end].y===cells[first].y)end++;rows.push({first,end,width:advances.slice(first,end).reduce((a,b)=>a+b,0)});first=end;}
 const width=Math.max(dimensions.w,...rows.map(r=>r.width+cells[0].h*.35)),slots:number[]=[];
 for(const row of rows){let x=(width-row.width)/2;for(let i=row.first;i<row.end;i++){slots[i]=x;x+=advances[i];}}
 svg.setAttribute('viewBox',`0 0 ${width} ${dimensions.h}`);
 const varied=paths.map((d,i)=>stretchPath(finishPath(d,{...settings,temperature:state.temperature,seed:state.seed},i,cells[i].w/.66*100/settings.wdth),1,slots[i]+advances[i]/2-cells[i].x-cells[i].w/2));
 const healed=wordHealing>0?healWords(varied.map((d,i)=>({word:headlineWords[i],slot:slots[i],advance:advances[i],ink:inkOf(d)})),wordHealing):undefined;
 outline.setAttribute('d',varied.map((d,i)=>healed?stretchPath(d,healed[i].scale,healed[i].translate):d).join(''));
 const fit=headlineSize.fit(outline.getBBox(),JSON.stringify([state.text,look.size,settings.wdth,look.tracking,look.leading]),dimensions.w/2,dimensions.h/2);
 outline.setAttribute('transform',fit.transform);
 const ink=fit.bounds,padding=Math.max(look.size*.12,look.outline+3*(look.blur+look.glow)+(look.shadowOpacity>0?Math.max(Math.abs(look.shadowX),Math.abs(look.shadowY))+3*look.shadowBlur:0),2);
 const left=Math.min(0,ink.x-padding),top=Math.min(0,ink.y-padding),right=Math.max(dimensions.w,ink.x+ink.width+padding),bottom=Math.max(dimensions.h,ink.y+ink.height+padding);
 svg.setAttribute('viewBox',`${left} ${top} ${right-left} ${bottom-top}`);
 svg.dataset.wordHealing=String(wordHealing);
 svg.setAttribute('aria-label',`${state.text}. ${$('shape-description').textContent}. Cubic Bézier outlines. ${state.direction} style field. Temperature ${Math.round(state.temperature*100)} percent.`);
 root.dataset.weights=JSON.stringify(state.weights);root.dataset.renderedWeights=JSON.stringify(state.weights);root.dataset.renderer='bezier';paintEffects();
}
function markProofStale(){proofRevision++;if($('quality-proof').children.length)$('quality-status').textContent='Settings changed. Inspect again to update this proof.';}
function schedule(){playback.pause();markProofStale();lettersDirty=passageDirty=codeDirty=true;requestPaint();}
function fail(e:unknown,action='draw the font curves'){console.error(e);status.textContent='Could not '+action+': '+String(e);status.setAttribute('role','alert');root.dataset.error=String(e);}
function useFontAlone(index:number){
 endTime();const w=pole(count,index);for(const key of Object.keys(pointFonts)){pointFonts[key]=[index];pointLocks[key]=names.map(()=>false);}
 stops=stops.map(stop=>({...stop,style:{...stop.style,weights:[...w]}}));previewLook={...previewLook,weights:[...w]};previewWeights=[...w];startWeights=[...w];endWeights=[...w];state.target=index;
 loadStyle({...look,weights:w});commitStyle();labels();schedule();$<HTMLDetailsElement>('font-library').open=false;
}
function changeWeights(w:Weights){assertCompatible([...selectedAcrossText(),...w.flatMap((v,i)=>v>1e-12?[i]:[])]);endTime();markProofStale();state.weights=w;if(editing==='start')startWeights=[...w];else if(editing==='end')endWeights=[...w];else previewWeights=[...w];commitStyle();labels();requestPaint();}
for(let i=0;i<count;i++){
 $('remove-font-'+i).onclick=()=>{if($<HTMLButtonElement>('remove-font-'+i).disabled)return;endTime();const w=setWeight(state.weights,i,0,mixerLocks());pointFonts[editing]=selectedFonts().filter(id=>id!==i);pointLocks[editing][i]=false;changeWeights(w);$('font-library-toggle').focus();};
 $('lock-'+i).addEventListener('change',()=>{endTime();pointLocks[editing][i]=$<HTMLInputElement>('lock-'+i).checked;labels();requestPaint();});
 $<HTMLInputElement>('weight-'+i).addEventListener('input',e=>changeWeights(setWeight(state.weights,i,Number((e.target as HTMLInputElement).value)/100,mixerLocks())));
 $('anchor-'+i).addEventListener('click',()=>{state.direction='uniform';changeWeights(setWeight(state.weights,i,1,mixerLocks()));});
}
$('transition-sampling').addEventListener('change',()=>{endTime();sampling=$<HTMLSelectElement>('transition-sampling').value as TransitionSampling;labels();requestPaint();});
for(const [id,value] of [['passage-by-letter','letter'],['passage-within-letters','continuous']] as const)$(id).addEventListener('click',()=>{endTime();sampling=value;labels();requestPaint();});
for(const mode of ['start','end'])$('passage-'+mode).addEventListener('click',()=>{openControl('blend');$('edit-'+mode).click();});
$('word-healing').addEventListener('input',()=>{wordHealing=Number($<HTMLInputElement>('word-healing').value)/100;$('word-healing-value').textContent=wordHealing?Math.round(wordHealing*100)+'%':'Off';if(!root.dataset.error)status.textContent=wordHealing?'Word healing '+Math.round(wordHealing*100)+'%':'Word healing off';requestPaint();});
$('code-transition').addEventListener('change',()=>{endTime();transitionCode=$<HTMLInputElement>('code-transition').checked;requestPaint();});
target.addEventListener('change',()=>{const index=Number(target.value);assertCompatible([...selectedAcrossText(),index]);endTime();state.target=index;requestPaint();});
temperature.addEventListener('input',()=>{state.temperature=Number(temperature.value)/100;commitStyle();labels();schedule();});
text.addEventListener('input',()=>{state.text=text.value;state.seed++;schedule();});
direction.addEventListener('change',()=>{endTime();state.direction=direction.value;labels();requestPaint();});
perLetter.addEventListener('change',()=>{endTime();state.perLetter=perLetter.checked;requestPaint();});
boundary.addEventListener('change',()=>{state.boundary=boundary.checked;labels();requestPaint();});
for(const id of ['new-impression','new-edge-pattern'])$(id).addEventListener('click',()=>{state.seed++;schedule();});

for(const mode of ['preview','start','end'])for(const prefix of ['edit-','map-edit-'])$(prefix+mode).addEventListener('click',()=>editPoint(mode));
for(const [id,key] of [['native-weight','wght'],['native-width','wdth'],['native-slant','slnt']] as const){
 $<HTMLInputElement>(id).addEventListener('input',()=>{settings[key]=Number($<HTMLInputElement>(id).value);$(id+'-value').textContent=String(settings[key]);commitStyle();if(activeView==='passage'){if(useStops)story.preview(stops);else passage.previewAxes(settings);}if(activeView==='code')codePreview.previewAxes(settings);schedule();});
}
$<HTMLInputElement>('smoothing').addEventListener('input',()=>{markProofStale();settings.smoothing=Number($<HTMLInputElement>('smoothing').value)/100;commitStyle();$('smoothing-value').textContent=Math.round(settings.smoothing*100)+'%';requestPaint();});
$<HTMLTextAreaElement>('long-text').addEventListener('input',()=>{const end=stops.at(-1)!;end.at=textLength()-1;stops=stops.filter(s=>s===end||s.at<end.at);updateStops();schedule();});
for(const [id,key] of [['texture-healing','healing'],['ligatures','ligatures']] as const)$<HTMLInputElement>(id).addEventListener('change',()=>{settings[key]=$<HTMLInputElement>(id).checked;schedule();});
$('code-grid').addEventListener('change',()=>{$('code-panel').dataset.grid=String($<HTMLInputElement>('code-grid').checked);});
$('code-theme').addEventListener('change',()=>{root.querySelector<HTMLElement>('.specimen-section')!.dataset.theme=$<HTMLSelectElement>('code-theme').value;});
Object.keys(specimens).forEach((name,i)=>{const button=document.createElement('button');button.textContent=name;button.id='language-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls','code-panel');button.setAttribute('aria-selected',String(name===language));button.addEventListener('click',()=>{language=name;codePage=0;root.querySelectorAll('#code-tabs button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));$('code-panel').setAttribute('aria-labelledby',button.id);codeDirty=true;requestPaint();});$('code-tabs').append(button);});
$('code-panel').setAttribute('aria-labelledby','language-0');
$('code-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('#code-tabs button'));let i=buttons.findIndex(b=>b===document.activeElement);i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[i].focus();buttons[i].click();});
$('download-font').addEventListener('click',async()=>{
 const button=$<HTMLButtonElement>('download-font');button.disabled=true;syncSettings();
 try{await ensureFonts();syncSettings();const result=await makeFont(fonts,renderWeights(state.weights),{...settings},n=>button.textContent=`Building font ${n}/95`);
 downloadFont(result.bytes,result.filename);
 }catch(e){fail(e,'export the font');}finally{button.disabled=false;button.textContent='Download OTF';}
});
$('construction-mode').addEventListener('change',()=>{settings.structured=$<HTMLSelectElement>('construction-mode').value==='structured';schedule();});
$('inspect-transition').addEventListener('click',async()=>{const button=$<HTMLButtonElement>('inspect-transition'),revision=proofRevision;button.disabled=true;try{await inspectTransition(fonts,renderWeights(startWeights),renderWeights(endWeights),{...settings},$('quality-proof'),$('quality-status'),useStops?t=>{const position=t*(textLength()-1),style=routeStyle(stops,position),span=routeSpan(stops,position);return {fonts:[...fonts.map(f=>f.getVariation(span.a.style)),...fonts.map(f=>f.getVariation(span.b.style))],weights:[...renderWeights(span.a.style.weights).map(w=>w*(1-span.t)),...renderWeights(span.b.style.weights).map(w=>w*span.t)],settings:{...settings,...style,temperature:0}};}:undefined);if(revision!==proofRevision)markProofStale();}catch(e){fail(e);}finally{button.disabled=false;}});
function endTime(){playback.pause();timePreview=false;root.dataset.timePreview='false';}
async function paintTime(weights:Weights,position:number){
 if(!timePreview)return;timePosition=position;
 const next=useStops?routeStyle(stops,position*(textLength()-1)):{...look,weights};
 const changed=next.wght!==settings.wght||next.wdth!==settings.wdth||next.slnt!==settings.slnt||next.size!==look.size||next.temperature!==state.temperature;
 loadStyle(next);editing='preview';syncSettings();labels();root.dataset.weights=JSON.stringify(state.weights);await ensureFonts();syncSettings();
 if(activeView==='letters'){if(changed||lettersDirty)await build();else paint();}
 else if(activeView==='passage')await buildPreviews();
 else if(activeView==='code'){if(changed)await buildCodePreview();else await codePreview.paint(renderWeights(next.weights),renderWeights(next.weights),{...settings},true,sampling,wordHealing);}
}

playback=setupPlayback({
 route:()=>[[...startWeights],[...endWeights]],
 begin:()=>{timePreview=true;root.dataset.timePreview='true';cancelAnimationFrame(paintFrame);paintFrame=0;paintRequested=false;if(activeView==='proof'||activeView==='criteria')root.querySelector<HTMLButtonElement>('[data-view="letters"]')!.click();},
 frame:paintTime,
 exit:()=>{timePreview=false;root.dataset.timePreview='false';labels();requestPaint();},
 error:e=>fail(e,'play the transition')
});
setupWorkspace(name=>{activeView=name;if(name==='passage'&&useStops&&editing==='preview')editPoint('start');$('word-controls').hidden=!['letters','passage','code'].includes(name);if(name==='code')codeDirty=true;labels();requestPaint();});
$('code-prev').addEventListener('click',()=>{codePage=Math.max(0,codePage-1);codeDirty=true;requestPaint();});
$('code-next').addEventListener('click',()=>{codePage=Math.min(codePages-1,codePage+1);codeDirty=true;requestPaint();});
let resizeTimer:number|undefined;
new ResizeObserver(()=>{window.clearTimeout(resizeTimer);resizeTimer=window.setTimeout(()=>{if(!$('view-code').hidden){codeDirty=true;requestPaint();}},100);}).observe($('code-panel'));
$('download-scene').onclick=()=>{
 const source=activeView==='passage'?$('passage-view'):activeView==='code'?$('code-view'):$('outline-view'),copy=source.cloneNode(true) as Element;
 const originals=[source,...Array.from(source.querySelectorAll('*'))],clones=[copy,...Array.from(copy.querySelectorAll('*'))];
 originals.forEach((element,i)=>{const style=getComputedStyle(element);for(const key of ['fill','stroke','color','filter','opacity'])if(style.getPropertyValue(key))clones[i].setAttribute(key,style.getPropertyValue(key));});
 copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='type-space-scene.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
labels();updateStops();
(async()=>{await ensureFonts();labels();await build();})().catch(fail);
