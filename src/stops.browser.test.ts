import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('multiple text stops change fonts, size and effects; the library and controls fit one desktop',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  expect(await page.locator('#font-mixer input[type=range]').count()).toBe(110);
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');
  await page.locator('#long-text').evaluate((e:HTMLTextAreaElement)=>e.setSelectionRange(23,23));await page.locator('#section-stops').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.click('#add-stop');
  await page.waitForFunction(()=>document.getElementById('passage-view')!.dataset.stops==='3');
  await page.selectOption('#passage-size-scope','stop');
  await page.locator('#section-shape').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.locator('#style-size').evaluate((e:HTMLInputElement)=>{e.value='60';e.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>document.querySelector('[data-character="23"] title')?.textContent?.includes('60.0px'));
  await page.locator('#section-effects').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.locator('#effect-shadow').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.locator('#style-shadowOpacity').evaluate((e:HTMLInputElement)=>{e.value='.7';e.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>document.querySelector('[data-character="23"]')?.getAttribute('style')?.includes('drop-shadow'));
  await page.locator('#section-blend').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus');await page.getByRole('button',{name:'Use Papyrus alone',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  await page.locator('#section-stops').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.locator('#long-text').evaluate((e:HTMLTextAreaElement)=>e.setSelectionRange(85,85));await page.click('#add-stop');await page.waitForFunction(()=>document.getElementById('passage-view')!.dataset.stops==='4');
  await page.click('#passage-within-letters');await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  for(const panel of ['blend','stops','effects','seeds','map','forms','shape','variation','time','export']){
   await page.locator('#section-'+panel).evaluate((e:HTMLDetailsElement)=>e.open=true);const fit=await page.evaluate(panel=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,bottom:document.getElementById('control-'+panel)!.getBoundingClientRect().bottom}),panel);
   expect(fit.w).toBe(1024);expect(fit.h).toBe(640);
  }
  const svgDownload=page.waitForEvent('download');await page.click('#download-scene');expect((await svgDownload).suggestedFilename()).toEndWith('.svg');
  const fontDownload=page.waitForEvent('download');await page.click('#download-font');expect((await fontDownload).suggestedFilename()).toEndWith('.otf');
  expect(errors).toEqual([]);expect(await page.locator('#type-status').textContent()).not.toContain('Could not');
 }finally{await browser.close();}
},120000);
