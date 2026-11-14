import {test,expect} from 'bun:test';import {chromium} from 'playwright';
import {build} from './build';import {catalog} from './catalog';import {boots} from './four-corners-text';
test('centered poem keeps natural advances and morphs against viewport corners on both scroll axes',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/four-corners/',async r=>r.fulfill({body:await build(false,'four-corners'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/font-assets/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto('http://fontzero.test/fontzero/demos/four-corners/');await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});
  const settled=()=>page.waitForFunction(()=>{const v=document.getElementById('poem-viewport')!,c=document.getElementById('poem-canvas')!;return Number(c.dataset.scrollX)===v.scrollLeft&&Number(c.dataset.scrollY)===v.scrollTop;});await settled();
  expect(await page.locator('#demo-text').inputValue()).toBe(boots);
  const centered=await page.locator('#poem-viewport').evaluate(e=>Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth)/2));expect(centered).toBeLessThan(2);
  const layout=await page.locator('[data-row="0"] path').evaluateAll(paths=>paths.map(p=>({column:Number((p as SVGPathElement).dataset.column),x:Number((p as SVGPathElement).dataset.x),advance:Number((p as SVGPathElement).dataset.advance),uv:JSON.parse((p as SVGPathElement).dataset.uv!)})));
  const field=await page.locator('#poem-canvas').evaluate(e=>({x:Number((e as HTMLElement).dataset.scrollX),width:Number((e as HTMLElement).dataset.viewWidth),offset:Number((e as HTMLElement).dataset.offsetX)}));
  for(let i=0;i<layout.length;i++){
   expect(layout[i].uv[0]).toBeCloseTo(Math.max(0,Math.min(1,(field.offset+layout[i].x-field.x)/field.width)),8);
   if(i&&layout[i].column===layout[i-1].column+1)expect(layout[i].x-layout[i-1].x).toBeCloseTo(layout[i-1].advance,5);
  }
  const glyph=page.locator('[data-row="3"] [data-column="19"]');const before={weights:await glyph.getAttribute('data-weights'),path:await glyph.getAttribute('d')};
  await page.locator('#poem-viewport').evaluate(e=>e.scrollTop=180);await settled();
  const vertical=await glyph.getAttribute('data-weights');expect(vertical).not.toBe(before.weights);expect(await glyph.getAttribute('d')).not.toBe(before.path);
  await page.locator('#poem-viewport').evaluate(e=>e.scrollLeft+=80);await settled();expect(await glyph.getAttribute('data-weights')).not.toBe(vertical);
  await page.screenshot({path:'/tmp/fontzero-viewport-anchors.png'});
  await page.locator('#poem-viewport').evaluate(e=>e.scrollTop=e.scrollHeight);await settled();expect(await page.locator('#poem-canvas svg').count()).toBeLessThan(12);
  const replacement=await page.locator('#corner-1').inputValue();await page.selectOption('#corner-0',replacement);await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});await settled();
  await page.reload();await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});expect(await page.locator('#corner-0').inputValue()).toBe(replacement);
  await page.locator('#demo-size').evaluate((e:HTMLInputElement)=>{e.value='24';e.dispatchEvent(new Event('input'));});await page.waitForTimeout(150);await page.waitForSelector('#poem-canvas[data-ready=true]');await settled();
  const fit=await page.evaluate(()=>{const v=document.getElementById('poem-viewport')!,c=document.getElementById('poem-canvas')!,a=v.getBoundingClientRect(),b=c.getBoundingClientRect();return {narrow:b.width<v.clientWidth,offset:Math.abs((b.left+b.right)/2-(a.left+v.clientLeft+v.clientWidth/2))};});expect(fit.narrow).toBe(true);expect(fit.offset).toBeLessThan(1);
  const alternative=await page.locator('#font-set option').evaluateAll(options=>(options as HTMLOptionElement[]).find(o=>o.textContent!.includes('Lora'))!.value);
  await page.selectOption('#font-set',alternative);await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});await settled();
  const allowed=alternative.split(',');
  for(let corner=0;corner<4;corner++){
   expect(await page.locator('#corner-'+corner+' option').evaluateAll(options=>(options as HTMLOptionElement[]).map(o=>o.value).sort())).toEqual([...allowed].sort());
   expect(await page.locator('#corner-'+corner+' option:disabled').count()).toBe(0);
  }
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},120000);
