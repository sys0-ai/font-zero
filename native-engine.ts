// The Font Zero canvas for a view: the deterministic Rust engine (engine/,
// compiled to wasm) driven with the surface of native-renderer.ts's
// createRenderer — update, ready, fit, hit, dispose — and the same DOM
// contract: a scrolling `view` holding `.font-content` and a `canvas`.
// build-native.ts bundles this with the wasm-bindgen glue and the wasm bytes.
import init,{FontZeroEngine} from 'font-zero-engine-wasm';
import wasmBase64 from 'font-zero-engine-bytes';
import type {NativeSettings} from './native-renderer';
export type {NativeAttractor,NativeSettings} from './native-renderer';

let module:Promise<unknown>|undefined;
function bytes(){
 const text=atob(wasmBase64),out=new Uint8Array(text.length);
 for(let i=0;i<text.length;i++)out[i]=text.charCodeAt(i);
 return out;
}
// Chrome limits synchronous compilation on the main thread: instantiate asynchronously, once.
const load=()=>module??=init({module_or_path:bytes()});

// Any CSS colour (rgb(), oklch(), color(), names) to packed straight 0xRRGGBBAA, via a 1×1 canvas.
const colors=new Map<string,number>();let probe:CanvasRenderingContext2D|null=null;
function packed(css:string,fallback:number){
 if(!css)return fallback;
 let v=colors.get(css);if(v!==undefined)return v;
 probe??=Object.assign(document.createElement('canvas'),{width:1,height:1}).getContext('2d',{willReadFrequently:true});
 if(!probe)return fallback;
 probe.clearRect(0,0,1,1);probe.fillStyle='#000';probe.fillStyle=css;probe.fillRect(0,0,1,1);
 const [r,g,b,a]=probe.getImageData(0,0,1,1).data;v=((r<<24)|(g<<16)|(b<<8)|a)>>>0;
 colors.set(css,v);return v;
}

export async function createNativeRenderer(view:HTMLElement,report:(message:string)=>void){
 await load();
 const engine=new FontZeroEngine();
 const canvas=view.querySelector('canvas')!,context=canvas.getContext('2d')!,content=view.querySelector<HTMLElement>('.font-content')!;
 let props:{settings:NativeSettings;design:boolean;selected:string}|undefined,key='',layoutKey='',revision=0,ready=false,frame=0,lastTime=0,stopped=false;
 const request=()=>{if(!frame&&!stopped)frame=requestAnimationFrame(draw);};
 const viewport=()=>engine.set_viewport(view.clientWidth,view.clientHeight,devicePixelRatio||1);
 function layout(){
  if(!ready)return;
  viewport();const [w,h]=engine.content_size();
  if(w===view.clientWidth&&h===view.clientHeight){content.style.width='100%';content.style.height='100%';}
  else{content.style.width=w+'px';content.style.height=h+'px';}
  request();
 }
 // Apply the latest props; while preparing, report the outcome as prepare() did.
 function apply(preparing:boolean){
  if(!props)return;
  viewport();
  try{engine.update(JSON.stringify(props));}
  catch(e){if(preparing){ready=false;view.dataset.error=String(e);view.dataset.errorStack=(e as Error).stack??'';report((e as Error).message);}return;}
  if(preparing){ready=engine.ready();report('');delete view.dataset.error;layout();}
 }
 function draw(time:number){
  frame=0;if(stopped||!props)return;
  const w=view.clientWidth,h=view.clientHeight,dt=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
  const moving=props.settings.motion&&!props.design&&!document.hidden&&document.documentElement.dataset.motion!=='none';
  viewport();
  const animating=moving&&engine.tick(dt);
  if(!ready)return;
  try{
   engine.set_scroll(view.scrollLeft,view.scrollTop);
   const style=getComputedStyle(view),ink=packed(style.color,0xff),highlight=packed(style.getPropertyValue('--color-highlight').trim(),ink);
   const rgba=engine.render(ink,highlight),width=engine.width(),height=engine.height();
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.style.width=w+'px';canvas.style.height=h+'px';}
   canvas.style.left=view.scrollLeft+'px';canvas.style.top=view.scrollTop+'px';
   if(width&&height)context.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer,rgba.byteOffset,rgba.byteLength),width,height),0,0);
   view.dataset.ready='true';view.dataset.design=String(props.design);view.dataset.sampling=props.settings.within?'within':'letter';delete view.dataset.error;
  }catch(e){view.dataset.error=String(e);view.dataset.errorStack=(e as Error).stack??'';report((e as Error).message);}
  if(animating)request();else lastTime=0;
 }
 const resize=new ResizeObserver(()=>{viewport();layout();});resize.observe(view);
 const theme=new MutationObserver(request);theme.observe(document.documentElement,{attributes:true,attributeFilter:['style','class','data-motion','data-theme']});
 const themeLink=document.getElementById('theme');themeLink?.addEventListener('load',request);
 const scroll=()=>request(),move=(e:PointerEvent)=>{const r=view.getBoundingClientRect();engine.set_pointer(e.clientX-r.left,e.clientY-r.top);if(props?.settings.attractors.some(a=>a.mode==='cursor'))request();},leave=()=>{engine.set_pointer(undefined,undefined);request();},visible=()=>{lastTime=0;request();};
 view.addEventListener('scroll',scroll,{passive:true});view.addEventListener('pointermove',move,{passive:true});view.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visible);
 return {
  update(next:NativeSettings,isDesign:boolean,chosen:string){
   props={settings:next,design:isDesign,selected:chosen};
   const k=JSON.stringify([next.attractors.map(a=>a.font),[...new Set(next.text+next.previewGlyph)].sort()]);
   const l=JSON.stringify([next.text,next.size,next.leading,next.padding,next.wrap,isDesign,next.previewGlyph,next.attractors.filter(a=>a.mode==='ambient').map(a=>a.font)]);
   if(k!==key){
    key=k;layoutKey=l;ready=false;view.dataset.ready='false';report('Preparing font curves…');
    const ticket=++revision;setTimeout(()=>{if(ticket===revision&&!stopped)apply(true);},0);
   }else{apply(false);if(l!==layoutKey){layoutKey=l;layout();}request();}
  },
  ready:()=>ready,
  fit(){if(!ready)throw Error('Font curves are still loading.');view.scrollTo(0,0);viewport();return engine.fit();},
  hit(x:number,y:number){viewport();return engine.hit(x,y)??undefined;},
  dispose(){stopped=true;revision++;cancelAnimationFrame(frame);resize.disconnect();theme.disconnect();themeLink?.removeEventListener('load',request);view.removeEventListener('scroll',scroll);view.removeEventListener('pointermove',move);view.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visible);engine.free();}
 };
}
