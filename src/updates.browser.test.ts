import {routeClassicFonts} from './test-font-routes';
import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';
test('slider bursts draw the latest point once and leave hidden previews alone',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  const html=await build();await page.route('http://fontzero.test/',r=>r.fulfill({contentType:'text/html',body:html}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');
  await page.waitForSelector('#monaspace-field[data-ready=true]');
  const result=await page.evaluate(async()=>{
   const counts=[0,0,0];const observers=['outline-path','passage-view','code-view'].map((id,i)=>{const o=new MutationObserver(()=>counts[i]++);o.observe(document.getElementById(id)!,i===0?{attributes:true,attributeFilter:['d']}:{childList:true});return o;});
   const slider=document.getElementById('weight-5') as HTMLInputElement,start=performance.now();
   for(let i=0;i<100;i++){slider.value=String(i/2);slider.dispatchEvent(new Event('input'));}
   const inputTime=performance.now()-start;await new Promise(r=>setTimeout(r,250));observers.forEach(o=>o.disconnect());
   return {counts,inputTime,weights:JSON.parse(document.getElementById('monaspace-field')!.dataset.weights!)};
  });
  expect(result.counts).toEqual([1,0,0]);expect(result.weights[5]).toBe(.495);expect(result.inputTime).toBeLessThan(150);
  await page.click('[data-view="passage"]');await page.waitForSelector('#passage-view[data-ready=true]');
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);

test('Weight and Width render repeatedly while the mouse is still dragging in every preview',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const html=await build();await page.route('http://fontzero.test/',r=>r.fulfill({contentType:'text/html',body:html}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');
  await page.waitForSelector('#monaspace-field[data-ready=true]');await page.locator('#section-shape').evaluate((e:HTMLDetailsElement)=>e.open=true);
  for(const view of ['letters','passage','code']){
   await page.click('#view-tab-'+view);
   if(view!=='letters')await page.waitForSelector('#'+view+'-view[data-ready=true]');
   for(const [id,axis] of [['native-weight','wght'],['native-width','wdth']]){
    const box=(await page.locator('#'+id).boundingBox())!;
    await page.evaluate(({view,id})=>{
     const target=document.getElementById(view==='letters'?'outline-path':view+'-view')!;
     const monitor={changes:0,release:0,paths:new Set<string>(),observer:new MutationObserver(()=>{})};
     monitor.observer=new MutationObserver(()=>{monitor.changes++;monitor.paths.add(view==='letters'?target.getAttribute('d')!:target.innerHTML);});
     monitor.observer.observe(target,view==='letters'?{attributes:true,attributeFilter:['d']}:{childList:true,subtree:true,attributes:true,attributeFilter:['d']});
     document.getElementById(id)!.addEventListener('change',()=>monitor.release++,{once:true});
     (window as any).dragMonitor=monitor;
    },{view,id});
    await page.mouse.move(box.x+box.width*.15,box.y+box.height/2);await page.mouse.down();
    for(let i=1;i<=40;i++){
     await page.mouse.move(box.x+box.width*(.15+.7*i/40),box.y+box.height/2);
     await page.waitForTimeout(16);
    }
    const during=await page.evaluate(()=>{const m=(window as any).dragMonitor;return {changes:m.changes,distinct:m.paths.size,releases:m.release};});
    expect(during.releases).toBe(0);expect(during.changes).toBeGreaterThan(3);expect(during.distinct).toBeGreaterThan(3);
    await page.mouse.up();
    const preview=view==='letters'?'outline-view':view+'-view';
    await page.waitForFunction(({preview,id,axis})=>JSON.parse(document.getElementById(preview)!.dataset.axes||'{}')[axis]===Number((document.getElementById(id) as HTMLInputElement).value),{preview,id,axis});
    await page.evaluate(()=>(window as any).dragMonitor.observer.disconnect());
   }
  }
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);

test('headline glyphs retain construction while their style changes through the full blend',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),html=await build();await page.route('http://fontzero.test/',r=>r.fulfill({contentType:'text/html',body:html}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  for(const [character,pole] of [['a',7],['g',5]] as const){
   const previous=await page.locator('#monaspace-field').getAttribute('data-build');
   await page.locator('#sample-text').fill(character+' '+character);
   await page.waitForFunction(previous=>document.getElementById('monaspace-field')!.dataset.build!==previous,previous);
   await page.locator('#section-blend').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.click('#anchor-'+pole);
   await page.waitForFunction(pole=>JSON.parse(document.getElementById('monaspace-field')!.dataset.renderedWeights!)[pole]===1,pole);
   const original=await page.locator('#outline-path').getAttribute('d');
   await page.click('#anchor-'+(pole===7?5:7));
   await page.evaluate(pole=>{const input=document.getElementById('weight-'+pole) as HTMLInputElement;input.value='60';input.dispatchEvent(new Event('input'));},pole);
   await page.waitForFunction(pole=>Math.abs(JSON.parse(document.getElementById('monaspace-field')!.dataset.renderedWeights!)[pole]-.6)<1e-6,pole);
   const at60=await page.locator('#outline-path').getAttribute('d');expect(at60).not.toBe(original);
   await page.evaluate(pole=>{const input=document.getElementById('weight-'+pole) as HTMLInputElement;input.value='80';input.dispatchEvent(new Event('input'));},pole);
   await page.waitForFunction(pole=>Math.abs(JSON.parse(document.getElementById('monaspace-field')!.dataset.renderedWeights!)[pole]-.8)<1e-6,pole);
   expect(await page.locator('#outline-path').getAttribute('d')).not.toBe(at60);
  }
 }finally{await browser.close();}
},30000);

test('two-font weight dragging yields between glyphs instead of blocking whole frames',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.route('http://fontzero.test/',async r=>r.fulfill({body:await build(),contentType:'text/html'}));await routeClassicFonts(page);
  await page.goto('http://fontzero.test/');await page.waitForSelector('#monaspace-field[data-ready=true]');
  const result=await page.evaluate(async()=>{
   const slider=document.getElementById('native-weight') as HTMLInputElement,root=document.getElementById('monaspace-field')!,start=Number(root.dataset.build),frames:number[]=[];let last=performance.now();
   for(let i=0;i<35;i++){slider.value=String(250+i*15);slider.dispatchEvent(new Event('input'));await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;}
   return {max:Math.max(...frames),painted:Number(root.dataset.build)-start};
  });
  expect(result.max).toBeLessThan(180);expect(result.painted).toBeGreaterThan(2);
  await page.waitForFunction(()=>JSON.parse(document.getElementById('outline-view')!.dataset.axes!).wght===760&&document.getElementById('monaspace-field')!.dataset.busy==='false');
  expect(await page.locator('#monaspace-field').getAttribute('data-error')).toBeNull();
 }finally{await browser.close();}
},30000);
