import {test,expect} from 'bun:test';import {chromium} from 'playwright';
import {create} from 'fontkit';import {build} from './build';import {catalog} from './catalog';import {makeTypeface} from './font-library';import {sourcePath} from './curves';import {boots} from './four-corners-text';
test('four-corner poem uses natural advances and a container-wide field, scrolls, and restores choices',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://fontzero.test/fontzero/demos/four-corners/',async r=>r.fulfill({body:await build(false,'four-corners'),contentType:'text/html'}));
  await page.route('http://fontzero.test/fontzero/fonts/*',async r=>{const f=catalog.find(f=>r.request().url().endsWith('/'+f.id))!;await r.fulfill({body:Buffer.from(await Bun.file(import.meta.dir+'/font-assets/'+f.asset).arrayBuffer()),contentType:'font/ttf'});});
  await page.goto('http://fontzero.test/fontzero/demos/four-corners/');await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});
  expect(await page.locator('#demo-text').inputValue()).toBe(boots);
  const endpoint=async(row:number,last:boolean,corner:number)=>{
   const paths=page.locator(`[data-row="${row}"] path`),path=last?paths.last():paths.first(),index=Number(await page.locator('#corner-'+corner).inputValue()),entry=catalog[index];
   const bytes=new Uint8Array(await Bun.file(import.meta.dir+'/font-assets/'+entry.asset).arrayBuffer()),font=makeTypeface(create(bytes),bytes,entry).getVariation({wght:450,wdth:100,slnt:0}),character=await path.getAttribute('data-character');
   expect(await path.getAttribute('d')).toBe(sourcePath(font.glyphForCodePoint(character!.codePointAt(0)!).path.commands,0,0,100/font.unitsPerEm));
   expect(JSON.parse((await path.getAttribute('data-weights'))!).filter((v:number)=>v===1).length).toBe(1);
  };
  await endpoint(0,false,0);
  const layout=await page.locator('[data-row="0"] path').evaluateAll(paths=>paths.map(p=>({column:Number((p as SVGPathElement).dataset.column),x:Number((p as SVGPathElement).dataset.x),advance:Number((p as SVGPathElement).dataset.advance),uv:JSON.parse((p as SVGPathElement).dataset.uv!)})));
  const width=Number(await page.locator('#poem-canvas').getAttribute('data-field-width'));
  for(let i=0;i<layout.length;i++){
   expect(layout[i].uv[0]).toBeCloseTo((layout[i].x-48)/width,8);
   if(i&&layout[i].column===layout[i-1].column+1)expect(layout[i].x-layout[i-1].x).toBeCloseTo(layout[i-1].advance,5);
  }
  // Short lines keep their natural length; they are not stretched to the right pole.
  expect(Number(await page.locator('[data-row="3"] path').last().getAttribute('data-x'))).toBeLessThan(layout.at(-1)!.x);
  const scroll=await page.locator('#poem-viewport').evaluate(e=>({height:e.scrollHeight,viewport:e.clientHeight}));expect(scroll.height).toBeGreaterThan(scroll.viewport*3);
  await page.locator('#poem-viewport').evaluate(e=>e.scrollTop=e.scrollHeight);const last=boots.split('\n').length-1;await page.waitForSelector(`[data-row="${last}"] path`,{timeout:60000});
  await endpoint(last,false,2);expect(await page.locator('#poem-canvas svg').count()).toBeLessThan(12);
  await page.screenshot({path:'/tmp/fontzero-four-corners.png'});
  const replacement=await page.locator('#corner-1').inputValue();await page.selectOption('#corner-0',replacement);await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});
  await page.reload();await page.waitForSelector('#poem-canvas[data-ready=true]',{timeout:60000});expect(await page.locator('#corner-0').inputValue()).toBe(replacement);expect(errors).toEqual([]);
 }finally{await browser.close();}
},120000);
