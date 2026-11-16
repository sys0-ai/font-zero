import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test.skipIf(process.platform!=='darwin')('compatible mixer, locks and export fit one page',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  expect(await page.locator('#font-mixer input[type=range]').count()).toBe(110);
  await page.click('#control-toggle-blend');
  await page.check('#lock-5');
  expect(await page.locator('#weight-5').isDisabled()).toBe(true);
  await page.uncheck('#lock-5');
  await page.locator('#weight-7').evaluate((s:HTMLInputElement)=>{s.value='30';s.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>Math.abs(JSON.parse(document.getElementById('monaspace-field')!.dataset.weights!)[7]-.3)<1e-6);
  const weights=JSON.parse((await page.locator('#monaspace-field').getAttribute('data-weights'))!);
  expect(weights[5]).toBeCloseTo(.7,12);expect(weights.reduce((a:number,b:number)=>a+b,0)).toBeCloseTo(1,12);
  await page.locator('#section-forms').evaluate((e:HTMLDetailsElement)=>e.open=true);
  expect(await page.locator('#forms-notice, #lock-description').count()).toBe(0);
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');await page.click('#passage-within-letters');
  await page.click('#view-tab-code');await page.waitForSelector('#code-view[data-ready=true]');
  for(const panel of ['blend','map','forms','shape','variation','time','export']){
   await page.locator('#section-'+panel).evaluate((e:HTMLDetailsElement)=>e.open=true);
   const fit=await page.evaluate(panel=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,bottom:document.getElementById('control-'+panel)!.getBoundingClientRect().bottom}),panel);
   expect(fit.w).toBe(1024);expect(fit.h).toBe(640);
  }
  const download=page.waitForEvent('download');await page.click('#download-font');expect((await download).suggestedFilename()).toEndWith('.otf');
  expect(errors).toEqual([]);expect(await page.locator('#type-status').textContent()).not.toContain('Could not');
 }finally{await browser.close();}
},60000);
