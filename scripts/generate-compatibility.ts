import {create} from 'fontkit';
import data from '../src/fonts.json';
import {catalog} from '../src/catalog';
import {sourcePath} from '../src/curves';
import {unifiedContours} from '../src/outline-union';
import {constructions} from '../src/construction';
const result:Record<string,string[]>={};
for(const [i,entry] of catalog.entries()){
 if(entry.variant)continue;
 const bytes=entry.asset?new Uint8Array(await Bun.file(import.meta.dir+'/../fonts/'+entry.asset).arrayBuffer()):entry.file?new Uint8Array(await Bun.file('/System/Library/Fonts/Supplemental/'+entry.file).arrayBuffer()):Uint8Array.from(atob(data[i].data),c=>c.charCodeAt(0));
 const collection:any=create(bytes),raw=collection.fonts?collection.fonts[entry.face??0]:collection;
 const f=Object.keys(raw.variationAxes).length?raw.getVariation(Object.fromEntries(Object.entries(raw.variationAxes).map(([tag,a]:[string,any])=>[tag,Math.max(a.min,Math.min(a.max,tag==='wght'?entry.axes?.wght??450:tag==='wdth'?100:tag==='slnt'?0:a.default))]))):raw;
 result[entry.id]=Array.from({length:94},(_,i)=>{const c=String.fromCharCode(33+i);return constructions(c,[unifiedContours(sourcePath(f.glyphForCodePoint(33+i).path.commands,0,0,100/f.unitsPerEm))],[entry])[0].key;});
}
await Bun.write(import.meta.dir+'/../src/construction-signatures.json',JSON.stringify(result));
process.exit(0);
