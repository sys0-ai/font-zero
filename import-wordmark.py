"""Add Wordmark's faces that the library lacks: pinned, unmodified OFL files from google/fonts at the manifest's revision."""
import json,re,urllib.request,urllib.parse,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
manifest=json.loads((root/'font-import.json').read_text());revision=manifest['revision']
base='https://raw.githubusercontent.com/google/fonts/'+revision+'/ofl/'
import time
def fetch(url):
 for attempt in range(6):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'font-import'}),timeout=60) as r:return r.read()
  except urllib.error.HTTPError as e:
   if e.code!=429 or attempt==5:raise
   time.sleep(20*(attempt+1))
extra=json.loads((root/'extra-fonts.json').read_text())
for slug in 'unbounded kronaone bigshoulders rubikmonoone instrumentserif poiretone majormonodisplay pressstart2p silkscreen'.split():
 if any(f['id']=='gf-'+slug for f in extra):continue
 try:meta=fetch(base+slug+'/METADATA.pb').decode()
 except Exception as e:print('SKIP',slug,e);continue
 license=fetch(base+slug+'/OFL.txt')
 blocks=[b for b in re.findall(r'fonts \{(.*?)\n\}',meta,re.S) if 'style: "normal"' in b]
 chosen=min(blocks,key=lambda b:abs(int(re.search(r'weight: (\d+)',b)[1])-400))
 filename=re.search(r'filename: "([^"]+)"',chosen)[1];url=base+slug+'/'+urllib.parse.quote(filename);content=fetch(url)
 folder=root/'font-assets'/slug;folder.mkdir(exist_ok=True);(folder/'font.ttf').write_bytes(content);(folder/'OFL.txt').write_bytes(license)
 entry={'id':'gf-'+slug,'name':re.search(r'^name: "([^"]+)"',meta,re.M)[1],'postscript':re.search(r'post_script_name: "([^"]+)"',chosen)[1],'asset':slug+'/font.ttf','licenseAsset':slug+'/OFL.txt','category':re.search(r'^category: "([^"]+)"',meta,re.M)[1],'source':url,'sha256':hashlib.sha256(content).hexdigest()}
 manifest['fonts'].append(entry);extra.append({**entry,'description':entry['name']+'. from Wordmark','a':'double-storey','g':'single-storey','profile':{'corner':0,'lean':0,'hand':0},'constructionInferred':True});print('added',entry['id'],entry['postscript'])
(root/'font-import.json').write_text(json.dumps(manifest,indent=2)+'\n');(root/'extra-fonts.json').write_text(json.dumps(extra,indent=2)+'\n')
