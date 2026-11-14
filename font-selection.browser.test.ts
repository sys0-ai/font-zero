import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('incompatible fonts cannot enter blends or routes; use alone preserves native fonts',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');await page.click('#control-toggle-blend');
  expect(await page.locator('.font-share:visible').count()).toBe(2);
  const search=async(name:string)=>{await page.locator('#font-library').evaluate((d:HTMLDetailsElement)=>d.open=true);await page.fill('#font-search',name);};
  await search('Papyrus');expect(await page.getByRole('button',{name:'Add Papyrus',exact:true}).isDisabled()).toBe(true);expect(await page.locator('#font-results').textContent()).toContain('Different:');
  await page.check('#compatible-only');expect(await page.getByRole('button',{name:'Add Papyrus',exact:true}).count()).toBe(0);await page.uncheck('#compatible-only');
  await page.getByRole('button',{name:'Use Papyrus alone',exact:true}).click();await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  expect(await page.locator('.font-share:visible').count()).toBe(1);expect(await page.locator('#weight-4').inputValue()).toBe('100');
  await page.fill('#sample-text','going minimum');await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  await page.click('#edit-start');expect(await page.locator('#weight-4').inputValue()).toBe('100');await page.click('#edit-end');expect(await page.locator('#weight-4').inputValue()).toBe('100');
  await search('Krypton');await page.getByRole('button',{name:'Use Krypton alone',exact:true}).click();await search('Radon');expect(await page.getByRole('button',{name:'Add Radon',exact:true}).isDisabled()).toBe(true);
  expect(await page.locator('#field-target option[value="2"]').evaluate((o:HTMLOptionElement)=>o.disabled)).toBe(true);
  await search('Times New Roman');await page.getByRole('button',{name:'Use Times New Roman alone',exact:true}).click();await search('Georgia');await page.getByRole('button',{name:'Add Georgia',exact:true}).click();
  await page.locator('#weight-7').evaluate((s:HTMLInputElement)=>{s.value='50';s.dispatchEvent(new Event('input'));});await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  expect(await page.locator('#weight-5').inputValue()).toBe('50');
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');await page.click('#passage-within-letters');
  await page.click('#view-tab-code');await page.waitForSelector('#code-view[data-ready=true]');
  expect(errors).toEqual([]);expect(await page.locator('#type-status').textContent()).not.toContain('Could not');
 }finally{await browser.close();}
},60000);
