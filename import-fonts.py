"""Import pinned, unmodified OFL font files and their licenses."""
import json,re,urllib.request,concurrent.futures,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
families='''Inter Roboto OpenSans Lato Montserrat Poppins Raleway Nunito NunitoSans WorkSans Rubik Ubuntu Cabin Karla Barlow FiraSans SourceSans3 DMSans Manrope Outfit PlusJakartaSans PublicSans Quicksand VarelaRound Comfortaa JosefinSans Jost Lexend Mulish Asap Assistant Abel BebasNeue Oswald Anton Archivo ArchivoBlack Exo2 Orbitron Rajdhani Teko ChakraPetch Audiowide Michroma SpaceGrotesk Syne Sora Urbanist Merriweather Lora PlayfairDisplay CormorantGaramond EBGaramond LibreBaskerville CrimsonText CrimsonPro Bitter Arvo RobotoSlab ZillaSlab BreeSerif DMSerifDisplay DMSerifText Cinzel Alegreya Vollkorn Spectral Prata Cardo Domine NotoSerif LibreCaslonText BodoniModa Fraunces FiraCode JetBrainsMono SourceCodePro SpaceMono IBMPlexMono Inconsolata UbuntuMono RobotoMono VictorMono Caveat DancingScript Pacifico IndieFlower ShadowsIntoLight PatrickHand Kalam PermanentMarker Satisfy Sacramento GreatVibes AmaticSC Handlee GloriaHallelujah ArchitectsDaughter Lobster Righteous Bangers Fredoka Baloo2 LuckiestGuy AbrilFatface Monoton PressStart2P Creepster Rye FrederickatheGreat'''.split()
manifest=root/'font-import.json'
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Type-Space-prototype'}),timeout=60) as r:return r.read()
if manifest.exists(): revision=json.loads(manifest.read_text())['revision']
else: revision=json.loads(fetch('https://api.github.com/repos/google/fonts/commits/main'))['sha']
base='https://raw.githubusercontent.com/google/fonts/'+revision+'/ofl/'
def get(family):
 slug=family.lower();url=base+slug+'/'
 try:
  meta=fetch(url+'METADATA.pb').decode();license=fetch(url+'OFL.txt')
  blocks=re.findall(r'fonts \{(.*?)\n\}',meta,re.S)
  choices=[b for b in blocks if 'style: "normal"' in b]
  if not choices:return None
  chosen=min(choices,key=lambda b:abs(int(re.search(r'weight: (\d+)',b)[1])-400))
  filename=re.search(r'filename: "([^"]+)"',chosen)[1]
  content=fetch(url+urllib.parse.quote(filename));folder=root/'font-assets'/slug;folder.mkdir(exist_ok=True)
  (folder/'font.ttf').write_bytes(content);(folder/'OFL.txt').write_bytes(license)
  return {'id':'gf-'+slug,'name':re.search(r'^name: "([^"]+)"',meta)[1],'postscript':re.search(r'post_script_name: "([^"]+)"',chosen)[1], 'asset':slug+'/font.ttf','licenseAsset':slug+'/OFL.txt','category':re.search(r'^category: "([^"]+)"',meta,re.M)[1], 'source':url+urllib.parse.quote(filename),'sha256':hashlib.sha256(content).hexdigest()}
 except Exception as e: print('SKIP',family,str(e),flush=True);return None
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 results=list(pool.map(get,families))
selected=[f for f in results if f][:100]
if len(selected)!=100:raise RuntimeError('Only '+str(len(selected))+' fonts fetched')
manifest.write_text(json.dumps({'repository':'https://github.com/google/fonts','revision':revision,'fonts':selected},indent=2)+'\n')
# Unselected downloads are not part of the shipped library.
for entry in [f for f in results if f][100:]:
 folder=root/'font-assets'/entry['asset'].split('/')[0]
 for file in folder.iterdir():file.unlink()
 folder.rmdir()
print('Imported',len(selected),'families at',revision,flush=True)
