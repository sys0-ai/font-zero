import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {catalog} from './catalog';
test('published static files run at /font-zero with only bundled font assets',async()=>{
 const build=Bun.spawn(['bun','run','build:public'],{cwd:import.meta.dir,stdout:'ignore',stderr:'pipe'});expect(await build.exited).toBe(0);
 const server=Bun.serve({port:0,hostname:'127.0.0.1',async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/font-zero')return Response.redirect(new URL('/font-zero/',request.url));
  const file=Bun.file(import.meta.dir+'/public-dist'+path+(path.endsWith('/')?'index.html':''));
  return await file.exists()?new Response(file,{headers:{'Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'"}}):new Response('Not found',{status:404});
 }}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[],requests:string[]=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(new URL(r.url()).pathname));
  await page.goto(new URL('/font-zero',server.url).href);await page.waitForSelector('#text-canvas[data-ready=true]');
  expect(await page.locator('#wordmark canvas').isVisible()).toBe(true);expect(await page.getByRole('switch').count()).toBe(5);
  await page.locator('#design-font').check();await page.waitForSelector('#text-canvas[data-design=true]');await page.fill('#font-glyph','@');await page.click('#fit-text');
  expect(await page.locator('#text-canvas').getAttribute('data-error')).toBeNull();
  const download=page.waitForEvent('download');await page.click('#export-attractor-font');const file=await download;expect(await file.failure()).toBeNull();expect(file.suggestedFilename()).toEndWith('.otf');
  for(const path of requests.filter(p=>p.includes('/fonts/')))expect(catalog.find(f=>path.endsWith('/'+f.id))!.file).toBeUndefined();
  expect(requests.every(p=>p==='/font-zero'||p.startsWith('/font-zero/'))).toBe(true);expect(errors).toEqual([]);
 }finally{await browser.close();server.stop(true);}
},60000);
