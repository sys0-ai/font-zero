import {catalog} from './catalog';
import {fontDownloadResponse} from './font-download-response';
import {build} from './build';
const port=Number(process.argv[2]??process.env.PORT??4418);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use an unprivileged port.');
const base='/fontzero',localFonts=process.env.FONTZERO_LOCAL_FONTS==='1',production=process.env.NODE_ENV==='production';
Bun.serve({port,hostname:process.env.HOST??'0.0.0.0',async fetch(request){
 const url=new URL(request.url);
 if(url.pathname==='/'||url.pathname===base)return Response.redirect(new URL(base+'/',url),302);
 if(!url.pathname.startsWith(base+'/'))return new Response('Not found',{status:404});
 const path=url.pathname.slice(base.length);
 if(path.startsWith('/downloads/')){
  url.pathname=path;return fontDownloadResponse(new Request(url,request));
 }
 const font=catalog.find(f=>(f.asset||(localFonts&&f.file))&&path==='/fonts/'+f.id);
 if(font){
  const file=Bun.file(font.asset?import.meta.dir+'/font-assets/'+font.asset:'/System/Library/Fonts/Supplemental/'+font.file);
  return await file.exists()?new Response(file,{headers:{'content-type':'font/ttf','cache-control':'no-store'}}):new Response('Font not installed',{status:404});
 }
 if(path==='/semantic-worker.js'){
  if(production)return new Response(Bun.file(import.meta.dir+'/dist/semantic-worker.js'),{headers:{'content-type':'text/javascript'}});
  const result=await Bun.build({entrypoints:[import.meta.dir+'/semantic-worker.ts'],target:'browser',format:'esm'});
  return result.success?new Response(await result.outputs[0].text(),{headers:{'content-type':'text/javascript'}}):new Response('Worker build failed',{status:500});
 }
 if(path==='/demos/cursor')return Response.redirect(new URL(base+'/demos/cursor/',url),302);
 if(path==='/demos/four-corners')return Response.redirect(new URL(base+'/demos/four-corners/',url),302);
 const demo=path==='/demos/four-corners/'?'four-corners':path==='/demos/cursor/'?'cursor':null;
 if(path!=='/'&&!demo)return new Response('Not found',{status:404});
 try{return new Response(production?Bun.file(import.meta.dir+(demo?'/dist/'+demo+'.html':'/dist/index.html')):await build(localFonts,demo??'editor'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});}
 catch(error){console.error(error);return new Response('Build failed. Check the Fontzero server log.',{status:500});}
}});
console.log(`Fontzero: http://localhost:${port}${base}/ (${localFonts?'installed and bundled fonts':'bundled open fonts'})`);
