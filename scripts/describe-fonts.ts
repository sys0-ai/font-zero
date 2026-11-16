import {create} from 'fontkit';
import manifest from '../src/font-import.json';
import {readContours,at} from '../src/curves';
const directory=import.meta.dir+'/..';
const descriptions:Record<string,string>={
 serif:'traditional literary elegant editorial scholarly refined serif typography',sans_serif:'clean modern simple friendly clear sans serif typography',monospace:'technical precise coding mechanical structured monospace typography',handwriting:'personal human casual flowing warm expressive handwriting',display:'expressive distinctive decorative theatrical playful display typography'
};
const mood:Record<string,string>={orbitron:'futuristic spaceship robotic geometric sharp science fiction',audiowide:'futuristic spaceship cyberpunk racing rounded electronic',michroma:'futuristic spaceship technical wide precise',chakra_petch:'angular technical sharp cyberpunk',quicksand:'soft round booba friendly cute playful',comfortaa:'soft round booba bubbly friendly',fredoka:'playful soft round booba cartoon children circus',baloo2:'playful soft round booba bubbly warm cartoon',bangers:'comic superhero loud energetic circus bold',lobster:'retro diner vintage friendly script',pacifico:'relaxed beach tropical warm handwritten',caveat:'natural personal spontaneous handwritten journal',dancingscript:'romantic flowing elegant handwritten wedding',greatvibes:'romantic luxurious ornate calligraphic wedding',sacramento:'elegant gentle delicate handwritten romantic',amatic_sc:'quirky narrow playful handmade tall',anton:'loud powerful bold dramatic poster',bebasneue:'bold tall condensed confident poster',oswald:'confident compact condensed news headline',abrilfatface:'dramatic fashionable luxurious high contrast editorial',playfairdisplay:'elegant editorial newspaper refined luxurious contrast',bodonimoda:'fashion luxury elegant high contrast editorial',cinzel:'classical roman ancient monumental solemn',fraunces:'soft warm quirky organic retro serif',cormorantgaramond:'literary delicate graceful traditional book',spacegrotesk:'geometric futuristic modern technical',syne:'experimental artistic expressive unusual modern',pressstart2p:'pixel retro arcade video game computer',monoton:'retro neon disco nightclub luminous',rye:'western circus vintage ornamental',frederickathegreat:'rustic hand drawn sketch vintage',indieflower:'casual handwritten playful personal notebook',gloriahallelujah:'playful handwritten lively informal',shadowsintolight:'gentle personal handwritten diary',patrickhand:'friendly casual hand printed human',architectsdaughter:'handwritten architectural sketch personal',kalam:'natural energetic handwritten organic',jetbrainsmono:'precise coding technical modern computer',firacode:'precise technical programmer computer',spacemono:'retro terminal technical monospaced spaceship'};
const output=[];
for(const f of manifest.fonts){
 const font:any=create(new Uint8Array(await Bun.file(directory+'/fonts/'+f.asset).arrayBuffer()));
 const infer=(letter:string)=>{
  const glyph=font.glyphForCodePoint(letter.charCodeAt(0)),cs=readContours(glyph.path.commands),areas=cs.map(c=>{const p=c.flatMap(s=>[s[0],at(s,.5)]);return p.reduce((n,v,i)=>n+v[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*v[1],0)}),big=areas.reduce((a,b)=>Math.abs(a)>Math.abs(b)?a:b,0),holes=cs.filter((_,i)=>areas[i]*big<0);
  if(letter==='g')return holes.length>=2?'double-storey':'single-storey';
  if(!holes.length)return 'single-storey';
  const pts=holes[0].flatMap(c=>[c[0],at(c,.5)]),ymid=-pts.reduce((n,p)=>n+p[1],0)/pts.length,b=glyph.bbox;
  return (ymid-b.minY)/(b.maxY-b.minY)<.43?'double-storey':'single-storey';
 };
 const category=f.category.toLowerCase(),tag=mood[f.id.slice(3)]??descriptions[category]??descriptions.display;
 const handwriting=category==='handwriting',rounded=/round|soft|booba/.test(tag),angular=/sharp|angular|pixel|technical/.test(tag);
 output.push({...f,postscript:font.postscriptName,description:f.name+'. '+tag, a:infer('a'),g:infer('g'),profile:{corner:rounded?-.2:angular?.7:category==='serif'?.2:.05,lean:handwriting?.08:0,hand:handwriting?.85:0},constructionInferred:true});
}
await Bun.write(directory+'/src/extra-fonts.json',JSON.stringify(output,null,2)+'\n');
console.log(output.length,'fonts,',output.reduce((n,f)=>n+Bun.file(directory+'/fonts/'+f.asset).size,0),'bytes');
