import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('reload restores text, styles, blend, locks, foldouts and the exact preview',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(true),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  await page.fill('#sample-text','Remember this font\nand this line');await page.fill('#style-size-number','48');
  await page.click('#control-toggle-blend');await page.locator('#weight-5').evaluate((s:HTMLInputElement)=>{s.value='70';s.dispatchEvent(new Event('input'));});await page.check('#lock-5');
  await page.click('#control-toggle-effects');await page.locator('#style-edgeRoughness').evaluate((s:HTMLInputElement)=>{s.value='25';s.dispatchEvent(new Event('input'));});
  await page.waitForTimeout(400);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  const snapshot=()=>page.evaluate(()=>({path:document.getElementById('outline-path')!.getAttribute('d'),viewBox:document.getElementById('outline-view')!.getAttribute('viewBox'),text:(document.getElementById('sample-text') as HTMLTextAreaElement).value,size:(document.getElementById('style-size-number') as HTMLInputElement).value,weights:document.getElementById('monaspace-field')!.dataset.weights,locked:(document.getElementById('lock-5') as HTMLInputElement).checked,rough:(document.getElementById('style-edgeRoughness') as HTMLInputElement).value,blend:(document.getElementById('section-blend') as HTMLDetailsElement).open,effects:(document.getElementById('section-effects') as HTMLDetailsElement).open}));
  await page.locator('#time-duration').evaluate((e:HTMLInputElement)=>{e.value='75';e.dispatchEvent(new Event('change'));});
  const before=await snapshot();expect(before.locked).toBe(true);expect(before.rough).toBe('25');
  await page.reload();await page.waitForSelector('#monaspace-field[data-ready=true]');await page.waitForTimeout(200);expect(await snapshot()).toEqual(before);expect(await page.locator('#time-duration').inputValue()).toBe('75');expect(await page.locator('#monaspace-field').getAttribute('data-playing')).toBe('false');expect(errors).toEqual([]);
  await page.click('#view-tab-passage');await page.fill('#long-text','A passage to remember.');await page.waitForTimeout(400);await page.reload();await page.waitForSelector('#passage-view[data-ready=true]');expect(await page.locator('#view-tab-passage').getAttribute('aria-selected')).toBe('true');expect(await page.locator('#long-text').inputValue()).toBe('A passage to remember.');expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
