const libraryURL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const modelID='Xenova/clip-vit-base-patch32',revision='6b7c523703ae26e39be4b03774966f8571c7f523';
let runtime:any,tokenizer:any,processor:any,textModel:any,visionModel:any,index:number[][]|undefined,indexKey='';
const normalize=(v:number[])=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const rows=(tensor:any)=>Array.from({length:tensor.dims[0]},(_,i)=>normalize(Array.from(tensor.data.slice(i*tensor.dims[1],(i+1)*tensor.dims[1])) as number[]));
const progress=(p:any)=>{if(p.status==='progress')postMessage({type:'progress',message:'Loading semantic model · '+Math.round(p.progress??0)+'%'});};
async function start(){
 if(textModel&&tokenizer&&processor)return;
 runtime=await import(libraryURL);runtime.env.allowLocalModels=false;runtime.env.useBrowserCache=false;runtime.env.backends.onnx.wasm.numThreads=1;
 const options={revision,dtype:'q8',device:'wasm',progress_callback:progress};
 [tokenizer,processor,textModel]=await Promise.all([runtime.AutoTokenizer.from_pretrained(modelID,{revision}),runtime.AutoProcessor.from_pretrained(modelID,{revision}),runtime.CLIPTextModelWithProjection.from_pretrained(modelID,options)]);
}
self.onmessage=async(event)=>{
 const {id,words,images,descriptions}=event.data;
 try{
  postMessage({type:'progress',message:'Loading semantic model…'});await start();
  const key=JSON.stringify(descriptions);
  if(indexKey!==key){index=[];for(let i=0;i<descriptions.length;i+=8){postMessage({type:'progress',message:`Reading font personalities · ${Math.min(i+8,descriptions.length)}/${descriptions.length}`});const inputs=tokenizer(descriptions.slice(i,i+8),{padding:true,truncation:true});index.push(...rows((await textModel(inputs)).text_embeds));}indexKey=key;}
  const seeds:number[][]=[];
  if(words.trim())seeds.push(...rows((await textModel(tokenizer([words],{padding:true,truncation:true}))).text_embeds));
  if(images.length){
   visionModel??=await runtime.CLIPVisionModelWithProjection.from_pretrained(modelID,{revision,dtype:'q8',device:'wasm',progress_callback:progress});
   for(let i=0;i<images.length;i++){postMessage({type:'progress',message:`Reading seed image ${i+1}/${images.length}…`});const image=await runtime.RawImage.read(images[i]),input=await processor(image);seeds.push(...rows((await visionModel(input)).image_embeds));}
  }
  if(!seeds.length)throw new Error('Enter words or choose an image.');
  const seed=normalize(seeds[0].map((_,i)=>seeds.reduce((n,row)=>n+row[i],0)/seeds.length));
  const scores=index!.map(row=>row.reduce((n,v,i)=>n+v*seed[i],0));postMessage({type:'result',id,scores});
 }catch(error){postMessage({type:'error',id,message:String(error)});}
};
