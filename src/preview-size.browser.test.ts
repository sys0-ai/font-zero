import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {routeClassicFonts} from './test-font-routes';
test('Letters holds letter height and line width using spacing across font changes',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(true),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  const settled=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');};
  await page.fill('#sample-text','Shall I compare thee to a summer\u0027s day?');await settled();
  const box=()=>page.locator('#outline-path').evaluate(p=>{const b=p.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  const initial=await box();await page.click('#control-toggle-blend');
  const frame=await page.locator('#outline-view').getAttribute('viewBox');
  const same=async()=>{
   const b=await box();
   expect(Math.abs(b.width-initial.width)).toBeLessThan(.2);expect(Math.abs(b.height-initial.height)).toBeLessThan(.2);
   expect(Math.abs(b.x+b.width/2-initial.x-initial.width/2)).toBeLessThan(.1);
   expect(Math.abs(b.y+b.height/2-initial.y-initial.height/2)).toBeLessThan(.1);
   const current=(await page.locator('#outline-view').getAttribute('viewBox'))!.split(' ').map(Number);frame!.split(' ').map(Number).forEach((v,i)=>expect(Math.abs(v-current[i])).toBeLessThan(.01));
   expect(await page.locator('#outline-path').getAttribute('transform')).toBeNull();
  };
  for(const value of ['0','25','75','100']){await page.locator('#weight-5').evaluate((s:HTMLInputElement,v)=>{s.value=v;s.dispatchEvent(new Event('input'));},value);await settled();await same();}
  await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus');await page.getByRole('button',{name:'Use Papyrus alone',exact:true}).click();await settled();await same();
  await page.fill('#style-size-number','32');await settled();expect((await box()).height).toBeLessThan(initial.height*.8);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
