"""Unit tests for the CSS parser used by the css-to-tailwind skill."""
import json
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "skills" / "css-to-tailwind" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from parse_css import Parser, analyze_selector, build_skeleton  # noqa: E402

TRICKY = """
@charset "utf-8";
@import url("x.css");
/* header comment; with { braces } */
:root { --brand: #3b82f6; --font: "Helvetica Neue", Arial; }
@font-face { font-family: "X"; src: url(x.woff2) format("woff2"); }
.btn, .link-btn {
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0'/></svg>") no-repeat; /* inline; comment */
  padding: 8px 16px !important;
  color: var(--brand);
  content: "a;b:c";
}
.btn:hover { background-color: #2563eb }
.card > .title:hover::after { color: red; }
@media (min-width: 768px) {
  .btn { padding: 12px 24px; }
  @supports (display: grid) { .grid { display: grid; } }
}
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.parent { color: black; &:hover { color: blue; } .child { margin: 0 } @media (min-width: 640px) { margin: 4px; } }
a[href^="http"] { text-decoration: underline }
.broken { color: red;
"""


def rules_for(parsed, selector):
    return [r for r in parsed["rules"] if r["selector"] == selector]


class ParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parsed = Parser(TRICKY).parse()

    def test_selector_list_splits_into_two_rules_in_one_group(self):
        a = rules_for(self.parsed, ".btn")[0]
        b = rules_for(self.parsed, ".link-btn")[0]
        self.assertEqual(a["group"], b["group"])

    def test_data_url_with_semicolons_is_one_value(self):
        decls = {d["prop"]: d for d in rules_for(self.parsed, ".btn")[0]["declarations"]}
        self.assertTrue(decls["background"]["value"].startswith('url("data:image/svg+xml;utf8,<svg'))
        self.assertTrue(decls["background"]["value"].endswith("no-repeat"))

    def test_comments_are_removed_and_strings_kept(self):
        decls = {d["prop"]: d for d in rules_for(self.parsed, ".btn")[0]["declarations"]}
        self.assertNotIn("comment", decls["background"]["value"])
        self.assertEqual(decls["content"]["value"], '"a;b:c"')

    def test_important_flag(self):
        decls = {d["prop"]: d for d in rules_for(self.parsed, ".btn")[0]["declarations"]}
        self.assertTrue(decls["padding"]["important"])
        self.assertEqual(decls["padding"]["value"], "8px 16px")
        self.assertFalse(decls["color"]["important"])

    def test_unsupported_at_rules_are_reported_not_fatal(self):
        kinds = {u["kind"] for u in self.parsed["unsupported"]}
        self.assertEqual(kinds, {"@charset", "@import", "@font-face", "@keyframes"})

    def test_keyframes_content_does_not_leak_into_rules(self):
        self.assertFalse([r for r in self.parsed["rules"] if r["selector"] in ("from", "to")])

    def test_media_and_nested_supports_conditions(self):
        media = [r for r in self.parsed["rules"] if r["selector"] == ".btn" and r["at"]]
        self.assertEqual(media[0]["at"], ["@media (min-width: 768px)"])
        grid = rules_for(self.parsed, ".grid")[0]
        self.assertEqual(grid["at"], ["@media (min-width: 768px)", "@supports (display: grid)"])

    def test_css_nesting_is_resolved(self):
        self.assertTrue(rules_for(self.parsed, ".parent:hover"))
        self.assertTrue(rules_for(self.parsed, ".parent .child"))
        at_rule = [r for r in rules_for(self.parsed, ".parent") if r["at"]]
        self.assertEqual(at_rule[0]["declarations"][0]["prop"], "margin")

    def test_unterminated_block_warns_but_recovers(self):
        self.assertTrue(any("missing '}'" in w for w in self.parsed["warnings"]))
        self.assertTrue(rules_for(self.parsed, ".broken"))

    def test_attribute_selector_is_flagged(self):
        self.assertIn("attribute", rules_for(self.parsed, 'a[href^="http"]')[0]["flags"])


class SelectorAnalysisTests(unittest.TestCase):
    def test_subject_suffix_and_prefix(self):
        subject, suffix, prefix, flags = analyze_selector(".card > .title:hover::after")
        self.assertEqual((subject, suffix, prefix.strip()), (".title", ":hover::after", ".card >"))
        self.assertIn("combinator", flags)

    def test_pseudo_with_parentheses(self):
        subject, suffix, _, _ = analyze_selector(".a:not(.b):hover")
        self.assertEqual((subject, suffix), (".a", ":not(.b):hover"))


class SkeletonTests(unittest.TestCase):
    def test_groups_rules_by_subject_and_keeps_context(self):
        css = ".btn{color:red}.btn:hover{color:blue}@media (min-width:768px){.btn{padding:1px}}.card img{width:100%}"
        sk = build_skeleton(Parser(css).parse())
        ids = [i["id"] for i in sk["items"]]
        self.assertEqual(ids, [".btn", ".card img"])
        btn = sk["items"][0]["source"]
        self.assertEqual({(d["context"], tuple(d["at"])) for d in btn},
                         {("&", ()), ("&:hover", ()), ("&", ("@media (min-width:768px)",))})
        self.assertEqual(sk["items"][1]["source"][0]["context"], ".card &")


class CliTests(unittest.TestCase):
    def test_cli_outputs_valid_json(self):
        out = subprocess.run([sys.executable, str(SCRIPTS / "parse_css.py"), "-"], input=".a{color:red}",
                             capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(out)["rules"][0]["selector"], ".a")


if __name__ == "__main__":
    unittest.main()
