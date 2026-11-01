import importlib.util,re,shutil,subprocess,tempfile,unittest,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('kb',Path(__file__).with_name('stage-knowledge-base-essential.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class EssentialTests(unittest.TestCase):
 def template(self):return (ROOT/'deploy/knowledge-base-essential.html').read_text()
 def test_banners_and_every_other_view_survive_byte_for_byte(self):
  original=(ROOT/'app/index.html').read_text().replace('Прокси для вашего магазина','MY_CUSTOM_PROXY_COPY').replace('Как автоматизировать FunPay?','MY_CUSTOM_VIDEO_COPY')
  original=original.replace('data-video-guide="guide"','data-owned="extra" data-video-guide="guide"')
  result=m.inject(original,self.template())
  def guide_span(text):return next((a,b) for a,b,v in m.sections(text) if v.get('data-view')=='guide')
  a,b=guide_span(original);c,d=guide_span(result)
  # Query version changes are the only changes outside the guide.
  normalize=lambda t:re.sub(r'(knowledge-base\.(?:css|js))\?v=[A-Za-z0-9_-]+',r'\1?v=VERSION',t)
  self.assertEqual(normalize(original[:a]+original[b:]),normalize(result[:c]+result[d:]))
  for attr in ['data-video-guide','data-proxy-invite']:
   def banner(text):return [text[x:y] for x,y,v in m.sections(text) if v.get(attr)=='guide'][0]
   self.assertEqual(banner(original),banner(result))
  self.assertEqual(m.inject(result,self.template()),result)
 def test_missing_or_ambiguous_banner_stops_without_writing(self):
  original=(ROOT/'app/index.html').read_text()
  for html in [original.replace('data-proxy-invite="guide"','data-proxy-invite="other"'),original.replace('data-video-guide="guide"','data-video-guide="other"'),original.replace('data-view="guide"','data-view="other"')]:
   with self.subTest(),tempfile.TemporaryDirectory() as d:
    p=Path(d);local=p/'local';inc=p/'in';local.mkdir();inc.mkdir();(local/'index.html').write_text(html);(inc/'knowledge-base-essential.html').write_text(self.template())
    with self.assertRaises(ValueError):m.stage(local,inc,p/'out')
    self.assertFalse((p/'out').exists())
 def test_partial_install_restores_html_and_modules(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);site=p/'site';(site/'app').mkdir(parents=True);backup=p/'backup';backup.mkdir();bin=p/'bin';bin.mkdir()
   originals={f:(ROOT/'app'/f).read_bytes() for f in ['index.html','knowledge-base.css','knowledge-base.js']}
   for f,data in originals.items():(site/'app'/f).write_bytes(data)
   git='#!/usr/bin/env python3\nimport sys,pathlib,subprocess\na=sys.argv[1:]\nroot=pathlib.Path('+repr(str(ROOT))+')\nif a[0]=="rev-parse":\n if ":" in a[1]:print(subprocess.check_output(["/usr/bin/git","hash-object",str(root/a[1].split(":",1)[1])],text=True).strip())\n else:print("fixture")\nelif a[0]=="show":sys.stdout.buffer.write((root/a[1].split(":",1)[1]).read_bytes())\nelif a[0]=="hash-object":print(subprocess.check_output(["/usr/bin/git",*a],text=True).strip())\n'
   (bin/'git').write_text(git);(bin/'mv').write_text('#!/usr/bin/env python3\nimport os,sys\nif sys.argv[-1]=="app/index.html":sys.exit(1)\nos.replace(sys.argv[-2],sys.argv[-1])\n')
   for f in bin.iterdir():f.chmod(0o755)
   env={**os.environ,'PATH':str(bin)+':'+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_KB_ESSENTIAL_REVISION':'fixture'}
   r=subprocess.run(['bash',str(ROOT/'deploy/update-knowledge-base-essential.sh')],capture_output=True,text=True,env=env,timeout=20)
   self.assertNotEqual(r.returncode,0);self.assertIn('Прежний вариант восстановлен',r.stdout)
   for f,data in originals.items():self.assertEqual((site/'app'/f).read_bytes(),data)
if __name__=='__main__':unittest.main()
