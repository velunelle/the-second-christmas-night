#!/usr/bin/env python3
"""Bundle this buildless city into one offline HTML. Requires the esbuild CLI."""
from pathlib import Path
import argparse,subprocess,json,base64,mimetypes,re,tempfile
parser=argparse.ArgumentParser();parser.add_argument('output');parser.add_argument('--esbuild',default='esbuild');args=parser.parse_args()
project=Path(__file__).resolve().parent.parent;dist=project/'dist';out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as td:
 entry=Path(td)/'entry.js';entry.write_text('\n'.join('import '+json.dumps(str(dist/'src'/n))+';' for n in ['copy-editor.js','song-ui.js','main.js']))
 bundle=Path(td)/'bundle.js'
 subprocess.run([args.esbuild,str(entry),'--bundle','--format=esm','--target=es2022','--minify','--legal-comments=inline','--alias:three/addons='+str(dist/'vendor/three/examples/jsm'),'--alias:three='+str(dist/'vendor/three/build/three.module.js'),'--outfile='+str(bundle)],check=True,capture_output=True)
 code=bundle.read_text()
assets={}
for directory in ['assets','fonts','content','licenses']:
 for p in sorted((dist/directory).rglob('*')):
  if p.is_file():assets[p.relative_to(dist).as_posix()]='data:'+(mimetypes.guess_type(p.name)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
p=dist/'tuning.json';assets['tuning.json']='data:application/json;base64,'+base64.b64encode(p.read_bytes()).decode()
for p in (dist/'opening').iterdir():
 if p.suffix in ['.svg','.png']:assets['opening/'+p.name]='data:'+(mimetypes.guess_type(p.name)[0]or'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
def safe(s):return json.dumps(s,ensure_ascii=False).replace('<','\\u003c')
bootstrap='''const nativeFetch=window.fetch.bind(window);const embedded=window.__embeddedAssets=ASSETS;
function findAsset(value,prefix=''){const text=String(value?.url??value);if(/^(data:|blob:)/.test(text))return null;let key=text.split('?')[0].replace(/^\\.\\//,'');if(embedded[prefix+key])return prefix+key;try{key=new URL(text,location.href).pathname;}catch{}for(const candidate of Object.keys(embedded))if(key.endsWith('/'+candidate)||key===candidate)return candidate;return null;}
window.__assetURL=value=>{const key=findAsset(value);return key?embedded[key]:value;};
window.fetch=(value,options)=>{const key=findAsset(value,window.__embeddedPrefix||'');return nativeFetch(key?embedded[key]:value,options);};'''.replace('ASSETS',safe(assets))
child=(dist/'opening/index.html').read_text()
for name in ['flowers.svg','flowers_fill.svg','crack1.png','crack2.png']:
 child=child.replace('url("'+name+'?v=1023")','url("'+assets['opening/'+name]+'")')
child=child.replace('../fonts/Christmas-Round.ttf',assets['fonts/Christmas-Round.ttf'])
childAssets={k:v for k,v in assets.items() if k.startswith('opening/')}
childBoot="window.__embeddedPrefix='opening/';"+bootstrap.replace(safe(assets),safe(childAssets))
child=child.replace('<head>','<head><script>'+childBoot.replace('</script','<\\/script')+'</script>',1)
for name in ['../vendor/gsap.min.js','opening.js','snow.js']:
 file=dist/'vendor/gsap.min.js' if name.startswith('..') else dist/'opening'/name
 child=child.replace('<script src="'+name+'"></script>','<script>'+file.read_text().replace('</script','<\\/script')+'</script>')
child=re.sub(r',\s*location\.origin\s*\)',",(location.origin==='null'?'*':location.origin))",child)
html=(dist/'index.html').read_text();html=re.sub(r'<script type="importmap">.*?</script>','',html,flags=re.S)
css=(dist/'city.css').read_text().replace('fonts/Christmas-Round.ttf',assets['fonts/Christmas-Round.ttf'])
html=html.replace('<link rel="stylesheet" href="city.css">','<style>'+css+'</style>')
html=html.replace('src="opening/index.html"','src="about:blank"')
html=html.replace('<script type="module" src="src/copy-editor.js"></script>','').replace('<script type="module" src="src/song-ui.js"></script>','')
html=html.replace('<script type="module" src="src/main.js"></script>','<script type="module">'+code.replace('</script','<\\/script')+'</script>')
html=re.sub(r',\s*location\.origin\s*\)',",(location.origin==='null'?'*':location.origin))",html)
boot=bootstrap+"document.addEventListener('DOMContentLoaded',()=>{const frame=document.getElementById('opening');if(frame)frame.srcdoc="+safe(child)+";});"
html=html.replace('<head>','<head><script>'+boot+'</script>',1)
html=html.replace('</body>','<!-- Bundled dependencies and assets retain their original licenses, embedded in __embeddedAssets. --></body>')
out.write_text(html);print(json.dumps({'output':str(out),'bytes':out.stat().st_size,'embedded_assets':len(assets)},ensure_ascii=False))
