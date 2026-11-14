import {catalog} from './catalog';
import {fontDownloadResponse} from './font-download-response';
export async function routeClassicFonts(page:any){
 await page.route('http://type-space.test/downloads/*',async(r:any)=>{
  const request=r.request(),response=await fontDownloadResponse(new Request(request.url(),{method:request.method(),headers:request.headers(),body:request.postDataBuffer()}));
  await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.route('http://type-space.test/fonts/*',async(r:any)=>{
  const entry=catalog.find(e=>r.request().url().endsWith('/'+e.id))!;
  await r.fulfill({body:Buffer.from(await Bun.file(entry.asset?import.meta.dir+'/font-assets/'+entry.asset:'/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()),contentType:'font/ttf'});
 });
}
