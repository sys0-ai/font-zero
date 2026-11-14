import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('size stays visible, edits the current preview, and foldouts work with the keyboard',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  expect(await page.locator('#style-size-number').inputValue()).toBe('64');expect(await page.locator('.control-section[open]').count()).toBe(0);
  const width=await page.locator('#outline-path').evaluate((p:SVGGraphicsElement)=>p.getBBox().width);
  await page.fill('#style-size-number','96');await page.waitForFunction(w=>(document.getElementById('outline-path') as unknown as SVGGraphicsElement).getBBox().width>w*1.4,width);
  expect(await page.locator('#style-size').inputValue()).toBe('96');
  await page.locator('#control-toggle-effects').focus();await page.keyboard.press('Enter');expect(await page.locator('#section-effects').evaluate((d:HTMLDetailsElement)=>d.open)).toBe(true);
  await page.locator('#effect-shadow summary').focus();await page.keyboard.press('Space');expect(await page.locator('#style-shadowBlur').isVisible()).toBe(true);
  const top=await page.locator('#quick-size').evaluate(e=>e.getBoundingClientRect().top);
  for(const panel of ['blend','shape','stops','effects','variation','forms','map','seeds','time','export'])await page.locator('#section-'+panel).evaluate((d:HTMLDetailsElement)=>d.open=true);
  await page.locator('.control-foldouts').evaluate(e=>e.scrollTop=e.scrollHeight);
  expect(await page.locator('#quick-size').evaluate(e=>e.getBoundingClientRect().top)).toBe(top);
  expect(await page.evaluate(()=>({x:scrollX,y:scrollY,w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}))).toEqual({x:0,y:0,w:1024,h:640});
  await page.click('#view-tab-code');expect(await page.locator('#style-size-number').inputValue()).toBe('20');await page.fill('#style-size-number','30');expect(await page.locator('#style-size').inputValue()).toBe('30');
  await page.click('#view-tab-letters');expect(await page.locator('#style-size-number').inputValue()).toBe('96');
  await page.click('#view-tab-passage');expect(await page.locator('#style-size-number').inputValue()).toBe('32');await page.fill('#style-size-number','44');
  await page.waitForFunction(()=>document.querySelector('[data-character="0"] title')?.textContent?.includes('44.0px'));
  await page.click('#collapse-controls');expect(await page.locator('.control-section[open]').count()).toBe(0);expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
