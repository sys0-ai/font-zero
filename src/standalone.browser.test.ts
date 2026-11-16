import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
import {catalog} from './catalog';
test('public standalone build runs under /fontzero without installed fonts',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[],requests:string[]=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('http://fontzero.test/**',async route=>{
   const request=route.request(),url=new URL(request.url());requests.push(url.pathname);
   if(url.pathname==='/fontzero/')return route.fulfill({body:await build(false),contentType:'text/html'});
   if(url.pathname.startsWith('/fontzero/fonts/')){
    const font=catalog.find(f=>url.pathname==='/fontzero/fonts/'+f.id)!;
    expect(font.file).toBeUndefined();expect(font.asset).toBeDefined();
    return route.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/../fonts/'+font.asset).arrayBuffer()),contentType:'font/ttf'});
   }
   return route.fulfill({status:404,body:'Unexpected URL'});
  });
  await page.goto('http://fontzero.test/fontzero/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  expect(await page.title()).toContain('Font Zero');expect(await page.locator('#shape-description').textContent()).toContain('Crimson Pro');
  await page.click('#control-toggle-blend');await page.click('#font-library-toggle');await page.fill('#font-search','Papyrus');
  expect(await page.locator('#font-results button').count()).toBe(0);
  const download=page.waitForEvent('download');await page.click('#download-font');expect((await download).suggestedFilename()).toEndWith('.otf');
  expect(requests.every(p=>p.startsWith('/fontzero/'))).toBe(true);expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
