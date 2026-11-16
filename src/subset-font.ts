// Cut an open-licence font down to the characters Font Zero can set (Basic Latin, Latin-1, Latin Extended-A, and the
// common punctuation, currency and symbols), with harfbuzz's own subsetter (harfbuzzjs's harfbuzz-subset.wasm). Its
// outlines, metrics, layout features and variation axes stay as the font has them; only glyphs for other scripts go.
// The pinned font file in fonts/ is left unmodified; only the native build carries the subset.
import {join} from 'node:path';
import {create} from 'fontkit';
const ranges:[number,number][]=[[0x20,0x7e],[0xa0,0x17f],[0x2010,0x2027],[0x2030,0x203a],[0x20ac,0x20ac],[0x2122,0x2122]];
let exports:any;
export async function subsetFont(bytes:Uint8Array):Promise<Uint8Array>{
 if(!exports){const wasm=await Bun.file(join(import.meta.dir,'../node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm')).arrayBuffer();exports=(await WebAssembly.instantiate(wasm,{wasi_snapshot_preview1:{proc_exit(){},fd_close(){return 0;},fd_write(){return 0;},fd_seek(){return 0;}},env:{emscripten_notify_memory_growth(){}}})).instance.exports;}
 const at=exports.malloc(bytes.byteLength);new Uint8Array(exports.memory.buffer).set(bytes,at);
 const blob=exports.hb_blob_create(at,bytes.byteLength,2,0,0),face=exports.hb_face_create(blob,0);exports.hb_blob_destroy(blob);
 const input=exports.hb_subset_input_create_or_fail(),unicodes=exports.hb_subset_input_unicode_set(input);
 exports.hb_subset_input_set_flags(input,128); // keep glyph names (HB_SUBSET_FLAGS_GLYPH_NAMES)
 for(const [from,to]of ranges)for(let c=from;c<=to;c++)exports.hb_set_add(unicodes,c);
 const subset=exports.hb_subset_or_fail(face,input);exports.hb_subset_input_destroy(input);
 if(!subset)throw new Error('harfbuzz could not subset the font');
 const result=exports.hb_face_reference_blob(subset),data=exports.hb_blob_get_data(result,0),length=exports.hb_blob_get_length(result);
 const out=new Uint8Array(exports.memory.buffer,data,length).slice();
 exports.hb_blob_destroy(result);exports.hb_face_destroy(subset);exports.hb_face_destroy(face);exports.free(at);
 return readable(out)?out:bytes;
}
/**
 * Whether fontkit reads every kept character's outline and advance back, as the renderer will. Some subsets it cannot
 * (IBM Plex Mono's: its space, the font's last glyph, ends up past what fontkit reads safely); such a face is carried
 * whole, and the build says so.
 */
function readable(bytes:Uint8Array){
 const font:any=create(Buffer.from(bytes));
 for(const [from,to]of ranges)for(let c=from;c<=to;c++){const g=font.glyphForCodePoint(c);if(!g.id)continue;try{g.path.commands;g.advanceWidth;}catch(e){console.log(font.postscriptName+': its subset cannot be read at U+'+c.toString(16)+' ('+(e as Error).message+'); carried whole');return false;}}
 return true;
}
