import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('sunset_stage', HERE / 'stage-sunset-hero.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)
TEMPLATE = (HERE / 'sunset-hero-section.html').read_bytes()
ORIGINAL = '''<!doctype html><html><head>
<link rel="preload" as="image" href="assets/zetslay-orderflow.webp?v=old">
<link rel="stylesheet" href="legal/current.css"><meta name="operator" content="сохранить">
</head><body id="top" data-landing-theme="orderflow"><a class="skip-link" href="#main">Skip</a>
<header class="site-header"><a data-session-guest href="app/?auth=login">Login</a><a data-session-cabinet href="app/" hidden>Cabinet</a><details class="mobile-menu"><summary>Menu</summary></details></header>
<main id="main"><section id="landing" class="hero" data-landing-hero="orderflow"><div>Old</div></section>
<section id="plugins"><div>plugins</div></section></main><footer>Неизвестная новая правка</footer>
<script src="landing-session.js"></script><script src="legal/current.js"></script></body></html>'''.encode()


class SunsetPatchTests(unittest.TestCase):
    def test_preserves_everything_after_hero(self):
        result = stage.patch(ORIGINAL, TEMPLATE)
        tail = b'<section id="plugins">'
        self.assertEqual(ORIGINAL[ORIGINAL.index(tail):], result[result.index(tail):])
        self.assertIn('content="сохранить"'.encode(), result)
        self.assertIn(b'<link rel="stylesheet" href="legal/current.css">', result)

    def test_preserves_original_session_attributes_and_mobile_menu(self):
        result = stage.patch(ORIGINAL, TEMPLATE)
        before = stage.HEADER.search(ORIGINAL).group()
        after = stage.HEADER.search(result).group().replace(b' zsh-header', b'')
        self.assertEqual(before, after)
        self.assertEqual(len(stage.HEADER.findall(result)), 1)

    def test_repeat_is_byte_identical(self):
        once = stage.patch(ORIGINAL, TEMPLATE)
        self.assertEqual(stage.patch(once, TEMPLATE), once)
        self.assertEqual(once.count(stage.STYLE), 1)
        self.assertNotIn(b'assets/zetslay-orderflow.webp?v=old', once)

    def test_refuses_unknown_or_duplicated_hero(self):
        for source in (ORIGINAL.replace(b'"orderflow"><div>', b'"new-design"><div>'),
                       ORIGINAL.replace(b'</main>', b'<section id="landing" data-landing-hero="orderflow"></section></main>')):
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    stage.patch(source, TEMPLATE)

    def test_refuses_nested_section_in_legacy_hero(self):
        source = ORIGINAL.replace(b'<div>Old</div>', b'<section>Unexpected</section>')
        with self.assertRaises(ValueError):
            stage.patch(source, TEMPLATE)

    def test_refuses_missing_template_header_slot(self):
        with self.assertRaises(ValueError):
            stage.patch(ORIGINAL, TEMPLATE.replace(b'<!-- ZETSLAY_EXISTING_HEADER -->', b''))


if __name__ == '__main__':
    unittest.main()
