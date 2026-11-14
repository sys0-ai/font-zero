import {catalog} from './catalog';
export async function routeClassicFonts(page:any){
 await page.route('http://type-space.test/fonts/*',async(r:any)=>{
  const entry=catalog.find(e=>r.request().url().endsWith('/'+e.id))!;
  await r.fulfill({body:Buffer.from(await Bun.file(entry.asset?import.meta.dir+'/font-assets/'+entry.asset:'/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()),contentType:'font/ttf'});
 });
}
