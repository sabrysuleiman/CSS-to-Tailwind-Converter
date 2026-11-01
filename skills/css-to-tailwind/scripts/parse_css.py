#!/usr/bin/env python3
"""Parse a CSS stylesheet into flat, conversion-ready records.

Why this exists: splitting CSS with regexes or on ';' and ':' breaks on comments,
strings, url(data:...;base64,...), calc() and nested at-rules. This parser is a
small tokenizer-aware reader (standard library only) that never loses scope.

Usage:
  parse_css.py FILE|-            # JSON: rules, unsupported at-rules, warnings
  parse_css.py FILE|- --skeleton # JSON skeleton for verify_classes.mjs
  parse_css.py FILE|- --summary  # human-readable outline

Record shape (one per selector in a selector list):
  selector   full selector text, e.g. ".card > .title:hover"
  context    selector with its subject replaced by "&", e.g. ".card > &:hover"
  subject    the rightmost compound selector without pseudo parts, e.g. ".title"
  suffix     trailing pseudo-classes/elements, e.g. ":hover"
  at         list of enclosing conditions, e.g. ["@media (min-width: 768px)"]
  group      same number for selectors that came from one "a, b { }" list
  declarations  [{prop, value, important, line}]
  flags      advisory tags such as "combinator", "attribute", "nested"
"""
import json
import re
import sys

GROUP_AT_RULES = {"media", "supports", "container", "layer", "scope", "document"}
UNSUPPORTED_AT_RULES = {
    "charset", "import", "font-face", "keyframes", "-webkit-keyframes",
    "property", "page", "namespace", "counter-style", "font-feature-values",
    "font-palette-values", "view-transition", "position-try", "starting-style",
}


class Parser:
    def __init__(self, text):
        self.s = text
        self.n = len(text)
        self.i = 0
        self.rules = []
        self.unsupported = []
        self.warnings = []
        self.group_counter = 0

    # -- low-level helpers -------------------------------------------------
    def line_of(self, pos):
        return self.s.count("\n", 0, pos) + 1

    def skip_ws_comments(self):
        while self.i < self.n:
            c = self.s[self.i]
            if c.isspace():
                self.i += 1
            elif self.s.startswith("/*", self.i):
                end = self.s.find("*/", self.i + 2)
                if end == -1:
                    self.warnings.append(f"Unterminated comment starting on line {self.line_of(self.i)}")
                    self.i = self.n
                else:
                    self.i = end + 2
            elif self.s.startswith("<!--", self.i) or self.s.startswith("-->", self.i):
                self.i += 4 if self.s.startswith("<!--", self.i) else 3
            else:
                break

    def read_string(self):
        """Consume a quoted string starting at self.i; return raw text."""
        q = self.s[self.i]
        j = self.i + 1
        while j < self.n:
            if self.s[j] == "\\":
                j += 2
                continue
            if self.s[j] == q:
                j += 1
                break
            if self.s[j] == "\n":  # unterminated string ends at newline per CSS spec
                break
            j += 1
        raw = self.s[self.i:j]
        self.i = j
        return raw

    def read_until(self, terminators):
        """Read text until one of `terminators` at nesting depth 0.

        Respects strings, comments, (), [] and url(...) bodies. Returns
        (text_without_comments, terminator_char_or_None). The terminator is
        NOT consumed.
        """
        out = []
        depth = 0
        while self.i < self.n:
            c = self.s[self.i]
            if c in "\"'":
                out.append(self.read_string())
                continue
            if self.s.startswith("/*", self.i):
                end = self.s.find("*/", self.i + 2)
                self.i = self.n if end == -1 else end + 2
                out.append(" ")
                continue
            if c == "\\" and self.i + 1 < self.n:
                out.append(self.s[self.i:self.i + 2])
                self.i += 2
                continue
            if c in "([":
                depth += 1
            elif c in ")]":
                depth = max(0, depth - 1)
            elif depth == 0 and c in terminators:
                return "".join(out), c
            out.append(c)
            self.i += 1
        return "".join(out), None

    def skip_block(self):
        """Consume a balanced {...} block starting at '{'."""
        depth = 0
        while self.i < self.n:
            c = self.s[self.i]
            if c in "\"'":
                self.read_string()
                continue
            if self.s.startswith("/*", self.i):
                end = self.s.find("*/", self.i + 2)
                self.i = self.n if end == -1 else end + 2
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    self.i += 1
                    return
            self.i += 1

    # -- grammar -----------------------------------------------------------
    def parse(self):
        self.parse_block(at=[], parent_selectors=None, top=True)
        return {
            "rules": self.rules,
            "unsupported": self.unsupported,
            "warnings": self.warnings,
        }

    def parse_block(self, at, parent_selectors, top=False):
        """Parse statements until the matching '}' (or EOF when top-level)."""
        decls = []
        while True:
            self.skip_ws_comments()
            if self.i >= self.n:
                if not top:
                    self.warnings.append("Unexpected end of input: missing '}'")
                break
            if self.s[self.i] == "}":
                if top:
                    self.warnings.append(f"Stray '}}' on line {self.line_of(self.i)} ignored")
                    self.i += 1
                    continue
                self.i += 1
                break
            if self.s[self.i] == ";":
                self.i += 1
                continue

            start = self.i
            prelude, term = self.read_until("{;}")
            prelude = prelude.strip()
            line = self.line_of(start)

            if term == "{":
                self.i += 1  # consume '{'
                if prelude.startswith("@"):
                    self.handle_at_block(prelude, at, parent_selectors, line, decls)
                else:
                    self.handle_rule_block(prelude, at, parent_selectors, line)
            else:
                if term == ";":
                    self.i += 1
                if not prelude:
                    continue
                if prelude.startswith("@"):
                    self.handle_at_statement(prelude, line)
                else:
                    d = self.make_declaration(prelude, line)
                    if d:
                        decls.append(d)
        return decls

    def make_declaration(self, text, line):
        if ":" not in text:
            self.warnings.append(f"Line {line}: ignored malformed declaration {text[:60]!r}")
            return None
        prop, value = text.split(":", 1)
        prop = prop.strip()
        value = value.strip()
        important = False
        m = re.search(r"!\s*important\s*$", value, re.I)
        if m:
            important = True
            value = value[: m.start()].rstrip()
        if not prop.startswith("--"):
            prop = prop.lower()
        return {"prop": prop, "value": value, "important": important, "line": line}

    def handle_at_statement(self, prelude, line):
        name = re.match(r"@([\w-]+)", prelude)
        name = name.group(1).lower() if name else prelude
        if name in ("layer",):
            return  # @layer a, b; only declares order
        self.unsupported.append({"kind": "@" + name, "line": line, "text": prelude[:200]})

    def handle_at_block(self, prelude, at, parent_selectors, line, parent_decls):
        m = re.match(r"@([\w-]+)\s*(.*)", prelude, re.S)
        name = m.group(1).lower()
        params = re.sub(r"\s+", " ", m.group(2)).strip()
        if name in UNSUPPORTED_AT_RULES:
            start = self.i - 1
            self.i = start
            self.skip_block()
            self.unsupported.append({"kind": "@" + name, "line": line, "text": prelude[:200]})
            return
        if name in GROUP_AT_RULES:
            cond = f"@{name} {params}".strip()
            new_at = at if name == "layer" else at + [cond]
            if parent_selectors is not None:
                # at-rule nested inside a style rule: its declarations belong to the parent
                inner = self.parse_block(new_at, parent_selectors)
                self.emit(parent_selectors, inner, new_at, line, nested=True)
            else:
                self.parse_block(new_at, None)
            return
        # Unknown at-rule with a block: report, skip safely.
        self.i -= 1
        self.skip_block()
        self.unsupported.append({"kind": "@" + name, "line": line, "text": prelude[:200]})

    def handle_rule_block(self, prelude, at, parent_selectors, line):
        selectors = split_top_level(prelude, ",")
        selectors = [re.sub(r"\s+", " ", s).strip() for s in selectors if s.strip()]
        if parent_selectors:
            resolved = []
            for ps in parent_selectors:
                for s in selectors:
                    resolved.append(s.replace("&", ps) if "&" in s else f"{ps} {s}")
            selectors = resolved
            nested = True
        else:
            nested = False
        decls = self.parse_block(at, selectors)
        self.emit(selectors, decls, at, line, nested=nested)

    def emit(self, selectors, decls, at, line, nested=False):
        if not decls:
            return
        self.group_counter += 1
        for sel in selectors:
            subject, suffix, prefix, flags = analyze_selector(sel)
            if nested:
                flags.append("nested")
            self.rules.append({
                "selector": sel,
                "context": f"{prefix}&{suffix}",
                "subject": subject,
                "suffix": suffix,
                "at": list(at),
                "group": self.group_counter,
                "line": line,
                "declarations": decls,
                "flags": flags,
            })


def split_top_level(text, sep):
    parts, depth, cur, i = [], 0, [], 0
    in_str = None
    while i < len(text):
        c = text[i]
        if in_str:
            cur.append(c)
            if c == "\\" and i + 1 < len(text):
                cur.append(text[i + 1])
                i += 1
            elif c == in_str:
                in_str = None
        elif c in "\"'":
            in_str = c
            cur.append(c)
        elif c in "([":
            depth += 1
            cur.append(c)
        elif c in ")]":
            depth -= 1
            cur.append(c)
        elif c == sep and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    parts.append("".join(cur))
    return parts


def analyze_selector(sel):
    """Return (subject, suffix, prefix, flags) for the rightmost compound selector."""
    flags = []
    depth, in_str, last_comb_end = 0, None, 0
    i = 0
    # find the end index of the last top-level combinator (space, >, +, ~)
    while i < len(sel):
        c = sel[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == in_str:
                in_str = None
        elif c in "\"'":
            in_str = c
        elif c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        elif depth == 0 and c in " >+~":
            j = i
            while j < len(sel) and sel[j] in " >+~":
                j += 1
            last_comb_end = j
            i = j
            continue
        i += 1
    prefix = sel[:last_comb_end]
    compound = sel[last_comb_end:]
    if prefix.strip():
        flags.append("combinator")
    # split subject from first top-level ':' (pseudo-class/element)
    depth, in_str, cut = 0, None, len(compound)
    for k, c in enumerate(compound):
        if in_str:
            if c == in_str:
                in_str = None
            continue
        if c in "\"'":
            in_str = c
        elif c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        elif c == ":" and depth == 0:
            cut = k
            break
    subject, suffix = compound[:cut], compound[cut:]
    if "[" in subject:
        flags.append("attribute")
    if subject.startswith("*") or subject == "":
        flags.append("universal")
    if len(re.findall(r"[.#]", re.sub(r"\[[^\]]*\]", "", subject))) > 1:
        flags.append("compound")
    return subject, suffix, prefix, flags


def build_skeleton(parsed):
    """Group rules by prefix+subject so one Tailwind class list covers all variants."""
    items = {}
    for r in parsed["rules"]:
        prefix = r["context"].split("&")[0]
        key = f"{prefix}{r['subject']}"
        item = items.setdefault(key, {"id": key, "classes": "", "source": [], "flags": set()})
        item["flags"].update(r["flags"])
        for d in r["declarations"]:
            item["source"].append({
                "prop": d["prop"], "value": d["value"], "important": d["important"],
                "context": r["context"],
                "at": r["at"], "line": d["line"],
            })
    out = []
    for it in items.values():
        it["flags"] = sorted(it["flags"])
        out.append(it)
    return {"prefix": "", "version": None, "items": out,
            "unsupported": parsed["unsupported"], "warnings": parsed["warnings"]}


def summary(parsed):
    lines = []
    for r in parsed["rules"]:
        at = " ".join(r["at"])
        head = f"{at} {r['selector']}".strip()
        flags = f"  [{', '.join(r['flags'])}]" if r["flags"] else ""
        lines.append(f"{head}{flags}")
        for d in r["declarations"]:
            imp = " !important" if d["important"] else ""
            lines.append(f"    {d['prop']}: {d['value']}{imp}")
    for u in parsed["unsupported"]:
        lines.append(f"UNSUPPORTED {u['kind']} (line {u['line']}): {u['text']}")
    for w in parsed["warnings"]:
        lines.append(f"WARNING: {w}")
    return "\n".join(lines)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    flags = {a for a in argv[1:] if a.startswith("--")}
    if not args:
        print(__doc__)
        return 2
    path = args[0]
    text = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    parsed = Parser(text).parse()
    if "--summary" in flags:
        print(summary(parsed))
    elif "--skeleton" in flags:
        print(json.dumps(build_skeleton(parsed), indent=2))
    else:
        print(json.dumps(parsed, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
