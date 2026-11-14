import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {catalog} from './catalog';
test('unified attractors place, follow, bounce, fit, resize and restore',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  const url='http://fontzero.test/fontzero/demos/';await page.route(url,async r=>r.fulfill({body:await build(false,'attractors'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/font-assets/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto(url);const ready=()=>page.waitForSelector('#text-canvas[data-ready=true]',{timeout:60000});await ready();
  expect(await page.locator('#attractor-list .attractor-select').count()).toBe(2);
  expect(await page.locator('#construction-set').count()).toBe(0);
  const readAttractors=()=>page.locator('#text-canvas').evaluate(e=>JSON.parse((e as HTMLElement).dataset.attractors!));
  const original=await readAttractors(),options=await page.locator('#attractor-font option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value));
  await page.selectOption('#attractor-font',options[2]);await ready();
  const changed=await readAttractors();expect(changed[0].font).toBe(original[0].font);expect(changed[1].font).toBe(options[2]);
  expect(await page.locator('#attractor-font option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value))).toEqual(options);

  await page.click('#edit-text');await page.fill('#demo-text','What a lovely day.\nEvery curve moves.');await page.waitForTimeout(180);await ready();
  await page.locator('#line-height').evaluate((e:HTMLInputElement)=>{e.value='2.2';e.dispatchEvent(new Event('input'));});await page.click('#fit-text');await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>{const v=document.getElementById('viewport')!,c=document.getElementById('text-canvas')!,s=document.getElementById('demo-size') as HTMLInputElement;return {fitsWidth:c.offsetWidth<=v.clientWidth,fitsHeight:c.offsetHeight<=v.clientHeight,lineHeight:Number(c.dataset.lineHeight),size:Number(s.value)};});expect(layout.fitsWidth).toBe(true);expect(layout.fitsHeight).toBe(true);expect(layout.lineHeight).toBeCloseTo(layout.size*2.2);
  await page.click('#sampling');expect(await page.locator('#sampling').isChecked()).toBe(true);
  await page.click('#add-attractor');await ready();expect(await page.locator('#attractor-list .attractor-select').count()).toBe(3);
  const marker=await page.locator('.pole[data-selected=true]').boundingBox();await page.mouse.move(marker!.x+marker!.width/2,marker!.y+marker!.height/2);await page.mouse.down();await page.mouse.move(950,420);await page.mouse.up();await page.waitForTimeout(50);
  const pole=page.locator('.pole[data-selected=true]');let box=await pole.boundingBox();expect(box!.x+box!.width/2).toBeCloseTo(950,0);
  await page.mouse.move(950,420);await page.mouse.down();await page.mouse.move(880,440,{steps:5});await page.mouse.up();box=await pole.boundingBox();expect(box!.x+box!.width/2).toBeCloseTo(880,0);
  await page.selectOption('#attractor-mode','bounce');await page.waitForTimeout(80);const before=await pole.getAttribute('style');await page.waitForTimeout(200);expect(await pole.getAttribute('style')).not.toBe(before);
  await page.click('#motion');const frozen=await pole.getAttribute('style');await page.waitForTimeout(150);expect(await pole.getAttribute('style')).toBe(frozen);
  const card=await page.locator('.text-card').boundingBox(),ball=await pole.boundingBox();expect(ball!.x).toBeGreaterThan(card!.x);expect(ball!.x+ball!.width).toBeLessThan(card!.x+card!.width);
  await page.click('#add-attractor');await ready();expect(await page.locator('#attractor-list .attractor-select').count()).toBe(4);await page.locator('#attractor-list .attractor-remove').last().click();await ready();expect(await page.locator('#attractor-list .attractor-select').count()).toBe(3);
  const oldWidth=(await page.locator('.text-card').boundingBox())!.width;const edge=page.getByRole('button',{name:'Resize card right edge'});await edge.focus();await page.keyboard.press('ArrowRight');expect((await page.locator('.text-card').boundingBox())!.width).toBeCloseTo(oldWidth+10,0);
  await page.click('#fit-text');await page.screenshot({path:'/tmp/fontzero-attractors-controls.png'});
  await page.reload();await ready();expect(await page.locator('#attractor-list .attractor-select').count()).toBe(3);expect(await page.locator('#line-height').inputValue()).toBe('2.2');expect(await page.locator('#demo-text').inputValue()).toBe('What a lovely day.\nEvery curve moves.');expect(await page.locator('#sampling').isChecked()).toBe(true);expect(await page.locator('#motion').isChecked()).toBe(false);expect(await page.locator('#text-canvas').getAttribute('data-error')).toBeNull();expect(errors).toEqual([]);
  const selectedFont=await page.locator('#attractor-font').inputValue();await page.locator('#attractor-list .attractor-remove').last().click();await ready();expect(await page.locator('#attractor-font').inputValue()).toBe(selectedFont);
  await page.locator('#attractor-list .attractor-remove').first().click();await ready();expect(await page.locator('#attractor-list .attractor-remove').isDisabled()).toBe(true);
  await page.selectOption('#attractor-mode','ambient');await page.locator('#design-font').check();await page.waitForSelector('#text-canvas[data-design=true]');await page.locator('#preview-text').check();expect(await page.locator('#design-font').isChecked()).toBe(false);expect(await page.locator('#font-export-controls').isVisible()).toBe(false);
  expect(await page.locator('#place-attractor').count()).toBe(0);

 }finally{await browser.close();}
},120000);
