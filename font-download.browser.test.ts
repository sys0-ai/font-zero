import {test,expect} from 'bun:test';
import {chromium,webkit} from 'playwright';
import {build} from './build';
import {catalog} from './catalog';
import {parse} from 'opentype.js';
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]] as const)test(name+' completes an OTF download with the correct filename and valid font bytes',async()=>{
 const html=await build(),server=Bun.serve({port:0,hostname:'127.0.0.1',async fetch(request){
  const path=new URL(request.url).pathname;
  const entry=catalog.find(e=>path==='/fonts/'+e.id);
  if(entry)return new Response(Bun.file(entry.asset?import.meta.dir+'/font-assets/'+entry.asset:'/System/Library/Fonts/Supplemental/'+entry.file));
  return new Response(html,{headers:{'Content-Type':'text/html'}});
 }}),url=server.url.toString();
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto(url);await page.waitForSelector('#monaspace-field[data-ready=true]');
  const pending=page.waitForEvent('download',{timeout:90000});await page.click('#download-font');const download=await pending;
  expect(download.suggestedFilename()).toMatch(/^Type-Space-.*\.otf$/);expect(await download.failure()).toBeNull();
  const bytes=await Bun.file((await download.path())!).arrayBuffer();expect(parse(bytes).numGlyphs).toBe(96);
  expect(page.url()).toBe(url);expect(download.url()).toStartWith('blob:');expect(await page.locator('#font-download-form').count()).toBe(0);
 }finally{await browser.close();server.stop(true);}
},120000);
