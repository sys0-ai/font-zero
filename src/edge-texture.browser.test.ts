import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {routeClassicFonts} from './test-font-routes';
test('Papyrus edge controls update vector previews, text stops and downloads',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  await page.click('#control-toggle-effects');await page.fill('#sample-text','Ragged edges');await page.fill('#style-size-number','110');
  const settled=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};await settled();
  const set=async(id:string,value:string)=>{await page.locator('#'+id).evaluate((s:HTMLInputElement,v)=>{s.value=v;s.dispatchEvent(new Event('input'));},value);await settled();};
  const original=await page.locator('#outline-path').getAttribute('d'),builds=await page.locator('#monaspace-field').getAttribute('data-build');
  await set('style-edgeRoughness','100');const textured=await page.locator('#outline-path').getAttribute('d');expect(textured).not.toBe(original);expect(await page.locator('#monaspace-field').getAttribute('data-build')).toBe(builds);
  await set('style-edgeScale','1.8');expect(await page.locator('#outline-path').getAttribute('d')).not.toBe(textured);
  await page.screenshot({path:'/tmp/fontzero-edge-texture.png'});
  await page.click('#new-edge-pattern');await settled();const newPattern=await page.locator('#outline-path').getAttribute('d');expect(newPattern).not.toBe(textured);
  await set('style-edgeRoughness','0');expect(await page.locator('#outline-path').getAttribute('d')).toBe(original);
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');await page.fill('#long-text','Ragged edges on any font.');await settled();
  const cleanStart=await page.locator('#passage-view g path').first().getAttribute('d');await set('style-edgeRoughness','80');expect(await page.locator('#passage-view g path').first().getAttribute('d')).not.toBe(cleanStart);
  await page.click('#passage-within-letters');await settled();await page.click('#view-tab-code');await page.waitForSelector('#code-view[data-ready=true]');await set('style-edgeRoughness','0');const code=await page.locator('#code-view').innerHTML();await set('style-edgeRoughness','65');expect(await page.locator('#code-view').innerHTML()).not.toBe(code);
  const download=page.waitForEvent('download');await page.click('#download-font');expect((await download).suggestedFilename()).toEndWith('.otf');expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
