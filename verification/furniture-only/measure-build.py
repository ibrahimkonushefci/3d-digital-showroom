from pathlib import Path
import json,gzip,re,sys
p=Path('dist'); files=[f for f in p.rglob('*') if f.is_file()]
urls=set(re.findall(r'url:\s*["\']([^"\']+)["\']', (p/'sw.js').read_text()))
js=[f for f in files if f.suffix=='.js'];css=[f for f in files if f.suffix=='.css']; pub=[f for f in files if not str(f.relative_to(p)).startswith('assets/') and f.suffix not in ['.js','.html']]
d={'shipped':sum(f.stat().st_size for f in files),'precache':sum((p/u.lstrip('/')).stat().st_size for u in urls),'precacheURLs':len(urls),'javascript':sum(f.stat().st_size for f in js),'javascriptGzip':sum(len(gzip.compress(f.read_bytes(),mtime=0)) for f in js),'css':sum(f.stat().st_size for f in css),'staticAssets':sum(f.stat().st_size for f in pub),'files':{str(f.relative_to(p)):f.stat().st_size for f in files}}
Path(sys.argv[1]).write_text(json.dumps(d,indent=2))
print({k:v for k,v in d.items() if k!='files'})
