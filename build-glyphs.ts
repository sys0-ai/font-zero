// Precompute the glyph geometry the Rust engine (engine/) embeds: for every
// font in the sys0 cohort and every character of a fixed charset, the advance
// and the unified contours (cubics on the 100-unit em, as prepareGlyph scales
// them) of each construction form the font can take, plus the per-font
// construction metadata compatibility.ts needs. Same bytes on every run.
import {join} from 'node:path';
import {create} from 'fontkit';
import {catalog,monaspaceIds} from './catalog';
import {makeTypeface} from './font-library';
import {variantBase} from './compatibility';
import {sourcePath} from './curves';
import {unifiedContours} from './outline-union';
import {timesAlternateKeys} from './times-forms';
import {arialAlternateKeys} from './arial-forms';
import {papyrusAlternateKeys} from './papyrus-forms';
import {comicAlternateKeys} from './comic-forms';
import signatures from './construction-signatures.json';
import data from './fonts.json';

export const VERSION=2;
// The sys0 cohort (apps/font-zero/src/fonts.ts), the reference font for
// advances and marker numerals, and the redacted-only fallback base font.
// The classic faces and the open faces that started the app, then every face sys0's Wordmark app cuts its zero from.
const classics=['times-new-roman','georgia','gf-opensans','gf-domine','gf-notoserif','papyrus-alternates','comic-sans-universal','arial-alternates','times-universal'];
const wordmark=['gf-inter','gf-inter-thin','gf-inter-black','gf-manrope','gf-outfit','gf-spacegrotesk','gf-unbounded','gf-kronaone','gf-michroma','gf-orbitron','gf-audiowide','gf-righteous','gf-bebasneue','gf-bigshoulders','gf-archivoblack','gf-rubikmonoone','gf-cormorantgaramond','gf-playfairdisplay','gf-bodonimoda','gf-dmserifdisplay','gf-fraunces','gf-instrumentserif','gf-poiretone','gf-ibmplexmono','gf-jetbrainsmono','gf-spacemono','gf-majormonodisplay','gf-pressstart2p','gf-silkscreen','gf-monoton'];
/** The faces the sys0 app offers (src/fonts.ts). */
export const cohortIds=[...new Set([...classics,...wordmark,...monaspaceIds,'redacted'])];
/** Plus the reference font (advances, marker numerals) and the base an all-Redacted text measures with. */
export const fontIds=[...cohortIds,'gf-librebaskerville','gf-roboto'];
// Reference-only fonts keep advances for every character but outlines only for digits.
const outlineOnlyDigits=new Set(['gf-librebaskerville']);
export function charset(){
 const codes:number[]=[9];
 for(let c=0x20;c<=0x7e;c++)codes.push(c);
 for(let c=0xa0;c<=0x17f;c++)codes.push(c);
 for(let c=0x2000;c<=0x206f;c++)codes.push(c);
 codes.push(0x20ac,0x2122);
 return codes;
}
const isSpace=(c:string)=>!c.trim();
const alternateKeys=(variant:string|undefined)=>variant==='comic-sans-universal'?comicAlternateKeys:variant==='arial-alternates'?arialAlternateKeys:variant==='times-universal'?timesAlternateKeys:variant==='papyrus-alternates'?papyrusAlternateKeys:{};

async function bytesFor(id:string){
 const entry=catalog.find(e=>e.id===id)!;
 if(entry.asset)return new Uint8Array(await Bun.file(join(import.meta.dir,'font-assets',entry.asset)).arrayBuffer());
 return Uint8Array.from(atob((data as any)[catalog.indexOf(entry)].data),c=>c.charCodeAt(0));
}

class Writer {
 bytes:number[]=[];
 private f32=new Float32Array(1);private u8=new Uint8Array(this.f32.buffer);
 u8v(v:number){if(v<0||v>255||!Number.isInteger(v))throw Error('u8 out of range: '+v);this.bytes.push(v);}
 u16(v:number){if(v<0||v>0xffff||!Number.isInteger(v))throw Error('u16 out of range: '+v);this.bytes.push(v&255,v>>8);}
 u32(v:number){this.bytes.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255);}
 f32v(v:number){if(!Number.isFinite(v))throw Error('non-finite value');this.f32[0]=v;for(const b of this.u8)this.bytes.push(b);}
 // Outline coordinates are integers in 1/128 em-units (finer than any source font's grid), each stored as the
 // zigzag LEB128 varint of its difference from the previous point's in the contour (the first from 0).
 private last=0;
 start(){this.last=0;}
 coord(v:number){const q=Math.round(v*COORDINATE_SCALE);if(!Number.isFinite(v)||Math.abs(q)>2**28)throw Error('coordinate out of range: '+v);let d=q-this.last;this.last=q;let z=d<0?-2*d-1:2*d;while(z>=128){this.bytes.push((z&127)|128);z=Math.floor(z/128);}this.bytes.push(z);}
}
export const COORDINATE_SCALE=128;
// Layout (little-endian), version 2:
//  "FZG1" u32 version; u32 string count, each u16 length + UTF-8;
//  u16 font count; per font: u16 id, u8 variant, u8 effect, u16 a, u16 g,
//  f32 notdef advance, u16 signature length + u16 keys (characters 33..126),
//  u16 alternate characters, each u8 char + u16 count + u16 keys,
//  u32 glyph count, per glyph: u32 code point, f32 advance, u8 form count,
//  per form: u16 key (0xffff = native), u32 byte length of what follows,
//  u16 contours, per contour: u16
//  segments, then the x coordinates (start, then 3 per segment) and the y
//  coordinates likewise, each a zigzag varint delta in 1/128 em-units of the
//  100-unit em, y down.
export async function buildGlyphs():Promise<Uint8Array>{
 const strings:string[]=[],index=new Map<string,number>();
 const str=(s:string)=>{let i=index.get(s);if(i===undefined){i=strings.length;strings.push(s);index.set(s,i);}return i;};
 const fonts=new Writer(),codes=charset();
 for(const id of fontIds){
  const entry=catalog.find(e=>e.id===id);if(!entry)throw Error('Unknown font '+id);
  const bytes=await bytesFor(id),face=makeTypeface(create(bytes as any),bytes,entry);
  const scale=100/face.unitsPerEm,native=(signatures as Record<string,string[]>)[variantBase(entry)]??[];
  const alternates=alternateKeys(entry.variant),altChars=Object.keys(alternates).sort();
  fonts.u16(str(id));fonts.u8v(entry.variant?1:0);fonts.u8v(entry.effect?1:0);fonts.u16(str(entry.a));fonts.u16(str(entry.g));
  fonts.f32v(face.glyphForCodePoint(0x10fffd).advanceWidth*scale);
  fonts.u16(native.length);for(const k of native)fonts.u16(str(k));
  fonts.u16(altChars.length);
  for(const c of altChars){fonts.u8v(c.charCodeAt(0));fonts.u16(alternates[c].length);for(const k of alternates[c])fonts.u16(str(k));}
  const glyphs=new Writer();let count=0;
  for(const cp of codes){
   const g=face.glyphForCodePoint(cp);if(!g.id)continue;
   const c=String.fromCodePoint(cp),forms:string[]=[''];
   if(entry.variant&&cp>=33&&cp<=126)for(const key of alternates[c]??[])if(key!==native[cp-33])forms.push(key);
   const outlines=!isSpace(c)&&(!outlineOnlyDigits.has(id)||/[0-9]/.test(c));
   glyphs.u32(cp);glyphs.f32v(g.advanceWidth*scale);glyphs.u8v(outlines?forms.length:0);
   if(outlines)for(const key of forms){
    let glyph=g;
    if(key){const keys=native.slice();keys[cp-33]=key;glyph=face.withConstructions(keys).glyphForCodePoint(cp);}
    const contours=unifiedContours(sourcePath(glyph.path.commands,0,0,scale));
    const outline=new Writer();outline.u16(contours.length);
    for(const contour of contours){outline.u16(contour.length);for(const axis of [0,1]){outline.start();outline.coord(contour[0][0][axis]);for(const s of contour)for(let j=1;j<4;j++)outline.coord(s[j][axis]);}}
    glyphs.u16(key?str(key):0xffff);glyphs.u32(outline.bytes.length);for(const b of outline.bytes)glyphs.bytes.push(b);
   }
   count++;
  }
  fonts.u32(count);for(const b of glyphs.bytes)fonts.bytes.push(b);
 }
 const head=new Writer();
 for(const c of 'FZG1')head.u8v(c.charCodeAt(0));head.u32(VERSION);head.u32(strings.length);
 const enc=new TextEncoder();
 for(const s of strings){const b=enc.encode(s);head.u16(b.length);for(const x of b)head.u8v(x);}
 head.u16(fontIds.length);
 const result=new Uint8Array(head.bytes.length+fonts.bytes.length);result.set(head.bytes,0);result.set(fonts.bytes,head.bytes.length);
 return result;
}

if(import.meta.main){
 const bytes=await buildGlyphs(),target=join(import.meta.dir,'engine/glyphs.bin');
 await Bun.write(target,bytes);
 const hash=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
 console.log('glyphs.bin '+bytes.length+' bytes sha256 '+hash);
}
