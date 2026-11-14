import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {catalog,monaspaceIds} from './catalog';
import {differentLetters} from './compatibility';
test('all five Monaspace families render without replacing incompatible neighbors',async()=>{
 const html=await build(false,'attractors','/');
 const server=Bun.serve({port:0,hostname:'127.0.0.1',fetch(req){
  const path=new URL(req.url).pathname,f=catalog.find(f=>f.asset&&path==='/fonts/'+f.id);
  return f?new Response(Bun.file(import.meta.dir+'/font-assets/'+f.asset)):new Response(html,{headers:{'content-type':'text/html'}});
 }}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('fontzero.attractors.v1',JSON.stringify({version:1,attractors:[{id:'one',font:'krypton',mode:'ambient',x:0,y:0,radius:300,decay:1,vx:70,vy:55}],selected:'one',text:'ag Neon Xenon',size:48,leading:1.3,padding:24,within:true,wrap:true,light:true})));
  await page.goto(String(server.url));await page.waitForSelector('#text-canvas[data-ready=true]');
  for(const id of monaspaceIds){
   await page.selectOption('#attractor-font',id);await page.waitForSelector('#text-canvas[data-ready=true]');
   expect(await page.locator('#text-canvas').getAttribute('data-error')).toBeNull();
   expect(await page.locator('#attractor-font').inputValue()).toBe(id);
  }
  await page.click('#add-attractor');await page.waitForSelector('#text-canvas[data-ready=true]');
  const selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('fontzero.attractors.v1')!).attractors.map((a:any)=>a.font));
  expect(selected[0]).toBe('xenon');expect(differentLetters(selected.map((id:string)=>catalog.findIndex(f=>f.id===id)))).toEqual([]);
  expect(errors).toEqual([]);
 }finally{await browser.close();server.stop(true);}
},60000);
