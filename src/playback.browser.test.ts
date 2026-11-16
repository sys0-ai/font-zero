import {routeClassicFonts} from './test-font-routes';
import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {build} from './build';

test('time playback, scrubbing, preview switching and compact layout',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:640}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const html=await build();await page.route('http://fontzero.test/',route=>route.fulfill({contentType:'text/html',body:html}));await routeClassicFonts(page);await page.goto('http://fontzero.test/');
  await page.waitForSelector('#monaspace-field[data-ready="true"]',{state:'attached'});await page.locator('#section-time').evaluate((e:HTMLDetailsElement)=>e.open=true);
  const root=page.locator('#monaspace-field');
  await page.locator('#time-play').evaluate((b:HTMLButtonElement)=>b.click());
  await page.waitForFunction(()=>Number(document.getElementById('monaspace-field')!.dataset.timePosition)>.05);
  await page.locator('#time-play').evaluate((b:HTMLButtonElement)=>b.click());
  await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.playing==='false');
  await page.waitForTimeout(150);const frozen=await page.locator('#outline-path').getAttribute('d');await page.waitForTimeout(200);
  expect(await page.locator('#outline-path').getAttribute('d')).toBe(frozen);
  await page.locator('#time-position').evaluate((s:HTMLInputElement)=>{s.value='50';s.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.weights===JSON.stringify(Array.from({length:109},(_,i)=>i===0||i===2?.5:0)));
  await page.click('[data-view="passage"]');await page.waitForSelector('#passage-view[data-ready=true]');
  const passage=await page.locator('#passage-view').innerHTML();
  await page.click('#time-reset');await page.waitForFunction(()=>document.getElementById('monaspace-field')!.dataset.weights===JSON.stringify(Array.from({length:109},(_,i)=>i===0?1:0)));
  await page.waitForTimeout(250);expect(await page.locator('#passage-view').innerHTML()).not.toBe(passage);
  await page.click('[data-view="letters"]');await page.fill('#time-duration','0.2');await page.locator('#time-duration').dispatchEvent('change');await page.click('#time-play');
  await page.waitForFunction(()=>document.getElementById('time-state')!.textContent==='Complete');expect(await root.getAttribute('data-weights')).toBe(JSON.stringify(Array.from({length:109},(_,i)=>i===2?1:0)));
  for(const mode of ['duration','clock']){
   await page.selectOption('#time-mode',mode);
   const fit=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,bottom:document.getElementById('control-time')!.getBoundingClientRect().bottom}));
   expect(fit.width).toBe(1024);expect(fit.height).toBe(640);
  }
  await page.fill('#time-start','09:00');await page.fill('#time-end','09:00');await page.click('#time-play');
  expect(await page.locator('#time-state').textContent()).toContain('different start and end');expect(await root.getAttribute('data-playing')).toBe('false');
  await page.fill('#time-end','17:00');await page.click('#time-play');expect(await root.getAttribute('data-playing')).toBe('true');
  await page.click('#time-exit');expect(await root.getAttribute('data-time-preview')).toBe('false');expect(await root.getAttribute('data-playing')).toBe('false');
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},60000);
