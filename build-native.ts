// Build Font Zero's canvas engine into a sys0 app directory:
//  engine/            the vendored Rust crate (source, Cargo files, glyphs.bin, determinism test)
//  views/engine.ts    native-engine.ts + wasm-bindgen glue; the wasm in views/engine-wasm-*.ts (base64)
//  src/fonts.ts       the compatibility catalog the app's actions use
//  licenses/          notices for every font whose outlines glyphs.bin carries
// bun build-native.ts <sys0 apps/font-zero directory>
import {join,resolve,relative} from 'node:path';
import {mkdtempSync,readdirSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {catalog} from './catalog';
import {formOptions} from './compatibility';
import {looks} from './looks';
import {passage} from './attractor-text';
import {fontIds,cohortIds} from './build-glyphs';
const target=resolve(process.argv[2]??'native-dist');
const crate=join(import.meta.dir,'engine');
const ids=cohortIds;
const entries=ids.map(id=>catalog.find(f=>f.id===id)!);
const missing=ids.filter(id=>!fontIds.includes(id));
if(missing.length)throw Error('glyphs.bin does not carry '+missing.join(', ')+': add them to build-glyphs.ts fontIds and rebuild it.');
// Which fonts blend depends on the characters drawn, so each font carries, for every printable ASCII character (! to
// ~), the constructions it can draw it with, each named by a number shared across fonts: two fonts blend a text when,
// for each of its characters, they share one. An effect (Redacted) blends with anything and carries none.
const keyNumbers=new Map<string,number>(),number=(key:string)=>{let n=keyNumbers.get(key);if(n===undefined)keyNumbers.set(key,n=keyNumbers.size);return n;};
const metadata=entries.map(f=>({id:f.id,name:f.name,effect:!!f.effect,forms:f.effect?[]:formOptions(catalog.indexOf(f)).map((keys,i)=>keys.map(k=>number(String.fromCharCode(i+33)+k)))}));

const run=async(cmd:string[],cwd:string,env:Record<string,string>={})=>{
 const p=Bun.spawn(cmd,{cwd,env:{...process.env,...env},stdout:'inherit',stderr:'inherit'});
 if(await p.exited)throw Error(cmd.join(' ')+' failed');
};
const home=process.env.HOME!,cargo=join(home,'.cargo/bin/cargo'),bindgen=join(home,'.cargo/bin/wasm-bindgen');
// Path-independent wasm: the same source builds the same bytes in any checkout.
await run([cargo,'build','--release','--locked','--target','wasm32-unknown-unknown','--features','wasm'],crate,{RUSTFLAGS:`--remap-path-prefix=${crate}=font-zero-engine --remap-path-prefix=${join(home,'.cargo')}=cargo --remap-path-prefix=${join(home,'.rustup')}=rustup`});
const scratch=mkdtempSync(join(tmpdir(),'font-zero-wasm-'));
try{
 await run([bindgen,'--target','web','--out-dir',scratch,join(crate,'target/wasm32-unknown-unknown/release/font_zero_engine.wasm')],crate);
 const wasm=await Bun.file(join(scratch,'font_zero_engine_bg.wasm')).bytes();
 const glue=(await Bun.file(join(scratch,'font_zero_engine.js')).text()).replace(/module_or_path = new URL\('font_zero_engine_bg\.wasm', import\.meta\.url\);/,"throw new Error('Font Zero engine bytes are embedded; pass them to init.');");
 if(glue.includes('import.meta'))throw Error('wasm-bindgen glue still reads import.meta');
 // The wasm, base64, in bounded source modules.
 const encoded=Buffer.from(wasm).toString('base64'),limit=3000000,chunks:string[]=[];
 for(let i=0;i<encoded.length;i+=limit)chunks.push(encoded.slice(i,i+limit));
 for(const name of readdirSync(join(target,'views')))if(/^(font-data(-\d+)?|engine-wasm(-\d+)?)\.ts$/.test(name))rmSync(join(target,'views',name));
 for(const [i,chunk]of chunks.entries())await Bun.write(join(target,'views/engine-wasm-'+i+'.ts'),'// Generated from sys0-ai/font-zero by build-native.ts: the engine wasm, base64, part '+(i+1)+' of '+chunks.length+'.\nexport default '+JSON.stringify(chunk)+';\n');
 await Bun.write(join(target,'views/engine-wasm.ts'),chunks.map((_,i)=>`import p${i} from './engine-wasm-${i}.ts';`).join('\n')+'\nexport default '+chunks.map((_,i)=>'p'+i).join('+')+';\n');
 const build=await Bun.build({entrypoints:[join(import.meta.dir,'native-engine.ts')],target:'browser',format:'esm',minify:true,plugins:[{name:'font-zero-engine',setup(b){
  b.onResolve({filter:/^font-zero-engine-bytes$/},()=>({path:'./engine-wasm.ts',external:true}));
  b.onResolve({filter:/^font-zero-engine-wasm$/},()=>({path:'font-zero-engine-wasm',namespace:'fontzero'}));
  b.onLoad({filter:/.*/,namespace:'fontzero'},()=>({contents:glue,loader:'js'}));
 }}]});
 if(!build.success)throw Error(build.logs.join('\n'));
 await Bun.write(join(target,'views/engine.ts'),'// @ts-nocheck\n// Generated from sys0-ai/font-zero by build-native.ts: native-engine.ts over the font-zero-engine wasm.\n'+await build.outputs[0].text());
}finally{rmSync(scratch,{recursive:true,force:true});}

// Vendor the crate: what builds it, what it embeds, and its determinism test.
const vendor=join(target,'engine');
rmSync(vendor,{recursive:true,force:true});
const files=['Cargo.toml','Cargo.lock','.gitignore','glyphs.bin','tests/frames.rs','tests/golden.json','tests/fixtures/settings.json','wasm/harness.mjs',...readdirSync(join(crate,'src')).map(f=>'src/'+f)];
for(const f of files){if(!statSync(join(crate,f)).isFile())continue;await Bun.write(join(vendor,f),Bun.file(join(crate,f)));}

await Bun.write(join(target,'src/fonts.ts'),'export const fonts: {id:string;name:string;effect:boolean;forms:number[][]}[] = '+JSON.stringify(metadata)+';\nexport const looks='+JSON.stringify(looks.map(l=>({id:l.id,name:l.name,era:l.era})))+';\nexport const starterFonts='+JSON.stringify(['times-new-roman','gf-opensans','comic-sans-universal','papyrus-alternates'])+';\nexport const passage='+JSON.stringify(passage)+';\n');
await Bun.write(join(target,'licenses/monaspace.txt'),await Bun.file(join(import.meta.dir,'OFL.txt')).text());
await Bun.write(join(target,'licenses/distribution.json'),await Bun.file(join(import.meta.dir,'font-assets/licensed/distribution.json')).text());
rmSync(join(target,'licenses/paper.txt'),{force:true});
for(const id of fontIds){const f=catalog.find(f=>f.id===id)!;if(f.licenseAsset)await Bun.write(join(target,'licenses/'+f.id+'.txt'),await Bun.file(join(import.meta.dir,'font-assets',f.licenseAsset)).text());}
console.log('Font Zero engine (wasm '+(await Bun.file(join(crate,'target/wasm32-unknown-unknown/release/font_zero_engine.wasm')).size)+' bytes) and '+entries.length+' fonts -> '+relative(process.cwd(),target)||'.');
