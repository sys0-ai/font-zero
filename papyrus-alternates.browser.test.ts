import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {routeClassicFonts} from './test-font-routes';
test('Papyrus alternates blend with selected native forms, show their proof, and keep incompatible partners blocked',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');await page.click('#control-toggle-blend');
  const search=async(name:string)=>{await page.locator('#font-library').evaluate((d:HTMLDetailsElement)=>d.open=true);await page.fill('#font-search',name);};
  const settled=async()=>{await page.waitForTimeout(80);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};
  await search('Papyrus');await page.check('#compatible-only');expect(await page.getByRole('button',{name:'Add Papyrus',exact:true}).count()).toBe(0);
  await page.getByRole('button',{name:'Add Papyrus Alternates · experimental',exact:true}).click();
  await page.locator('#weight-109').evaluate((s:HTMLInputElement)=>{s.value='100';s.dispatchEvent(new Event('input'));});await settled();
  expect(await page.locator('#papyrus-form-proof figure').count()).toBe(14);expect(await page.locator('#papyrus-coverage').textContent()).toContain('Active alternates: &, 6, 9, g');
  await page.fill('#sample-text','aging & 69\nminimum');await settled();
  await page.click('#view-tab-passage');await page.waitForSelector('#passage-view[data-ready=true]');await page.click('#passage-within-letters');await settled();
  await page.click('#view-tab-code');await page.waitForSelector('#code-view[data-ready=true]');
  await search('Radon');expect(await page.locator('#font-results button').count()).toBe(0);await page.uncheck('#compatible-only');await page.getByRole('button',{name:'Use Radon alone',exact:true}).click();
  await search('Papyrus');await page.getByRole('button',{name:'Add Papyrus Alternates · experimental',exact:true}).click();
  await page.locator('#weight-109').evaluate((s:HTMLInputElement)=>{s.value='50';s.dispatchEvent(new Event('input'));});await settled();
  expect(await page.locator('#papyrus-coverage').textContent()).toContain('a, g');
  await page.click('#view-tab-letters');await settled();expect(await page.locator('#monaspace-field').getAttribute('data-error')).toBeNull();expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
