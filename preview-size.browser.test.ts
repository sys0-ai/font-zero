import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('Letters keeps its ink footprint across blending and font replacement, while size still works',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(true),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  const settled=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};
  await page.fill('#sample-text','Shall I compare thee to a summer\u0027s day?');await settled();
  const box=()=>page.locator('#outline-path').evaluate(p=>{const b=p.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  const initial=await box();await page.click('#control-toggle-blend');
  const same=async()=>{const b=await box();for(const key of ['x','y','width','height'] as const)expect(Math.abs(b[key]-initial[key])).toBeLessThan(.1);};
  for(const value of ['0','25','75','100']){await page.locator('#weight-5').evaluate((s:HTMLInputElement,v)=>{s.value=v;s.dispatchEvent(new Event('input'));},value);await settled();await same();}
  await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus');await page.getByRole('button',{name:'Use Papyrus alone',exact:true}).click();await settled();await same();
  await page.fill('#style-size-number','32');await settled();expect((await box()).height).toBeLessThan(initial.height*.8);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
