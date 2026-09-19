"""Package exact before/current HTML; reject non-presentation production drift."""
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE='82458bd1a278fd854ebe6e854c5ac675a5edbe81'
parser=argparse.ArgumentParser();parser.add_argument('--authority',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
authority=Path(args.authority);out=Path(args.output)
sha=lambda data:hashlib.sha256(data).hexdigest()
original=subprocess.check_output(['git','show',BASE+':seo-portal/index.html'],cwd=ROOT)
current=(ROOT/'seo-portal/index.html').read_bytes()
restored=current.replace(b'  <link rel="stylesheet" href="./010-shared-compact-application-ui.css">\n  <link rel="stylesheet" href="./020-compact-portal.css">\n</head>',b'</head>').replace(b'<body class="adelphos-app-ui" data-app-ui-style="compact-white-v1">',b'<body>')
assert restored==original,'Portal behavior/markup changed beyond style opt-in'
source=json.loads((ROOT/'seo-portal/030-shared-style-source.json').read_text())
for name,digest in source['sources'].items():assert sha((authority/name).read_bytes())==digest,('Shared authority changed',name)
cssname=next(k for k in source['sources'] if k.endswith('.css'))
expected=(authority/cssname).read_bytes().replace(b"url('/fonts/inter-text/",b"url('./fonts/")
assert (ROOT/'seo-portal/010-shared-compact-application-ui.css').read_bytes()==expected
for name in source['sources']:
 if name.endswith('.woff2'):assert (ROOT/'seo-portal/fonts'/Path(name).name).read_bytes()==(authority/name).read_bytes()
preserved={}
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'--','api/seo','supabase/migrations'],cwd=ROOT,text=True).splitlines()
paths += ['data/'+n for n in ['seo-keywords.generated.json','seo-research.generated.json','seo-backlinks.generated.json','seo-link-graph.generated.json','seo-page-audit.generated.json']]
for name in paths:
 data=(ROOT/name).read_bytes();assert data==subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT),('Protected behavior/data drift',name);preserved[name]=sha(data)
portal=out/'seo-portal';portal.mkdir(parents=True,exist_ok=True)
(portal/'before.html').write_bytes(original);(portal/'current.html').write_bytes(current)
assets=['010-shared-compact-application-ui.css','020-compact-portal.css']+['fonts/Inter-'+w+'.woff2' for w in ['Regular','Medium','SemiBold']]
for rel in assets:
 dest=portal/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'seo-portal'/rel,dest)
for rel in ['030-fixture-data.json','040-serve-preview.cjs']:shutil.copyfile(ROOT/'seo-portal/harness'/rel,out/rel)
artifactPaths=['seo-portal/before.html','seo-portal/current.html']+['seo-portal/'+n for n in assets]+['030-fixture-data.json','040-serve-preview.cjs']
proof={'baseline':BASE,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'portalScriptUnchanged':True,'preservedSources':preserved,'sharedAuthority':source,'artifacts':{n:sha((out/n).read_bytes()) for n in artifactPaths},'limitation':'Static app packaging; browser uses synthetic HTTP responses. No production tenant, provider, storage or deployed release proof.'}
(out/'build-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print('SEO_PREVIEW_PACKAGE_COMPLETE:',len(preserved),'unchanged API/schema/data files;',len(artifactPaths),'packaged artifacts')
