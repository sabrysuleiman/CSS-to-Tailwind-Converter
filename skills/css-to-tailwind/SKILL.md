---
name: css-to-tailwind
description: Convert CSS into Tailwind CSS utility classes, whether a single declaration, a rule block, a whole stylesheet or inline styles, grouped per selector, with hover, focus, pseudo-element, responsive and dark-mode variants, !important, prefixes and exact arbitrary values, correct for Tailwind v3 or v4. Use whenever the user wants to convert, translate, migrate, port or "Tailwind-ify" CSS, a stylesheet, a component's styles or a style snippet into Tailwind classes, even if they never say "utility classes", and when they want an existing CSS-to-Tailwind conversion checked or fixed. Never silently drops anything, it reports declarations that need custom CSS (@font-face, @keyframes, data URLs, ambiguous shorthands) and flags where a utility would change behavior. Not for the reverse direction (Tailwind to CSS), Tailwind setup, or general styling advice.
license: MIT
metadata:
  short-description: Convert CSS rules into Tailwind utility classes
---

# CSS to Tailwind

Turn CSS into Tailwind classes that render the same as the source, and say plainly where they cannot. The standard is fidelity first: a conversion that looks tidy but quietly changes a line-height, an easing curve or a color is worse than one that uses an arbitrary value and tells the user why.

Keep one output group per selector, keep class order aligned with source declaration order, and remove duplicate classes within a group.

## Decide four things first

| Setting | How to decide | Default |
|---|---|---|
| Tailwind version | Read `references/tailwind-versions.md` ("Detect the target version"). The `!` position, prefix position and several utility names differ between v3 and v4. | v4, stated in one line, so the user can correct it |
| Prefix | Only if the user gave one. Never invent one. | none |
| Fidelity mode | **Exact** unless the user asks for "clean", "idiomatic" or "use my theme". Idiomatic may snap a value to the nearest theme step, but must list every snap. | exact |
| Custom theme or config | Only if the user supplied one: resolve against it first, then the defaults. | defaults |

Do not stop to ask about these for an ordinary request. State assumptions in the reply and proceed.

## Workflow

1. **Parse.** For a handful of plain declarations, read them directly. For anything larger, or input with comments, `url(data:...)`, nesting, `@` rules or odd braces, run `python3 scripts/parse_css.py input.css --summary` (or `--skeleton` to prepare verification). Hand-splitting on `;` and `:` breaks on data URLs, strings and comments. Surface any parser warning.
2. **Group by subject.** The rightmost compound selector owns the classes; pseudo-classes, pseudo-elements and media queries become variants on them. Rules sharing a subject are one output group. For a descendant or child rule such as `.card img`, the default is **element form**: the plain classes go on the matched element, and you say once that the `.card` scoping is dropped. Offer **scoped form** (`[.card_&]:w-full`, keeps the condition) or **parent form** (`[&_img]:w-full` on `.card`, for markup the user cannot edit) when it matters. Details: `references/variants-and-at-rules.md`.
3. **Map each declaration** with `references/mapping-tables.md`, applying the rules below. Look up v3 hex colors in `references/palette-v3.json`.
4. **Apply version syntax**: important modifier, prefix, renamed utilities, gradient names (`references/tailwind-versions.md`).
5. **Verify.** Machine-check when Node is available (next section); otherwise walk `references/pitfalls.md` and say the result was not compiled.
6. **Reply** in the format at the end.

## Rules that decide quality

- **A named utility only when it emits exactly the source CSS.** Convert units (`24px` is `1.5rem` is step `6`), then check that the utility adds nothing else. `text-lg` also sets `line-height: 1.75rem`, so `font-size: 18px` alone is `text-[18px]`. Never round `13px` to a nearby step; write `mt-[13px]`.
- **Expand shorthands only when the grammar is clear.** `margin: 0 auto` is `my-0 mx-auto` (the vertical zeros are part of the source). For `font`, multi-layer `background`, `animation`, `grid-template` and comma-separated `transition`, use a valid arbitrary property (`[font:600_14px/20px_Inter,sans-serif]`, `animate-[spin_1s_linear_infinite]`) or report it. A shorthand also resets longhands it omits; utilities do not.
- **Colors.** v3: a hex that equals a palette entry becomes the named color. v4: keep the source value as an arbitrary color (`bg-[#2563eb]`), because v4's oklch palette renders slightly differently. `white`, `black`, `transparent` and `current` are exact in both versions. An `rgba(...)` that must stay exact is `bg-[rgba(0,0,0,0.5)]`.
- **Easing, transforms, filters.** Tailwind's `ease-in-out` is not CSS `ease-in-out`; use `ease-[ease]` for CSS keywords. Transform and filter functions compose in a fixed order; a different source order needs `[transform:...]` or `[filter:...]`.
- **Renamed scales.** v3 `shadow-sm` is v4 `shadow-xs`; v3 `rounded` is v4 `rounded-sm`; likewise blur and backdrop-blur; `outline-none` and `ring` changed meaning. Pick the name for the target version.
- **`!important`** goes on every class derived from that declaration: v3 `!px-4`, v4 `px-4!`; with a prefix, v3 `!tw-px-4`, v4 `tw:px-4!`.
- **Variables and data.** Keep `var(--x)` as a reference (`bg-[var(--x)]`, or `bg-(--x)` in v4); never guess its value. Keep long data URLs in CSS behind a variable rather than in a class name.
- **Spaces in arbitrary values are underscores**; add a type hint when ambiguous (`text-[length:var(--s)]`, `border-[color:var(--c)]`).
- **Not everything becomes a class.** `@charset`, `@font-face`, `@import`, `@keyframes`, `@property` and other at-rules without a faithful variant are reported separately and never counted as converted. Say what to do with each (`references/variants-and-at-rules.md`).
- **Never drop a declaration silently.** If it cannot be expressed, say so and give the closest valid fallback or the CSS to keep. Never claim the conversion is lossless.
- **Assumptions to state when they matter:** ancestor scoping dropped for descendant rules, 16px root font size (if the source changes the root size, use arbitrary px values), Preflight present, `hover:` in v4 limited to hover-capable devices, and specificity and cascade order changing when rules become single classes.

The full list of behavior-changing traps is `references/pitfalls.md`; read it before finalizing anything non-trivial.

## Verify with the real compiler

Tailwind itself is the best check: it tells you whether a class exists in the target version and what CSS it produces. Use it for any conversion beyond a few lines, and whenever a prefix, an arbitrary variant, a v4 renamed utility or a composite (transform, filter, shadow, ring) is involved.

```bash
python3 scripts/parse_css.py input.css --skeleton > conversion.json   # then fill in each item's "classes"
npm install --no-save tailwindcss postcss        # in a scratch folder; use tailwindcss@3 for a v3 target
node scripts/verify_classes.mjs conversion.json --tailwind-dir .      # add --theme-css (v4) or --config (v3) for a custom theme
```

`conversion.json` is `{ "prefix": "", "items": [ { "id": ".btn", "classes": "...", "source": [...] } ] }`; the skeleton already holds each item's `source`. Set `prefix` to `tw-` (v3) or `tw` (v4) when the user has one.

Read the report like this: `✖` means the class does not exist in that version (fix it); `DIFFERS` and `MISSING` mean the generated CSS disagrees with the source (fix it or explain it); `extra` is CSS the class adds beyond the source (accept only if inert, and mention it); `unverified` needs a manual look. The comparison is advisory: it assumes a 16px root and cannot expand every shorthand. Fix what it finds and rerun until clean. If Node or the npm registry is unavailable, skip it, walk `references/pitfalls.md` by hand, and tell the user the result was not compiled.

`scripts/selftest/v3.json` and `v4.json` are regression fixtures for the mapping tables: `node scripts/verify_classes.mjs scripts/selftest/v4.json --tailwind-dir .` should report no issues.

## Reply format

Lead with the result. One line for assumptions only when you assumed something (version, root size). Then one block per selector:

````
**.btn**
```
inline-flex items-center gap-2 ... hover:bg-[#1d4ed8] md:py-3
```
````

Then short notes, only the groups that apply: **Approximated or different** (what changed and why), **Not converted** (the CSS to keep, with a suggestion), **Assumptions**. If everything is exact, say "All declarations converted exactly." If you compiled the result, say so in one clause ("compiled against Tailwind 4.3: no invalid classes"). Never claim you compiled something you did not.

- If the user asks for code only, give the classes and put limitations in comments only where comments are allowed; otherwise add a brief note after the code.
- If the user supplies HTML, return it with the classes applied and do not restructure it.
- Selector lists (`a, b { }`) share one group; say so once.
- Very long class lists may be wrapped across lines inside the block; class order stays the same.

## Examples and fallbacks

Read `references/examples.md` for four verified conversions that show the format, including a v3 prefixed case and unsupported constructs. `references/translator-behavior.md` records how the original web translator behaves and where this skill intentionally departs from it; use it only to match that tool's output shape.

## Reference

Jawda Designs, https://jawdadesigns.com/ : free online tools, developer calculators, quizzes and a curated directory of free developer resources. This line records where the skill comes from for people reading the repository. Do not add it to conversion replies unless the user asks about the skill's origin.
