import {test,expect} from 'bun:test';import {chromium} from 'playwright';
import {build} from './build';import {catalog} from './catalog';import {boots} from './four-corners-text';
test('centered card morphs on scroll with stable font widths and compatible menus',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/four-corners/',async r=>r.fulfill({body:await build(false,'four-corners'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/../fonts/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto('http://fontzero.test/fontzero/demos/four-corners/');await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});
  const settled=()=>page.waitForFunction(()=>{const v=document.getElementById('poem-viewport')!,c=document.getElementById('poem-canvas')!;return c.dataset.ready==='true'&&Number(c.dataset.scrollX)===v.scrollLeft&&Number(c.dataset.scrollY)===v.scrollTop;});await settled();
  expect(await page.locator('#demo-text').inputValue()).toBe(boots);
  const card=await page.locator('.text-card').boundingBox();expect(card!.x+card!.width/2).toBeCloseTo(720,1);expect(card!.width/card!.height).toBeCloseTo(9/19.5,3);expect(card!.y).toBeGreaterThan(100);expect(await page.locator('.text-card select,.text-card input,.text-card button').count()).toBe(0);
  const surface=page.locator('#poem-canvas canvas'),image=()=>surface.evaluate((e:HTMLCanvasElement)=>e.toDataURL());const before=await image();
  const width=await page.locator('#poem-canvas').evaluate(e=>e.getBoundingClientRect().width);
  await page.locator('#poem-viewport').evaluate(e=>e.scrollTop=180);await settled();expect(await image()).not.toBe(before);
  const vertical=await image();await page.locator('#poem-viewport').evaluate(e=>e.scrollLeft+=80);await settled();expect(await image()).not.toBe(vertical);
  // Keep the same backing surface and consume the latest scroll position each frame.
  await surface.evaluate(e=>(window as any).originalSurface=e);
  const timing=await page.evaluate(async()=>{const v=document.getElementById('poem-viewport')!,c=document.getElementById('poem-canvas')!;let lag=0,maxMs=0;for(let i=0;i<30;i++){v.scrollTop+=8;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);lag=Math.max(lag,Math.abs(v.scrollTop-Number(c.dataset.scrollY)));maxMs=Math.max(maxMs,Number(c.dataset.renderMs));}return {lag,maxMs,same:document.querySelector('#poem-canvas canvas')===(window as any).originalSurface};});
  expect(timing.same).toBe(true);expect(timing.lag).toBe(0);expect(timing.maxMs).toBeLessThan(80);
  await page.screenshot({path:'/tmp/fontzero-four-corners-card.png'});
  const replacement=await page.locator('#corner-1').inputValue();await page.selectOption('#corner-0',replacement);await settled();
  expect(await page.locator('#poem-canvas').evaluate(e=>e.getBoundingClientRect().width)).toBe(width);
  await page.reload();await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});expect(await page.locator('#corner-0').inputValue()).toBe(replacement);
  const alternative=await page.locator('#font-set option').evaluateAll(options=>(options as HTMLOptionElement[]).find(o=>o.textContent!.includes('Lora'))!.value);
  await page.selectOption('#font-set',alternative);await settled();
  expect(await page.locator('#poem-canvas').evaluate(e=>e.getBoundingClientRect().width)).toBe(width);
  const allowed=alternative.split(',');for(let corner=0;corner<4;corner++)expect(await page.locator('#corner-'+corner+' option').evaluateAll(options=>(options as HTMLOptionElement[]).map(o=>o.value).sort())).toEqual([...allowed].sort());
  await page.locator('#demo-size').evaluate((e:HTMLInputElement)=>{e.value='24';e.dispatchEvent(new Event('input'));});await page.waitForTimeout(100);await settled();
  const fit=await page.evaluate(()=>{const v=document.getElementById('poem-viewport')!,c=document.getElementById('poem-canvas')!,a=v.getBoundingClientRect(),b=c.getBoundingClientRect();return {narrow:b.width<v.clientWidth,offset:Math.abs((b.left+b.right)/2-(a.left+v.clientLeft+v.clientWidth/2))};});expect(fit.offset).toBeLessThan(1);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},120000);
