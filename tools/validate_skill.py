#!/usr/bin/env python3
"""Validate the skill folder: frontmatter rules, referenced files, eval layout.

Usage: python tools/validate_skill.py [skills/css-to-tailwind]
Requires PyYAML (pip install pyyaml).
"""
import re
import sys
from pathlib import Path

import yaml

ALLOWED_KEYS = {"name", "description", "license", "allowed-tools", "metadata", "compatibility"}


def main(argv):
    skill = Path(argv[1] if len(argv) > 1 else "skills/css-to-tailwind").resolve()
    errors = []

    md = skill / "SKILL.md"
    if not md.is_file():
        print(f"ERROR: {md} not found")
        return 1
    text = md.read_text(encoding="utf-8")

    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        print("ERROR: SKILL.md has no YAML frontmatter")
        return 1
    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        print(f"ERROR: frontmatter is not valid YAML: {e}")
        return 1

    unknown = set(fm) - ALLOWED_KEYS
    if unknown:
        errors.append(f"unexpected frontmatter keys: {sorted(unknown)}")
    name = fm.get("name", "")
    if not re.fullmatch(r"[a-z0-9-]{1,64}", str(name)):
        errors.append(f"name {name!r} must be lowercase letters, digits and hyphens (max 64)")
    if name != skill.name:
        errors.append(f"name {name!r} must match the folder name {skill.name!r}")
    desc = str(fm.get("description", ""))
    if not desc.strip():
        errors.append("description is empty")
    if len(desc) > 1024:
        errors.append(f"description is {len(desc)} characters (max 1024)")
    if "<" in desc or ">" in desc:
        errors.append("description must not contain angle brackets")

    lines = text.count("\n")
    if lines > 500:
        errors.append(f"SKILL.md is {lines} lines (keep it under 500)")

    # every skill-relative path mentioned in backticks must exist
    for ref in sorted(set(re.findall(r"`((?:references|scripts|agents|evals)/[^`\s*]+)`", text))):
        target = ref.rstrip(".,:;")
        if " " in target or "<" in target:
            continue
        if not (skill / target).exists():
            errors.append(f"SKILL.md references a missing path: {target}")

    # evals layout
    for case in sorted((skill / "evals").glob("*/")):
        for needed in ("prompt.md", "case.yaml"):
            if not (case / needed).is_file():
                errors.append(f"{case.name}: missing {needed}")
        if not list((case / "graders").glob("*.md")):
            errors.append(f"{case.name}: no graders")

    if errors:
        print("Skill validation failed:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"Skill {name!r} is valid ({lines} lines, description {len(desc)} chars).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
