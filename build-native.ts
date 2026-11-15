import {join,resolve} from 'node:path';
import {catalog,monaspaceIds} from './catalog';
import {formOptions} from './compatibility';
import {looks} from './looks';
import {subsetFont} from './subset-font';
// The view loads under sys0's 16 MiB script limit, fonts and all, so the open-licence faces go in subset (subset-font.ts).
import data from './fonts.json';
import {passage} from './attractor-text';
const target=resolve(process.argv[2]??'native-dist');
// The classic faces and the open faces that started the app, then Wordmark's.
const classics=['times-new-roman','georgia','gf-opensans','gf-domine','gf-notoserif','papyrus-alternates','comic-sans-universal','arial-alternates','times-universal'];
// Every face sys0's Wordmark app cuts its zero from, so a text can be set in any of them.
const wordmark=['gf-inter','gf-inter-thin','gf-inter-black','gf-manrope','gf-outfit','gf-spacegrotesk','gf-unbounded','gf-kronaone','gf-michroma','gf-orbitron','gf-audiowide','gf-righteous','gf-bebasneue','gf-bigshoulders','gf-archivoblack','gf-rubikmonoone','gf-cormorantgaramond','gf-playfairdisplay','gf-bodonimoda','gf-dmserifdisplay','gf-fraunces','gf-instrumentserif','gf-poiretone','gf-ibmplexmono','gf-jetbrainsmono','gf-spacemono','gf-majormonodisplay','gf-pressstart2p','gf-silkscreen','gf-monoton'];
const ids=[...new Set([...classics,...wordmark,...monaspaceIds,'redacted'])];
const entries=ids.map(id=>catalog.find(f=>f.id===id)!);
// Which fonts blend depends on the characters drawn, so each font carries, for every printable ASCII character (! to
// ~), the constructions it can draw it with, each named by a number shared across fonts: two fonts blend a text when,
// for each of its characters, they share one. An effect (Redacted) blends with anything and carries none.
const keyNumbers=new Map<string,number>(),number=(key:string)=>{let n=keyNumbers.get(key);if(n===undefined)keyNumbers.set(key,n=keyNumbers.size);return n;};
const metadata=entries.map(f=>({id:f.id,name:f.name,effect:!!f.effect,forms:f.effect?[]:formOptions(catalog.indexOf(f)).map((keys,i)=>keys.map(k=>number(String.fromCharCode(i+33)+k)))}));
const embedded:Record<string,string>={},keys:Record<string,string>={};
for(const id of [...ids,'gf-librebaskerville']){const f=catalog.find(f=>f.id===id)!;const key=f.asset??id;keys[id]=key;if(!embedded[key]){const open=f.licenseAsset&&!f.effect;embedded[key]=f.asset?Buffer.from(await (open?subsetFont:(b:Uint8Array)=>b)(await Bun.file(join(import.meta.dir,'font-assets',f.asset)).bytes())).toString('base64'):(data as any)[catalog.indexOf(f)].data;}}
const library=await Bun.file(join(import.meta.dir,'font-library.ts')).text();
const start=library.indexOf(' let bytes:Uint8Array;'),end=library.indexOf(" const {create}=",start);
const chunks:Record<string,string>[]=[{}];let chunkBytes=0;
for(const [key,value]of Object.entries(embedded)){if(chunkBytes+value.length>3000000&&chunkBytes){chunks.push({});chunkBytes=0;}chunks[chunks.length-1][key]=value;chunkBytes+=value.length;}
for(const [i,chunk]of chunks.entries())await Bun.write(join(target,'views/font-data-'+i+'.ts'),'export default '+JSON.stringify(chunk)+';\n');
await Bun.write(join(target,'views/font-data.ts'),chunks.map((_,i)=>`import p${i} from './font-data-${i}.ts';`).join('\n')+'\nexport default Object.assign({},'+chunks.map((_,i)=>'p'+i).join(',')+');\n');
const fonts="import embedded from 'native-font-data';const byteKeys="+JSON.stringify(keys)+";\n"+library.slice(0,start)+" const bytes=Uint8Array.from(atob(embedded[byteKeys[id]]),c=>c.charCodeAt(0));\n"+library.slice(end);
const build=await Bun.build({entrypoints:[join(import.meta.dir,'native-entry.ts')],target:'browser',format:'esm',minify:true,plugins:[{name:'native-fonts',setup(b){
 b.onResolve({filter:/^native-font-data$/},()=>({path:'./font-data.ts',external:true}));
 b.onResolve({filter:/^paper$/},()=>({path:join(import.meta.dir,'node_modules/paper/dist/paper-core.js')}));
 b.onResolve({filter:/native-typefaces$/},()=>({path:'native-typefaces',namespace:'fontzero'}));
 b.onLoad({filter:/harfbuzzjs\/dist\/index\.mjs$/},async args=>{const bytes=await Bun.file(join(import.meta.dir,'node_modules/harfbuzzjs/dist/harfbuzz.wasm')).bytes();return {contents:(await Bun.file(args.path).text()).replace('createHarfBuzz()','createHarfBuzz({wasmBinary:Uint8Array.from(atob('+JSON.stringify(Buffer.from(bytes).toString('base64'))+'),c=>c.charCodeAt(0))})'),loader:'js'};});
 b.onLoad({filter:/harfbuzzjs\/dist\/harfbuzz\.js$/},async args=>({contents:(await Bun.file(args.path).text()).replace(/var ENVIRONMENT_IS_NODE=.*?;/,'var ENVIRONMENT_IS_NODE=false;').replace('await import("module")','{}'),loader:'js'}));
 b.onLoad({filter:/.*/,namespace:'fontzero'},()=>({contents:fonts,loader:'ts',resolveDir:import.meta.dir}));
}}]});
if(!build.success)throw Error(build.logs.join('\n'));
await Bun.write(join(target,'views/engine.ts'),'// @ts-nocheck\n// Generated from sys0-ai/font-zero by build-native.ts.\n'+(await build.outputs[0].text()).replace(/(["'])native-font-data\1/g,'"./font-data.ts"').replace(/\btypeof require\b/g,'"undefined"').replace(/\brequire\b/g,'fontZeroUnavailableRequire'));
await Bun.write(join(target,'src/fonts.ts'),'export const fonts: {id:string;name:string;effect:boolean;forms:number[][]}[] = '+JSON.stringify(metadata)+';\nexport const looks='+JSON.stringify(looks.map(l=>({id:l.id,name:l.name,era:l.era})))+';\nexport const starterFonts='+JSON.stringify(['times-new-roman','gf-opensans','comic-sans-universal','papyrus-alternates'])+';\nexport const passage='+JSON.stringify(passage)+';\n');
await Bun.write(join(target,'licenses/monaspace.txt'),await Bun.file(join(import.meta.dir,'OFL.txt')).text());
await Bun.write(join(target,'licenses/distribution.json'),await Bun.file(join(import.meta.dir,'font-assets/licensed/distribution.json')).text());
await Bun.write(join(target,'licenses/paper.txt'),await Bun.file(join(import.meta.dir,'node_modules/paper/LICENSE.txt')).text());
for(const f of entries)if(f.licenseAsset)await Bun.write(join(target,'licenses/'+f.id+'.txt'),await Bun.file(join(import.meta.dir,'font-assets',f.licenseAsset)).text());
console.log('Native renderer and '+entries.length+' fonts -> '+target);
