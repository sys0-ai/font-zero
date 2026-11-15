// Render the golden frames (tests/frames.rs) through the wasm32 build and
// check their SHA-256 against tests/golden.json.
// node wasm/harness.mjs <dir with wasm-bindgen --target nodejs output>
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const pkg=require(join(resolve(process.argv[2]),'font_zero_engine.js'));
const here=new URL('..',import.meta.url).pathname;
const settings=JSON.parse(readFileSync(join(here,'tests/fixtures/settings.json'),'utf8'));
const golden=JSON.parse(readFileSync(join(here,'tests/golden.json'),'utf8'));
const pack=c=>((c[0]<<24)|(c[1]<<16)|(c[2]<<8)|c[3])>>>0;
const INK=pack([0x1b,0x1b,0x1f,0xff]),HIGHLIGHT=pack([0x2f,0x6f,0xeb,0xff]);
const clone=v=>JSON.parse(JSON.stringify(v));
const colors={'pole-1':'#d13415','pole-2':'#0d74ce','pole-3':'#2a7e3b','pole-4':'#cc4e00'};
const props=(settings,design,selected,look)=>({settings,design,selected,look,colors});
const letter=clone(settings);letter.within=false;
const redacted=clone(settings);redacted.attractors[3].font='redacted';
const near=clone(settings);near.attractors[0].radius=240;
const frames=[
 ['passage',props(settings,false,'pole-4','theme'),580,580,2,true],
 ['passage-28px',props(settings,false,'pole-4','theme'),580,580,1,false],
 ['passage-letter',props(letter,false,'pole-1','theme'),580,580,2,true],
 ['passage-redacted',props(redacted,false,'pole-4','theme'),580,580,2,true],
 ['passage-reach',props(near,false,'pole-1','theme'),580,580,2,true],
 ['design-A',props(settings,true,'pole-4','theme'),580,580,2,true],
 ['passage-aqua',props(settings,false,'pole-4','aqua'),580,580,2,true],
 ['passage-jaguar',props(settings,false,'pole-4','jaguar'),580,580,1,false],
 ['design-A-tiger',props(settings,true,'pole-4','tiger'),580,580,2,true],
 ['design-A-rainbow',props(settings,true,'pole-4','rainbow'),580,580,1,true],
];
let failed=0;
for(const [name,props,w,h,scale,fit]of frames){
 const e=new pkg.FontZeroEngine();e.set_viewport(w,h,scale);e.update(JSON.stringify(props));
 let size=props.settings.size;
 if(fit){size=e.fit();const p=clone(props);p.settings.size=size;e.update(JSON.stringify(p));}
 let start=performance.now();const rgba=e.render(INK,HIGHLIGHT);const first=performance.now()-start;
 start=performance.now();e.render(INK,HIGHLIGHT);const again=performance.now()-start;
 const hash=createHash('sha256').update(rgba).digest('hex'),ok=hash===golden[name];if(!ok)failed++;
 console.log(`${ok?'ok  ':'FAIL'} ${name} ${e.width()}x${e.height()} size ${size} ${hash} render ${first.toFixed(1)} ms, again ${again.toFixed(1)} ms`);
 e.free();
}
if(failed){console.error(failed+' wasm32 frame(s) differ from the native golden hashes');process.exit(1);}
console.log('wasm32 frames match the native golden hashes');
