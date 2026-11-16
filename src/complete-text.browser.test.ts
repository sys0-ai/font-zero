import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {routeClassicFonts} from './test-font-routes';
test('Letters renders the final g, all lines, and keeps textured outlines inside its viewport',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  await page.click('#control-toggle-blend');await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus Universal');await page.getByRole('button',{name:'Use Papyrus Universal alone',exact:true}).click();
  const setText=async(text:string)=>{const build=await page.locator('#monaspace-field').getAttribute('data-build');await page.fill('#sample-text',text);await page.waitForFunction(build=>document.getElementById('monaspace-field')!.dataset.build!==build,build);};
  const contours=()=>page.locator('#outline-path').evaluate(p=>(p.getAttribute('d')!.match(/M/g)||[]).length);
  await setText('the quick brown do');const before=await contours();await setText('the quick brown dog');expect(await contours()).toBeGreaterThan(before);
  await setText('g');const one=await contours();await setText('ggggggggggggggggggg\ng\ng');expect(await contours()).toBe(one*21);
  await page.fill('#style-size-number','160');await page.click('#control-toggle-effects');
  await page.locator('#style-edgeRoughness').evaluate((s:HTMLInputElement)=>{s.value='100';s.dispatchEvent(new Event('input'));});
  await page.waitForTimeout(100);await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.busy==='false');
  const fit=await page.evaluate(()=>{const svg=document.getElementById('outline-view') as unknown as SVGSVGElement,b=(document.getElementById('outline-path') as unknown as SVGPathElement).getBBox(),v=svg.viewBox.baseVal;return b.x>=v.x&&b.y>=v.y&&b.x+b.width<=v.x+v.width&&b.y+b.height<=v.y+v.height;});expect(fit).toBe(true);
  const download=page.waitForEvent('download');await page.click('#download-scene');expect((await download).suggestedFilename()).toEndWith('.svg');
  await page.fill('#sample-text','');await page.waitForFunction(()=>document.getElementById('outline-path')!.getAttribute('d')==='');expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
