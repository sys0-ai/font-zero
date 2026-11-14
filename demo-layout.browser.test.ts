import {savedCursorSession} from './attractor-browser-fixture';
import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {catalog} from './catalog';
test('wrap, padding, Fit and light mode update and persist without replacing saved fonts',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/',async r=>r.fulfill({body:await build(false,'attractors'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/font-assets/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await savedCursorSession(page);await page.goto('http://fontzero.test/fontzero/demos/');const ready=()=>page.waitForSelector('#text-canvas[data-ready=true]');await ready();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
  const card=await page.locator('#viewport').boundingBox();expect(Math.abs(card!.width-card!.height)).toBeLessThan(2);expect(await page.getByRole('heading',{name:'Font attractors',exact:true}).count()).toBe(0);
  const set=async(id:string,value:string)=>{await page.locator(id).evaluate((e:HTMLInputElement,v)=>{e.value=v;e.dispatchEvent(new Event('input'));},value);};
  await page.click('#edit-text');await page.fill('#demo-text','A');await page.waitForTimeout(200);await ready();
  await page.fill('#size-value','800');expect(await page.locator('#demo-size').inputValue()).toBe('800');
  await page.reload();await ready();expect(await page.locator('#size-value').inputValue()).toBe('800');
  await page.click('#fit-text');expect(Number(await page.locator('#demo-size').inputValue())).toBeGreaterThan(128);
  await page.waitForTimeout(80);
  const ink=await page.locator('#text-canvas canvas').evaluate((canvas:HTMLCanvasElement)=>{
   const {width:w,height:h}=canvas,image=canvas.getContext('2d')!.getImageData(0,0,w,h).data;let left=w,right=0,top=h,bottom=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(image[(y*w+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   return {w,h,left,right,top,bottom};
  });
  expect(Math.abs((ink.left+ink.right)/2-ink.w/2)).toBeLessThan(2);expect(Math.abs((ink.top+ink.bottom)/2-ink.h/2)).toBeLessThan(2);
  expect(Math.min(ink.left,ink.top)).toBeGreaterThanOrEqual(23);expect(Math.min(ink.left,ink.top)).toBeLessThan(27);

  await page.click('#edit-text');await page.fill('#demo-text','A long sentence that should wrap naturally inside this narrow card without moving other letters when a font attractor passes.\n\nAnother paragraph.');await page.waitForTimeout(200);await ready();
  await set('#demo-size','32');await set('#padding','50');await page.click('#wrap-text');await page.waitForTimeout(80);
  const bounds=()=>page.evaluate(()=>{const v=document.getElementById('viewport')!,c=document.getElementById('text-canvas')!;return {width:c.offsetWidth,maxWidth:v.clientWidth,height:c.offsetHeight,maxHeight:v.clientHeight};});
  const wrapped=await bounds();expect(wrapped.width).toBeLessThanOrEqual(wrapped.maxWidth);
  await page.click('#fit-text');await page.waitForTimeout(80);const fit=await bounds();expect(fit.width).toBeLessThanOrEqual(fit.maxWidth);expect(fit.height).toBeLessThanOrEqual(fit.maxHeight);
  await set('#decay','0');expect(await page.locator('#decay-value').textContent()).toBe('0');
  await page.click('#theme-toggle');expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');await page.reload();await ready();expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');await page.click('#theme-toggle');expect(await page.locator('html').getAttribute('data-theme')).toBe('light');expect(await page.locator('#viewport').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(39, 39, 36)');
  await page.reload();await ready();expect(await page.locator('#decay').inputValue()).toBe('0');expect(await page.locator('#padding').inputValue()).toBe('50');expect(await page.locator('#wrap-text').isChecked()).toBe(true);expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
  const before=await page.locator('#text-canvas').evaluate(e=>JSON.parse((e as HTMLElement).dataset.attractors!));
  await page.selectOption('#attractor-font','redacted');await ready();await page.selectOption('#attractor-mode','ambient');await page.waitForTimeout(60);
  const after=await page.locator('#text-canvas').evaluate(e=>JSON.parse((e as HTMLElement).dataset.attractors!));expect(after[0].font).toBe(before[0].font);expect(after[1].font).toBe('redacted');expect(await page.locator('#text-canvas').getAttribute('data-error')).toBeNull();
  // Old selected fonts remain themselves, without the removed informational blocks.
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fontzero.attractors.v1')!));saved.attractors.forEach((a:any)=>a.font='gf-cormorantgaramond');await page.addInitScript(s=>localStorage.setItem('fontzero.attractors.v1',JSON.stringify(s)),saved);
  await page.reload();await ready();expect(await page.locator('#status').textContent()).toBe('');expect(await page.locator('#font-set-summary').count()).toBe(0);
  expect(await page.locator('#text-canvas').evaluate(e=>JSON.parse((e as HTMLElement).dataset.attractors!).every((a:any)=>a.font==='gf-cormorantgaramond'))).toBe(true);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
