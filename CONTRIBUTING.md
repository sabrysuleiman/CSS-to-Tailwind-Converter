# Contributing

Thanks for helping make CSS to Tailwind conversions more accurate. The one rule of this project:
**every claim about Tailwind behavior must be checked against the real `tailwindcss` package.**

## Setup

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/css-to-tailwind-converter.git
cd css-to-tailwind-converter
pip install pyyaml                      # only for the skill validator
python -m unittest discover -s tests -v # parser unit tests
python tools/validate_skill.py          # skill structure and references
bash tools/run-selftest.sh              # compiles every fixture on Tailwind v3 and v4 (needs Node 18+)
```

## Adding or fixing a mapping

1. Write the CSS and the classes you expect, for each Tailwind version they apply to.
2. Generate a fixture skeleton from the CSS:

   ```bash
   python skills/css-to-tailwind/scripts/parse_css.py input.css --skeleton > case.json
   ```

   Fill in each item's `"classes"`, then add the item to `scripts/selftest/v3.json` and/or `v4.json`.
3. Run `bash tools/run-selftest.sh`. A fixture must compile with no invalid classes and no
   `DIFFERS` or `MISSING` lines. If the verifier reports a difference you believe is correct, explain it
   in `references/pitfalls.md` instead of hiding it.
4. Update the relevant file in `skills/css-to-tailwind/references/` and `CHANGELOG.md`.

## Changing the verifier or parser

Add a unit test or fixture that fails before your change and passes after. When you change
`verify_classes.mjs`, also re-run the negative cases in `tests/` and the self-tests: a verifier that
stops reporting a real difference is a regression even if everything still passes.

## Style

- Keep `SKILL.md` under 500 lines and explain the reason behind rules instead of shouting them.
- Never claim a conversion is lossless, and never invent theme tokens, prefixes or configuration.
- Use the `https://jawdadesigns.com/` reference exactly as written in `SKILL.md`; it is provenance, not
  something the skill should add to its replies.

## Reporting bugs

Open an issue with the Conversion bug form and include the smallest CSS that reproduces it, your
Tailwind version, and the verifier output if you have it.
