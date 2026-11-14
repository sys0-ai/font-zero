import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('Letters preserves proportions inside a fixed frame across font changes, while size still works',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://type-space.test/',async r=>r.fulfill({body:await build(true),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://type-space.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  const settled=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};
  await page.fill('#sample-text','Shall I compare thee to a summer\u0027s day?');await settled();
  const box=()=>page.locator('#outline-path').evaluate(p=>{const b=p.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  const initial=await box();await page.click('#control-toggle-blend');
  const frame=await page.locator('#outline-view').getAttribute('viewBox');
  const same=async()=>{
   const b=await box();
   expect(b.width).toBeLessThanOrEqual(initial.width+.1);expect(b.height).toBeLessThanOrEqual(initial.height+.1);
   expect(Math.abs(b.x+b.width/2-initial.x-initial.width/2)).toBeLessThan(.1);
   expect(Math.abs(b.y+b.height/2-initial.y-initial.height/2)).toBeLessThan(.1);
   expect(await page.locator('#outline-view').getAttribute('viewBox')).toBe(frame);
   const matrix=await page.locator('#outline-path').evaluate((p:SVGPathElement)=>{const m=p.transform.baseVal.consolidate()!.matrix;return {x:m.a,y:m.d};});
   expect(matrix.x).toBe(matrix.y);
  };
  for(const value of ['0','25','75','100']){await page.locator('#weight-5').evaluate((s:HTMLInputElement,v)=>{s.value=v;s.dispatchEvent(new Event('input'));},value);await settled();await same();}
  await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus');await page.getByRole('button',{name:'Use Papyrus alone',exact:true}).click();await settled();await same();
  await page.fill('#style-size-number','32');await settled();expect((await box()).height).toBeLessThan(initial.height*.8);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
