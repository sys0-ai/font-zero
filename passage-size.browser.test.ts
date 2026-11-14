import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('passage size changes visible curves in both modes and can still target a text stop',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');await page.click('#edit-end');
  await page.fill('#long-text','Q');
  const settled=async()=>{await page.waitForTimeout(80);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};
  const size=async(n:number)=>{await page.fill('#style-size-number',String(n));await settled();};
  const height=()=>page.locator('#passage-view').evaluate(svg=>{const p=svg.querySelector('g path,use,path')!;return p.getBoundingClientRect().height;});
  await size(24);const small=await height();await size(72);expect(await height()).toBeGreaterThan(small*2.8);
  await page.fill('#long-text','Hello world');await page.click('#passage-within-letters');
  await page.locator('#style-size').evaluate((e:HTMLInputElement)=>{e.value='44';e.dispatchEvent(new Event('input'));});await settled();
  expect(await page.locator('#passage-view g title').allTextContents()).toEqual(expect.arrayContaining(['H · 44.0px · weight 450','d · 44.0px · weight 450']));
  await page.selectOption('#passage-size-scope','stop');await size(80);
  expect(await page.locator('#passage-view g title').first().textContent()).toContain('44.0px');
  expect(await page.locator('#passage-view g title').last().textContent()).toContain('80.0px');
  await page.locator('#section-stops').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.uncheck('#use-stops');await settled();
  await size(24);const simpleSmall=await height();await size(72);expect(await height()).toBeGreaterThan(simpleSmall*2.8);
  await page.fill('#long-text','Hello world '.repeat(45));await size(100);
  expect(Number(await page.locator('#passage-view').getAttribute('data-pages'))).toBeGreaterThan(1);
  await page.click('#story-next');await settled();expect(await page.locator('#passage-view').getAttribute('data-page')).toBe('2');
  const fit=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]);expect(fit).toEqual([1440,900]);expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
