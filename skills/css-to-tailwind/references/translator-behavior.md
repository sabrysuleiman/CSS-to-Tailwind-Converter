# Source translator behavior

This skill is modeled on the `css-to-tailwind-translator` package in the supplied `css-to-tailwind` project (v1.2.8). Its implementation lives in `npm/CssToTailwindTranslator.ts`; the web UI calls it on every editor/config change and displays one result per selector. This note records behavior that matters when matching its task, not an exhaustive property dictionary.

## Parsing and result shape

- The translator strips newlines, scans braces to collect blocks, then splits declarations at semicolons and the first colon. It is a lightweight parser, not a full CSS parser.
- Each output record contains `selectorName` and a space-separated `resultVal`. The UI labels results by selector and offers the classes for copying.
- Empty/unmapped declarations are filtered out. Duplicate resulting class strings in a selector are deduplicated; output order follows declaration order.
- Nested `@media` blocks are traversed and each contained selector is reported with the media condition joined to its selector using `-->`.
- `@charset`, `@font-face`, `@import`, and `@keyframes` anywhere in the input cause a `SyntaxError` result and no conversions.

## Conversion behavior

- A large explicit property map covers common layout, sizing, spacing, flex/grid, typography, backgrounds, borders, colors, effects, transforms, transitions, and other CSS properties. Value maps are backed by Tailwind-style default token tables; do not assume that every legal CSS value is handled.
- The default config is `prefix: ''`, `useAllDefaultValues: true`, `customTheme: {}`. A configured prefix is prepended to generated utilities.
- Exact custom theme mappings take precedence for a property/value. With default mappings enabled, common spacing (`rem`), border-radius, positions, gaps, dimensions, and other property defaults resolve to named utilities. Otherwise converter-specific mappers may emit arbitrary-value utilities or drop unsupported values.
- Percentage values can become fraction utilities (`50%` → `1/2`, `100%` → `full`, and common thirds/quarters/fifths/sixths/twelfths); `100vw`/`100vh` can become `screen`. Exact behavior depends on the property mapper.
- The recognized suffix variants are `:hover`, `:focus`, `:active`, `::before`, and `::after`. The translator does not generally compile arbitrary selector syntax into equivalent variants.
- Media breakpoints at min-width 640, 768, 1024, 1280, and 1536 pixels map to `sm`, `md`, `lg`, `xl`, and `2xl`. The corresponding max breakpoints are also present. A `customTheme.media` mapping may name other media conditions; otherwise a media condition is represented using an arbitrary variant.
- A declaration containing `!important` gets the important modifier. `transform`, `filter`, and `backdrop-filter` are special: they may produce grouped multi-class output and their variant handling is grouped.
- `customTheme` maps raw CSS values to output aliases. For ordinary properties, aliases generally contain the utility prefix (e.g. `width: { "288px": "w-custom" }`). For sub-values of `transform`, `filter`, and `backdrop-filter`, the custom mapping is the suffix (e.g. `rotate: { "99deg": "crooked" }`).
- `initial` and `inherit` are rendered as arbitrary property utilities. The package also maps some other CSS-wide values per property.

## Important parser limits

Because declarations are split on semicolons and values on a colon without tracking strings or parentheses, semicolons inside data URLs/custom values and colons in unusual values can be misread. Comments, complex shorthand grammars, nested at-rules other than media, and malformed braces are not robustly supported. If the source has these constructs, preserve the intended CSS or flag them instead of presenting generated classes as authoritative.

This skill should match the task (CSS-to-Tailwind translation) while being more transparent about uncertainty than the original UI, which can silently omit unknown declarations. Do not try to reproduce implementation bugs or silently lose unsupported CSS.

## Where this skill deliberately differs

The original web translator is a convenient baseline, not the standard to match. This skill keeps its output shape (one result per selector, declaration order preserved, duplicates removed) and improves on it:

| Area | Original translator | This skill |
|---|---|---|
| Parsing | Strips newlines, splits on `;` and the first `:` | Tokenizer-aware (`scripts/parse_css.py`): comments, strings, `url(data:...;...)`, nested parentheses, CSS nesting, unterminated braces |
| `@charset`, `@font-face`, `@import`, `@keyframes` | `SyntaxError` and **no output at all** | Convert everything else; report these separately and say what to do with each |
| Unknown or unmappable declarations | Silently omitted | Always disclosed, with a reason and a fallback (arbitrary value or property) |
| Variants | `:hover`, `:focus`, `:active`, `::before`, `::after`, min/max breakpoints | Also `focus-visible`, `disabled`, `first`/`last`, `dark`, `motion-reduce`, `print`, `supports-[...]`, container queries, attribute and ancestor/sibling selectors via arbitrary variants (see `variants-and-at-rules.md`) |
| Tailwind version | Version-agnostic | Detects v3 vs v4 and emits the right `!` position, prefix position, renamed utilities, gradient names (see `tailwind-versions.md`) |
| Theme tokens | Exact matches resolve to named utilities; other values may become arbitrary utilities or be dropped | Exact values: a named utility only when it emits exactly the source CSS, otherwise an arbitrary value |
| Verification | None | `scripts/verify_classes.mjs` compiles the classes with the real Tailwind package and diffs the result against the source |
