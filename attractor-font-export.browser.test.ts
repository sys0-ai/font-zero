import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {parse} from 'opentype.js';
import {build} from './build';import {catalog} from './catalog';
test('font design centers glyphs, ignores moving poles and downloads its static outlines',async()=>{
 const html=await build(false,'attractors'),server=Bun.serve({port:0,hostname:'127.0.0.1',async fetch(request){
  const url=new URL(request.url),path=url.pathname.replace(/^\/fontzero/,'');
  const entry=catalog.find(f=>path==='/fonts/'+f.id);if(entry)return new Response(Bun.file(import.meta.dir+'/font-assets/'+entry.asset));
  return new Response(html,{headers:{'content-type':'text/html'}});
 }}),browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('/fontzero/demos/',server.url).toString());await page.waitForSelector('#text-canvas[data-ready=true]');
  await page.click('#edit-text');await page.fill('#demo-text','AB');await page.waitForTimeout(180);await page.waitForSelector('#text-canvas[data-ready=true]');await page.click('#design-font');await page.fill('#size-value','300');await page.waitForSelector('#text-canvas[data-design=true]');
  const shape=await page.locator('#text-canvas').getAttribute('data-design-path');await page.mouse.move(700,450);await page.waitForTimeout(60);expect(await page.locator('#text-canvas').getAttribute('data-design-path')).toBe(shape);
  await page.selectOption('#attractor-mode','bounce');await page.waitForTimeout(80);expect(await page.locator('#text-canvas').getAttribute('data-design-path')).toBe(shape);expect(await page.locator('.pole[data-mode=bounce]:visible').count()).toBe(0);
  await page.selectOption('#attractor-mode','placed');const box=await page.locator('#viewport').boundingBox(),marker=await page.locator('.pole[data-selected=true]').boundingBox();await page.mouse.move(marker!.x+marker!.width/2,marker!.y+marker!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+35,box!.y+box!.height/2);await page.mouse.up();await page.fill('#radius-value','90');await page.waitForTimeout(80);
  expect(await page.locator('#text-canvas').getAttribute('data-design-path')).not.toBe(shape);
  await page.fill('#font-glyph','g');await page.click('#fit-text');await page.waitForTimeout(80);expect(await page.locator('#text-canvas').getAttribute('data-error')).toBeNull();
  await page.fill('#font-export-name','comic-roman-sans-papyrus');const pending=page.waitForEvent('download',{timeout:60000});await page.click('#export-attractor-font');const download=await pending;
  expect(download.suggestedFilename()).toBe('comic-roman-sans-papyrus.otf');expect(await download.failure()).toBeNull();expect(download.url()).toStartWith('blob:');const font=parse(await Bun.file((await download.path())!).arrayBuffer());expect(font.numGlyphs).toBe(96);expect(font.names.fontFamily.en).toBe('comic-roman-sans-papyrus');
  const bytes=Array.from(new Uint8Array(await Bun.file((await download.path())!).arrayBuffer()));expect(await page.evaluate(async bytes=>{const face=new FontFace('Downloaded Attractors',new Uint8Array(bytes));await face.load();return face.status;},bytes)).toBe('loaded');
  await page.reload();await page.waitForSelector('#text-canvas[data-design=true]');expect(await page.locator('#font-export-name').inputValue()).toBe('comic-roman-sans-papyrus');expect(await page.locator('#font-glyph').inputValue()).toBe('g');expect(errors).toEqual([]);
 }finally{await browser.close();server.stop(true);}
},90000);
