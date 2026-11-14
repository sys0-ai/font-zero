import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {catalog} from './catalog';
import {cursorInfluence} from './cursor-math';
test('radial field has exact endpoints and adjustable decay',()=>{
 expect(cursorInfluence(0,180,1.5)).toBe(1);expect(cursorInfluence(180,180,1.5)).toBe(0);expect(cursorInfluence(200,180,1.5)).toBe(0);
 expect(cursorInfluence(90,180,3)).toBeLessThan(cursorInfluence(90,180,1));
});
test('cursor blends curves without moving text, resets outside and saves controls',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/cursor/',async r=>r.fulfill({body:await build(false,'cursor'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/font-assets/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto('http://fontzero.test/fontzero/demos/cursor/');await page.waitForSelector('#cursor-poem[data-ready=true]',{timeout:60000});
  const glyph=page.locator('#cursor-poem path').nth(16),original=await glyph.getAttribute('d'),transform=await glyph.getAttribute('transform');
  const box=await glyph.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#cursor-poem path')).some(p=>Number((p as SVGElement).dataset.weight)>.9));
  expect(await glyph.getAttribute('d')).not.toBe(original);expect(await glyph.getAttribute('transform')).toBe(transform);
  expect(await page.locator('#cursor-poem path').last().getAttribute('data-weight')).toBe('0');
  await page.screenshot({path:'/tmp/fontzero-cursor.png'});
  await page.mouse.move(10,10);await page.waitForSelector('#cursor-poem[data-pointer=none]');expect(await glyph.getAttribute('d')).toBe(original);
  await page.locator('#radius').evaluate((e:HTMLInputElement)=>{e.value='250';e.dispatchEvent(new Event('input'));});
  await page.locator('#decay').evaluate((e:HTMLInputElement)=>{e.value='2.5';e.dispatchEvent(new Event('input'));});
  await page.reload();await page.waitForSelector('#cursor-poem[data-ready=true]',{timeout:60000});expect(await page.locator('#radius').inputValue()).toBe('250');expect(await page.locator('#decay').inputValue()).toBe('2.5');
  const lora=catalog.findIndex(f=>f.id==='gf-lora');await page.selectOption('#base-font',String(lora));await page.waitForSelector('#cursor-poem[data-ready=true]',{timeout:60000});
  expect(await page.locator('#cursor-font option').count()).toBeGreaterThan(1);expect(errors).toEqual([]);
 }finally{await browser.close();}
},120000);
