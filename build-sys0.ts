import {zipSync,type Zippable} from 'fflate';
import {join} from 'node:path';
import {build} from './build';
import {catalog} from './catalog';

/** A relocatable, pinned site archive for sys0's isolated app window. */
export async function buildSys0(output:string){
 const options={mtime:new Date('2020-01-01T00:00:00'),level:6 as const};
 const files:Zippable={};
 const add=(name:string,bytes:Uint8Array)=>{files['font-zero/'+name]=[bytes,options];};
 const html=(await build(false,'attractors','./')).replace('<base href="./">','');
 add('index.html',new TextEncoder().encode(html));
 for(const font of catalog.filter(f=>f.asset)){
  add('fonts/'+font.id,await Bun.file(join(import.meta.dir,'font-assets',font.asset!)).bytes());
  if(font.licenseAsset)add('licenses/'+font.id+'.txt',await Bun.file(join(import.meta.dir,'font-assets',font.licenseAsset)).bytes());
 }
 add('licenses/monaspace.txt',await Bun.file(join(import.meta.dir,'OFL.txt')).bytes());
 const bytes=zipSync(files,options),sha256=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
 await Bun.write(join(output,sha256+'.zip'),bytes);
 await Bun.write(join(output,'manifest.json'),JSON.stringify({sha256,url:'https://sys0.ai/font-zero/sys0/'+sha256+'.zip'},null,2)+'\n');
 console.log('sys0 archive: '+sha256);
 return {sha256,bytes};
}
