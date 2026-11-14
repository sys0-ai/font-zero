import {mkdir,copyFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {build} from './build';
import {catalog} from './catalog';
const root=join(import.meta.dir,'public-dist'),out=join(root,'font-zero');
await rm(root,{recursive:true,force:true});
await mkdir(join(out,'fonts'),{recursive:true});
await mkdir(join(out,'licenses'),{recursive:true});
await mkdir(join(out,'editor'),{recursive:true});
await Bun.write(join(out,'index.html'),await build(false,'attractors','/font-zero/'));
await Bun.write(join(out,'editor/index.html'),await build(false,'editor','/font-zero/'));
const worker=await Bun.build({entrypoints:[join(import.meta.dir,'semantic-worker.ts')],target:'browser',format:'esm',minify:true});
if(!worker.success)throw new Error(worker.logs.map(String).join('\n'));
await Bun.write(join(out,'semantic-worker.js'),await worker.outputs[0].text());
for(const font of catalog.filter(f=>f.asset)){
 await copyFile(join(import.meta.dir,'font-assets',font.asset!),join(out,'fonts',font.id));
 if(font.licenseAsset)await copyFile(join(import.meta.dir,'font-assets',font.licenseAsset),join(out,'licenses',font.id+'.txt'));
}
await copyFile(join(import.meta.dir,'OFL.txt'),join(out,'licenses/monaspace.txt'));
console.log('Built public-dist/font-zero/ with bundled open fonts only.');
const {buildSys0}=await import('./build-sys0');
await buildSys0(join(out,'sys0'));
