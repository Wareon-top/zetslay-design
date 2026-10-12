from pathlib import Path
import importlib.util
import tempfile
import shutil
import re
import unittest
BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-week-session.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTests(unittest.TestCase):
    def test_upgrades_legacy_tab_login_without_replacing_other_sections(self):
        with tempfile.TemporaryDirectory() as tmp:
            local=Path(tmp)/'local';local.mkdir();(local/'app').mkdir()
            for name in ['index.html','app/index.html','app/app.js','app/account-security.js']:shutil.copy2(BASE/name,local/name)
            p=local/'app/app.js';text=p.read_text()
            a,b=module.span(text,'async function restoreSession()','\nasync function initializeAuthFlow(')
            text=text[:a]+"async function restoreSession() { /* old tab-only login */ }\n"+text[b:]
            text=text.replace("      logoutSession(event.target.closest('[data-auth-logout]'));", "      apiRequest('/api/v1/auth/logout', { method: 'POST', authenticated: true }).catch(() => {});\n      clearSession();\n      setView('dashboard');")
            text=text.replace('window.ZetSlaySession?.clearLegacy();',"sessionStorage.removeItem('zetslay_session');")
            p.write_text(text+'\n// LOCAL_AUTOMATION_HOOK\n')
            p=local/'index.html';text=p.read_text()
            text=re.sub(r'<a data-session-cabinet[^>]*>В кабинет</a>','',text)
            text=text.replace(' data-session-guest','').replace(' data-session-start','').replace('<span-label>Начать работу</span>','Начать работу')
            # The attribute replacement also changes the label attribute.
            text=text.replace('<span-label>','<span>')
            text=text.replace('<span>Начать работу</span>','Начать работу')
            p.write_text(text)
            out=Path(tmp)/'out';module.stage(local,BASE,out)
            self.assertIn('LOCAL_AUTOMATION_HOOK',(out/'app/app.js').read_text())
            self.assertEqual((out/'index.html').read_text().count('data-session-cabinet'),2)
            self.assertIn('ZetSlaySession.restore',(out/'app/app.js').read_text())
    def test_preserves_customizations_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as tmp:
            local=Path(tmp)/'local';local.mkdir();(local/'app').mkdir()
            for name in ['index.html','app/index.html','app/app.js','app/account-security.js']:shutil.copy2(BASE/name,local/name)
            for name in ['index.html','app/app.js']:
                p=local/name;p.write_text(p.read_text()+('\n<!-- OWNER CUSTOM FOOTER -->\n' if name.endswith('html') else '\n// OWNER CUSTOM PLUGINS\n'))
            out=Path(tmp)/'out';module.stage(local,BASE,out)
            self.assertIn('OWNER CUSTOM FOOTER',(out/'index.html').read_text());self.assertIn('OWNER CUSTOM PLUGINS',(out/'app/app.js').read_text())
            self.assertEqual((out/'app/index.html').read_text().count('../session-client.js?'),1)
            second=Path(tmp)/'second';module.stage(out,BASE,second)
            self.assertEqual((second/'index.html').read_text().count('data-session-cabinet'),2)
            self.assertEqual((second/'app/app.js').read_text().count('async function logoutSession('),1)
    def test_unknown_shape_does_not_modify_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            local=Path(tmp)/'local';local.mkdir();(local/'app').mkdir()
            for name in ['index.html','app/index.html','app/app.js','app/account-security.js']:shutil.copy2(BASE/name,local/name)
            p=local/'app/app.js';p.write_text(p.read_text().replace('async function restoreSession()','async function renamedRestore()'))
            before=p.read_text();out=Path(tmp)/'out'
            with self.assertRaises(ValueError):module.stage(local,BASE,out)
            self.assertEqual(p.read_text(),before);self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
