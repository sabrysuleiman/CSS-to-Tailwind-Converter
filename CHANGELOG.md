# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-31

First public release.

### Added
- Version-aware CSS to Tailwind conversion for **Tailwind CSS v3 and v4**: `!important` position,
  prefix position, renamed utilities (`shadow`, `rounded`, `blur`, `outline`, `ring`) and gradient names.
- Exact-value rules: a named utility is used only when it emits exactly the source CSS; everything
  else becomes an arbitrary value. Covers the `text-*` line-height coupling, easing keywords,
  `margin: 0 auto`, transform and filter order, `grid-cols-N` and the v4 oklch palette shift.
- Variant mapping for pseudo-classes, pseudo-elements, media, `@supports` and container queries,
  attribute and combinator selectors (element, scoped and parent forms).
- Honest reporting of constructs that cannot become classes (`@font-face`, `@keyframes`, `@import`,
  `@charset`, data URLs, ambiguous shorthands).
- `parse_css.py`: tokenizer-aware CSS parser (comments, strings, `url(data:...;...)`, nesting,
  broken braces).
- `verify_classes.mjs`: compiles converted classes with the real `tailwindcss` package (v3 or v4) and
  diffs the result against the source CSS.
- Reference library (version differences, mapping tables, variants and at-rules, pitfalls, verified
  examples, v3 palette lookup), 30 mapping self-test fixtures per Tailwind version, and five evals.
- Unit tests, a skill validator and GitHub Actions CI that runs the self-tests on Tailwind 3.4.19 and 4.3.3.
