"""Regression tests for the verifier: it must keep flagging real conversion problems.

Needs Node plus `tailwindcss` and `postcss` installed in two folders, one per major version:
  TW_V3_DIR=/path/with/tailwind3 TW_V4_DIR=/path/with/tailwind4 python -m unittest tests.test_verifier_negative
`bash tools/run-selftest.sh` sets these up and runs this file. Without the variables the tests are skipped.
"""
import json
import os
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERIFY = ROOT / "skills" / "css-to-tailwind" / "scripts" / "verify_classes.mjs"
FIXTURE = ROOT / "tests" / "fixtures" / "negative.json"

# (status, property) pairs that must appear in the report, per Tailwind major version.
COMMON = {
    "text-lg-adds-line-height": [("extra", "line-height")],
    "css-ease-keyword-is-not-tailwind-ease": [("DIFFERS", "transition-timing-function")],
    "transition-colors-is-a-property-list": [("DIFFERS", "transition-property")],
    "truncate-brings-extra-declarations": [("extra", "white-space")],
    "margin-auto-needs-vertical-zeros": [("MISSING", "margin-top"), ("MISSING", "margin-bottom")],
    "grid-cols-uses-minmax": [("DIFFERS", "grid-template-columns")],
    "rounded-full-is-not-50-percent": [("DIFFERS", "border-top-left-radius")],
    "max-w-sm-is-not-640px": [("DIFFERS", "max-width")],
    "font-sans-is-not-a-source-stack": [("DIFFERS", "font-family")],
}
V3 = {
    "outline-none-differs-between-versions": [("DIFFERS", "outline-style")],
    "transform-order-matters": [("DIFFERS", "transform")],
}
V4 = {
    "transform-order-matters": [("unverified", "transform")],
}
STATUS = {"match": "ok", "differs": "DIFFERS", "missing": "MISSING", "extra": "extra", "unverified": "unverified"}


def run(tw_dir):
    out = subprocess.run(["node", str(VERIFY), str(FIXTURE), "--tailwind-dir", tw_dir, "--json"],
                         capture_output=True, text=True, check=True).stdout
    return {item["id"]: item for item in json.loads(out)}


class VerifierRegressionTests:
    expected = {}
    tw_dir = None

    @classmethod
    def setUpClass(cls):
        if not cls.tw_dir:
            raise unittest.SkipTest(f"{cls.env_name} is not set")
        cls.report = run(cls.tw_dir)

    def test_reports_each_known_problem(self):
        for case, wanted in {**COMMON, **self.expected}.items():
            found = {(STATUS[d["status"]], d["prop"]) for d in self.report[case]["diff"]}
            for pair in wanted:
                self.assertIn(pair, found, f"{case}: expected {pair}, got {sorted(found)}")

    def test_flags_nonexistent_class(self):
        classes = {c["cls"]: c["valid"] for c in self.report["nonexistent-class"]["classes"]}
        self.assertFalse(classes["bogus-class"])
        self.assertTrue(classes["text-red-500"])


class V3Tests(VerifierRegressionTests, unittest.TestCase):
    env_name = "TW_V3_DIR"
    tw_dir = os.environ.get("TW_V3_DIR")
    expected = V3


class V4Tests(VerifierRegressionTests, unittest.TestCase):
    env_name = "TW_V4_DIR"
    tw_dir = os.environ.get("TW_V4_DIR")
    expected = V4

    def test_v4_outline_none_is_literal_outline_style_none(self):
        diffs = self.report["outline-none-differs-between-versions"]["diff"]
        self.assertTrue(all(d["status"] != "differs" for d in diffs))


if __name__ == "__main__":
    unittest.main()
