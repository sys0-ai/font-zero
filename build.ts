import { join } from 'node:path';
export async function build(localFonts=false,page:'editor'|'four-corners'='editor') {
 const here=import.meta.dir;
 const result=await Bun.build({entrypoints:[join(here,page==='editor'?'app.ts':'four-corners.ts')],target:'browser',format:'esm',minify:true,define:{'FONTZERO_LOCAL_FONTS':String(localFonts)},plugins:[{name:'inline-harfbuzz',setup(builder){
  builder.onLoad({filter:/harfbuzzjs\/dist\/index\.mjs$/},async args=>{
   const wasm=await Bun.file(join(here,'node_modules/harfbuzzjs/dist/harfbuzz.wasm')).arrayBuffer();
   const data=Buffer.from(wasm).toString('base64');
   const code=await Bun.file(args.path).text();
   return {contents:code.replace('createHarfBuzz()','createHarfBuzz({wasmBinary:Uint8Array.from(atob('+JSON.stringify(data)+'),c=>c.charCodeAt(0))})'),loader:'js'};
  });
  builder.onLoad({filter:/harfbuzzjs\/dist\/harfbuzz\.js$/},async args=>({contents:(await Bun.file(args.path).text()).replace(/var ENVIRONMENT_IS_NODE=.*?;/,'var ENVIRONMENT_IS_NODE=false;').replace('await import("module")','{}'),loader:'js'}));
 }}]});
 if(!result.success)throw new Error(result.logs.map(String).join('\n'));
 const js=await result.outputs[0].text();
 const markup=await Bun.file(join(here,page==='editor'?'interface.html':'four-corners.html')).text();
 const css=await Bun.file(join(here,page==='editor'?'page.css':'four-corners.css')).text();
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${page==='four-corners'?'<base href="/fontzero/">':''}<title>Fontzero — ${page==='editor'?'Font library':'Four corners'}</title><style>${css}</style></head><body><main>${markup}</main><script type="module">${js.replaceAll('</script','<\\/script')}</script></body></html>`;
}
if(import.meta.main){
 const {mkdir,copyFile}=await import('node:fs/promises');
 const {catalog}=await import('./catalog');
 await mkdir('dist/fonts',{recursive:true});await mkdir('dist/licenses',{recursive:true});
 await Bun.write('dist/index.html',await build(false));
 await Bun.write('dist/four-corners.html',await build(false,'four-corners'));
 const worker=await Bun.build({entrypoints:[join(import.meta.dir,'semantic-worker.ts')],target:'browser',format:'esm',minify:true});
 if(!worker.success)throw new Error(worker.logs.map(String).join('\n'));
 await Bun.write('dist/semantic-worker.js',await worker.outputs[0].text());
 for(const font of catalog.filter(f=>f.asset)){
  await copyFile(join(import.meta.dir,'font-assets',font.asset!),join('dist/fonts',font.id));
  if(font.licenseAsset)await copyFile(join(import.meta.dir,'font-assets',font.licenseAsset),join('dist/licenses',font.id+'.txt'));
 }
 await copyFile(join(import.meta.dir,'OFL.txt'),'dist/licenses/monaspace.txt');
 console.log('Built Fontzero in dist/ for /fontzero/ (bundled open fonts only).');
}
