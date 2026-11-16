import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {catalog} from './catalog';
import {passage} from './attractor-text';
for(const local of [false,true])test(`four-corner default and outline-based passage Fit (${local?'installed':'bundled'})`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/',async r=>r.fulfill({body:await build(local,'attractors'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(f.asset?import.meta.dir+'/../fonts/'+f.asset:'/System/Library/Fonts/Supplemental/'+f.file).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto('http://fontzero.test/fontzero/demos/');await page.waitForSelector('#text-canvas[data-ready=true]');
  expect(await page.locator('#demo-text').inputValue()).toBe(passage);expect(await page.locator('#wrap-text').isChecked()).toBe(true);expect(await page.locator('#attractor-list .attractor-select').count()).toBe(4);
  const inspect=()=>page.locator('#text-canvas canvas').evaluate((canvas:HTMLCanvasElement)=>{
   const v=document.getElementById('viewport')!,im=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let l=canvas.width,r=0,t=canvas.height,b=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(im[(y*canvas.width+x)*4+3]>20){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
   return {l,r,t,b,w:canvas.width,h:canvas.height,scrollW:v.scrollWidth,scrollH:v.scrollHeight,clientW:v.clientWidth,clientH:v.clientHeight};
  });
  await page.waitForTimeout(80);const first=await inspect();
  expect(first.l).toBeGreaterThanOrEqual(47);expect(first.t).toBeGreaterThanOrEqual(47);expect(first.r).toBeLessThanOrEqual(first.w-47);expect(first.b).toBeLessThanOrEqual(first.h-47);
  expect((first.b-first.t)/(first.h-96)).toBeGreaterThan(.9);expect(first.scrollW).toBe(first.clientW);expect(first.scrollH).toBe(first.clientH);
  await page.screenshot({path:`/tmp/fontzero-default-${local?'local':'public'}.png`});
  await page.click('#fit-text');const size=await page.locator('#demo-size').inputValue();await page.click('#fit-text');expect(await page.locator('#demo-size').inputValue()).toBe(size);
  await page.locator('#demo-size').evaluate((e:HTMLInputElement)=>{e.value='250';e.dispatchEvent(new Event('input'));});
  await page.locator('#viewport').evaluate(e=>e.scrollTo(0,500));await page.click('#fit-text');await page.waitForTimeout(80);expect(await page.locator('#viewport').evaluate(e=>e.scrollTop)).toBe(0);
  await page.click('#edit-text');await page.fill('#demo-text','jfy Qg\nWATER');await page.waitForTimeout(250);await page.waitForSelector('#text-canvas[data-ready=true]');await page.click('#wrap-text');await page.click('#fit-text');await page.waitForTimeout(80);
  const short=await inspect();expect(short.l).toBeGreaterThanOrEqual(47);expect(short.t).toBeGreaterThanOrEqual(47);expect(short.r).toBeLessThanOrEqual(short.w-47);expect(short.b).toBeLessThanOrEqual(short.h-47);expect(short.scrollH).toBe(short.clientH);
  await page.reload();await page.waitForSelector('#text-canvas[data-ready=true]');expect(await page.locator('#demo-text').inputValue()).toBe('jfy Qg\nWATER');expect(await page.locator('#wrap-text').isChecked()).toBe(false);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
