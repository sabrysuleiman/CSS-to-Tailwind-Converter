# Variants, selectors and at-rules

Everything here was compiled against Tailwind 3.4.19 and 4.3.3. Differences are called out.

## Contents
- [Core idea: classes go on the subject element](#core-idea-classes-go-on-the-subject-element)
- [Pseudo-classes and pseudo-elements](#pseudo-classes-and-pseudo-elements)
- [Variant order](#variant-order)
- [Media queries](#media-queries)
- [@supports, @container, @layer](#supports-container-layer)
- [Combinators, attributes and complex selectors](#combinators-attributes-and-complex-selectors)
- [Things that are not utility classes](#things-that-are-not-utility-classes)
- [Cascade and specificity](#cascade-and-specificity)

## Core idea: classes go on the subject element

A utility class always styles the element that carries it. So a CSS rule maps to the classes of its **subject**, the rightmost compound selector (`.card > .title:hover` has subject `.title`). Pseudo-classes, pseudo-elements and media queries become **variants** on those classes.

Group all rules that share a subject into one output block, in source order: `.btn`, `.btn:hover` and `@media (min-width: 768px) { .btn { ... } }` become one class list for `.btn`. Keep unrelated subjects separate. Selector lists (`.a, .b { ... }`) share one class list: say so once.

What sits **left of the subject** (an ancestor, parent or earlier sibling) can be handled three ways. Default to the first and say so once in the notes.

| Form | `.card img { width: 100% }` becomes | Use when |
|---|---|---|
| **Element** (default) | `w-full` on the `<img>` | The user controls the markup, which is the usual case. State that scoping to `.card` is dropped. |
| **Scoped** | `[.card_&]:w-full` on the `<img>` | The rule must apply only inside `.card`, or the user wants exact cascade fidelity. Every class needs the variant, so lists get long. |
| **Parent** | `[&_img]:w-full` on the `.card` element | The children cannot carry classes (CMS or rich-text output), or the user prefers styling from the container. |

`scripts/parse_css.py --skeleton` groups rules by subject (the item `id` includes the left context, such as `.card img`) and records each rule's `context` (`&:hover`, `.card &`, ...). `verify_classes.mjs` accepts element form and scoped form for those items.

## Pseudo-classes and pseudo-elements

| CSS | Variant (both versions unless noted) |
|---|---|
| `:hover` `:focus` `:active` `:visited` `:target` | `hover:` `focus:` `active:` `visited:` `target:` |
| `:focus-visible` `:focus-within` | `focus-visible:` `focus-within:` |
| `:disabled` `:enabled` `:checked` `:required` `:invalid` `:read-only` `:empty` `:indeterminate` | `disabled:` `enabled:` `checked:` `required:` `invalid:` `read-only:` `empty:` `indeterminate:` |
| `:first-child` `:last-child` `:only-child` | `first:` `last:` `only:` |
| `:nth-child(odd)` / `(even)` | `odd:` / `even:` |
| `:nth-child(2n+1)` | v4 `nth-[2n+1]:`; v3 `[&:nth-child(2n+1)]:` |
| `:not(.x)` | v4 `not-[.x]:`; v3 `[&:not(.x)]:` (works in v4 too) |
| `:is(.a, .b)`, `:where()` | `[&:is(.a,.b)]:` |
| `:has(> img)` | `has-[>img]:` |
| `::before` / `::after` | `before:` / `after:` (they add `content: ""` automatically, so a source `content: ""` needs no extra class; a non-empty content needs `before:content-['x']`) |
| `::placeholder` `::selection` `::marker` `::first-line` `::first-letter` `::file-selector-button` | `placeholder:` `selection:` `marker:` `first-line:` `first-letter:` `file:` |
| `[aria-expanded="true"]` | `aria-[expanded=true]:` (or `aria-expanded:` for `=true`) |
| `[data-state="open"]` | `data-[state=open]:` |
| `[open]` (details, dialog) | `open:` |
| `[dir="rtl"]` | `rtl:` (and `ltr:`) |

Not interchangeable: `[disabled]` (attribute) is not `:disabled` (state). Use `[&[disabled]]:` for the attribute form.

## Variant order

Write variants in the order a person would read the selector, pseudo-class first, pseudo-element last:

- `.btn:hover::after` becomes `hover:after:...`.
- **In v4, `after:hover:flex` drops the `display` rule** (it would need `::after:hover`, which is not valid CSS) and only emits `content: ""`. v3 reorders it for you, but the `hover:after:` order is correct in both, so always use it.
- Stacked media and state variants nest and can go in any order (`dark:md:hover:`, `md:dark:` both work). Put breakpoint first by convention: `md:hover:`.
- Chained variants each apply: `md:hover:bg-[#2563eb]` is `@media (min-width: 768px) { .x:hover { ... } }`.

v4 only: `hover:` is wrapped in `@media (hover: hover)`. Mention it once when converting `:hover` for v4 (see `tailwind-versions.md`).

## Media queries

| CSS condition | Variant |
|---|---|
| `(min-width: 640px)` / `768` / `1024` / `1280` / `1536` | `sm:` / `md:` / `lg:` / `xl:` / `2xl:` (exact pixel matches only) |
| `(min-width: 900px)` | `min-[900px]:` |
| `(max-width: 767px)` | `max-md:` is "below md" (below 768px). Use it only when the source is `max-width: 767px` (or 767.98px). For any other max-width: `max-[899px]:`. `max-width: 768px` is **not** `max-md:` |
| `(min-width: 768px) and (max-width: 1023px)` | `md:max-lg:` (stacked, same meaning); other ranges `min-[...]:max-[...]:` |
| `(prefers-color-scheme: dark)` | `dark:` when the project uses the default media strategy. If the project toggles dark mode with a class or attribute, say that `dark:` follows that setting instead |
| `(prefers-reduced-motion: reduce)` / `no-preference` | `motion-reduce:` / `motion-safe:` |
| `print` | `print:` |
| `(orientation: portrait)` / `landscape` | `portrait:` / `landscape:` |
| `(prefers-contrast: more)` | `contrast-more:` |
| `(forced-colors: active)` | `forced-colors:` |
| `(pointer: coarse)` | v4 `pointer-coarse:`; v3 `[@media(pointer:coarse)]:` |
| any other feature | `[@media(hover:hover)]:`, `[@media(min-resolution:2dppx)]:` (no spaces inside the brackets) |

`@media screen and (min-width: 768px)`: the `screen` media type is not representable with `md:`. Treat as `md:` only if the user accepts dropping `screen`, and say so.

## @supports, @container, @layer

- `@supports (display: grid)` becomes `supports-[display:grid]:` (both versions).
- `@container (min-width: 400px)`: v4 `@[400px]:` on the child, and the ancestor needs the `@container` class. v3 needs the `@tailwindcss/container-queries` plugin; if the user does not have it, report as needing custom CSS. A **named** container (`@container sidebar (min-width: 400px)`) needs `@container/sidebar` and `@[400px]/sidebar:` in v4.
- `@layer base|components|utilities { ... }`: convert the contents, but state that cascade-layer ordering is not preserved by utilities.

## Combinators, attributes and complex selectors

Arbitrary variants express selector context with `&` standing for the element that carries the class; a space (descendant combinator) is written `_`. These are the **scoped** and **parent** recipes; the default is the element form from the table above.

| CSS | Scoped form (on the subject) | Parent form (on the container) |
|---|---|---|
| `.card .title { margin: 0 }` | `[.card_&]:m-0` | `[&_.title]:m-0` |
| `.card > .title { margin: 0 }` | `[.card>&]:m-0` | `[&>.title]:m-0` |
| `.a + .b { margin-top: 8px }` | `[.a+&]:mt-2` | (not applicable: the sibling is the subject) |
| `.item:not(.active) { opacity: .5 }` | v4 `not-[.active]:opacity-50`; v3 `[&:not(.active)]:opacity-50` | |
| `a[href^="http"] { text-decoration: underline }` | `[&[href^='http']]:underline` | `[&_a[href^='http']]:underline` |

These carry no ancestor and need no choice of form:

| CSS | Classes |
|---|---|
| `.group:hover .icon { color: red }` | `group-hover:text-[red]` on `.icon`, and `group` on the `.group` element (a markup change; say so) |
| `input:checked + label { ... }` | `peer-checked:...` on the label and `peer` on the input (a markup change; say so) |

Selectors that name no class (`body`, `h1`, `*`, `:root`, `html`) can still get classes (to put on that element), but they usually belong in a base layer. Offer `@layer base { h1 { @apply ... } }` only if asked; otherwise convert and note where the classes must be applied.

## Things that are not utility classes

State these separately in the "Not converted" section of the report, with the CSS kept verbatim. Never fold them into the class list.

| Construct | What to do |
|---|---|
| `@charset` | Drop it. UTF-8 is already the default for CSS served as UTF-8; say you dropped it. |
| `@import` | Keep as CSS (v4: `@import` rules stay at the top of the stylesheet). |
| `@font-face` | Keep as CSS. v4: declare the family as a token to get a utility: `@theme { --font-display: "MyFont", sans-serif; }` then `font-display`. v3: `theme.extend.fontFamily`. |
| `@keyframes` + `animation` | Keep the keyframes in CSS and reference them: `animate-[wiggle_1s_ease-in-out_infinite]`. Or register them. v4: `@theme { --animate-wiggle: wiggle 1s ease-in-out infinite; @keyframes wiggle { ... } }` gives `animate-wiggle`. v3: `theme.extend.keyframes` and `theme.extend.animation`. Tailwind ships only `spin`, `ping`, `pulse`, `bounce`. |
| `@property` | Keep as CSS. |
| `@page`, `@namespace`, `@counter-style`, `@view-transition`, `@starting-style`, `@scope` | Keep as CSS, or an arbitrary variant when the condition is simple (`starting:` exists in v4). Report as needing custom CSS if unsure. |
| `:root { --brand: ... }` custom properties | Keep as CSS. Utilities can reference them (`bg-[var(--brand)]`). In v4, offer `@theme { --color-brand: ... }` to turn them into real utilities, only if asked. |
| Custom-property **definitions** inside a rule (`.card { --gap: 8px }`) | `[--gap:8px]` is a valid arbitrary property class. |

Remind the user about parser-level hazards when they are present in the input: data URLs with `;`, `url()` bodies, comments inside values, unterminated braces. `parse_css.py` handles them; report the ones it warns about.

## Cascade and specificity

Utilities are single-class selectors (specificity 0,1,0) and their order in the generated stylesheet is Tailwind's, not the source order. A source rule like `#nav a:hover` (1,1,1) used to beat other rules by specificity; as classes it no longer does. Two source rules that targeted the same property with different specificity, or relied on source order, may resolve differently. When the input contains such conflicts, point at the conflict and, where it matters, use `!important`/`!` explicitly rather than assume the cascade survives.
