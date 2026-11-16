import {test,expect} from 'bun:test';import {chromium} from 'playwright';import {build} from './build';import {catalog} from './catalog';
test('both demos resize, edit text, set size, toggle sampling and retain settings',async()=>{
 const browser=await chromium.launch({headless:true});try{
  for(const demo of ['cursor','four-corners'] as const){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
   const url='http://fontzero.test/fontzero/demos/'+demo+'/';
   await page.route(url,async r=>r.fulfill({body:await build(true,demo),contentType:'text/html'}));
   await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(f.asset?import.meta.dir+'/../fonts/'+f.asset:'/System/Library/Fonts/Supplemental/'+f.file).arrayBuffer()),contentType:'font/ttf'});});
   await page.goto(url);const ready=demo==='cursor'?'#cursor-poem':'#poem-canvas';await page.waitForSelector(ready+'[data-ready=true]',{timeout:60000});
   const card=page.locator('.text-card'),before=await card.boundingBox(),edge=await page.getByRole('button',{name:'Resize card right edge'}).boundingBox();
   await page.mouse.move(edge!.x+edge!.width/2,edge!.y+edge!.height/2);await page.mouse.down();await page.mouse.move(edge!.x+edge!.width/2+100,edge!.y+edge!.height/2,{steps:10});await page.mouse.up();
   expect((await card.boundingBox())!.width).toBeCloseTo(before!.width+200,0);
   await page.click('#edit-text');await page.fill('#demo-text','What a lovely day.\nWhat a lovely day.');await page.waitForTimeout(180);await page.waitForSelector(ready+'[data-ready=true]');
   await page.locator('#demo-size').evaluate((e:HTMLInputElement)=>{e.value='32';e.dispatchEvent(new Event('input'));});await page.waitForTimeout(100);await page.waitForSelector(ready+'[data-ready=true]');
   expect(await page.locator('#demo-size-value').textContent()).toBe('32');await page.click('#blend-sampling');expect(await page.locator('#blend-sampling').textContent()).toBe('Within letter');
   await page.click('#edit-text');
   if(demo==='cursor'){
    await page.selectOption('#base-font',String(catalog.findIndex(f=>f.id==='papyrus')));await page.waitForSelector(ready+'[data-ready=true]');
    const w=await page.locator('#cursor-poem path').nth(0).boundingBox(),h=await page.locator('#cursor-poem path').nth(1).boundingBox();expect(h!.x-w!.x-w!.width).toBeLessThan(12);
    await page.selectOption('#cursor-font',String(catalog.findIndex(f=>f.id==='comic-sans-universal')));await page.waitForSelector(ready+'[data-ready=true]',{timeout:60000});
   }
   const box=await card.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+80);await page.waitForTimeout(150);await page.screenshot({path:'/tmp/fontzero-controls-'+demo+'.png'});
   expect(await page.locator(ready).getAttribute('data-error')).toBeNull();expect(errors).toEqual([]);
   await page.reload();await page.waitForSelector(ready+'[data-ready=true]',{timeout:60000});expect(await page.locator('#demo-text').inputValue()).toBe('What a lovely day.\nWhat a lovely day.');expect(await page.locator('#demo-size').inputValue()).toBe('32');expect(await page.locator('#blend-sampling').textContent()).toBe('Within letter');expect((await card.boundingBox())!.width).toBeCloseTo(before!.width+200,0);
   await page.close();
  }
 }finally{await browser.close();}
},120000);
