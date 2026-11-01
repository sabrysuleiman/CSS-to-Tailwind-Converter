# Fidelity pitfalls

Each item is a place where a plausible-looking conversion changes behavior. Items 1-12 are the ones `scripts/verify_classes.mjs` detects automatically (it reports them as `extra`, `DIFFERS`, `MISSING`). Work through the list before finalizing any conversion with more than a handful of declarations.

## Contents
- [Utilities that bring extra or different CSS](#utilities-that-bring-extra-or-different-css)
- [Shorthands and implicit resets](#shorthands-and-implicit-resets)
- [Units and the root font size](#units-and-the-root-font-size)
- [Environment assumptions](#environment-assumptions)
- [Input-level hazards](#input-level-hazards)

## Utilities that bring extra or different CSS

1. **`text-*` sets `line-height`.** `text-lg` is `font-size: 1.125rem; line-height: 1.75rem`. `font-size: 18px` alone is `text-[18px]`. A pair like `font-size: 14px; line-height: 20px` is exactly `text-sm`. When a source declares font-size and a *different* line-height, use `text-[14px] leading-[22px]` (or `text-sm/[22px]`), not `text-sm leading-...` mixed carelessly.
2. **Easing keywords differ.** Tailwind `ease-in-out` is `cubic-bezier(0.4,0,0.2,1)`; CSS `ease-in-out` is `cubic-bezier(0.42,0,0.58,1)`; CSS `ease` is `cubic-bezier(0.25,0.1,0.25,1)`. Map `cubic-bezier(0.4,0,0.2,1)` to `ease-in-out`, `linear` to `ease-linear`, and any CSS keyword with an arbitrary value (`ease-[ease]`).
3. **Transition utilities set a timing function too.** `transition-all duration-300` brings `cubic-bezier(0.4,0,0.2,1)`. A source `transition: all .3s` (no easing) means CSS `ease`, so add `ease-[ease]` to keep it exact.
4. **`transition-colors` is a property list**, not just `color`: color, background-color, border-color, text-decoration-color, fill, stroke. Use it only when the source lists those properties; for a single property use `transition-[color]` (arbitrary `transition-property`).
5. **`truncate` is three declarations** (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`). Use it only when all three are in the source; a lone `text-overflow: ellipsis` is `text-ellipsis`.
6. **`margin: 0 auto` also sets vertical margins to 0.** Emit `my-0 mx-auto`. Dropping the zeros leaves vertical margins to whatever else applies.
7. **`grid-cols-N` is `repeat(N, minmax(0, 1fr))`.** `repeat(3, 1fr)` is subtly different (columns can grow past the container). Use `grid-cols-[repeat(3,1fr)]` when the source has plain `1fr`.
8. **`rounded-full` is 9999px**, not `50%`. Use `rounded-[50%]` for ellipses and exact percentages.
9. **`max-w-sm` is 24rem (384px), not the `sm` breakpoint.** `max-width: 640px` is `max-w-screen-sm` (or `max-w-[640px]`).
10. **`font-sans`, `font-serif`, `font-mono` are Tailwind's own stacks.** A source font stack is an arbitrary value: `font-[Inter,system-ui,sans-serif]`. Names with spaces use underscores: `font-['Helvetica_Neue',Arial]`.
11. **Outline.** v3 `outline-none` is `outline: 2px solid transparent; outline-offset: 2px` (keeps a forced-colors outline), not `outline: none`. v4 `outline-none` is `outline-style: none`; the old behavior is `outline-hidden`. For a literal `outline: none` in v3 use `[outline:none]`.
12. **Transform and filter composition.** Utilities compose in a fixed order (translate, rotate, skew, scale; blur, brightness, contrast, grayscale, hue-rotate, invert, saturate, sepia, drop-shadow). A source list in another order (`rotate(45deg) translateX(10px)`) cannot be reproduced with utilities: use `[transform:rotate(45deg)_translateX(10px)]` and say why.
13. **v4 palette is not the v3 palette.** Hex colors stay arbitrary in v4 (`bg-[#3b82f6]`); see `tailwind-versions.md`.
14. **`before:` and `after:` add `content: ""` automatically**, so a pseudo-element rule whose source has no `content` gains one. Mention it if the pseudo-element is not meant to render.
15. **Default border color differs** (v3 gray-200, v4 currentcolor). A source `border: 1px solid` means currentcolor: v3 needs `border-current`.
16. **Vendor prefixes.** Tailwind adds prefixes itself. Drop `-webkit-`/`-moz-` duplicates when the standard property is also present and say so. Prefixed-only properties: `-webkit-font-smoothing: antialiased` is `antialiased` (it also emits the `-moz-osx` line); `-webkit-tap-highlight-color` has no utility: `[-webkit-tap-highlight-color:transparent]`.

## Shorthands and implicit resets

17. **A shorthand resets the longhands it omits.** `background: #fff` also resets `background-image`, `background-repeat` and the rest to initial values; `bg-white` does not. `border: 1px solid` resets color. When the source relied on that reset to override an earlier rule, flag it.
18. **Expand a shorthand only when its grammar is clear.** Safe: `margin`, `padding`, `inset`, `gap`, `overflow`, `border-width/style/color`, `border-radius` without `/`, a single-color `background`, a single `transition` without commas, and `flex: <n> <n> <basis>`. Ambiguous or compound: `font`, `background` with several layers, `animation`, `grid-template`, `mask`, `border-image`, comma-separated `transition`. For those use an arbitrary property (`[font:600_14px/20px_Inter,sans-serif]`, `animate-[...]`) or a clearly-grammatical expansion, and say which.
19. **Duplicate declarations (fallbacks).** `display: -webkit-box; display: flex;` or `width: 100%; width: calc(...)` cannot both survive in one class list. Keep the intended final value, say the fallback was dropped, and never silently pick one.
20. **`!important` is per declaration.** Every class derived from an important declaration carries the modifier (v3 `!px-4`, v4 `px-4!`; with prefix v3 `!tw-px-4`, v4 `tw:px-4!`). A shorthand expanded into several classes gets the modifier on each.

## Units and the root font size

21. **Tailwind's scales are rem-based and the converter assumes a 16px root.** `padding: 24px` is `p-6` only when `1rem = 16px`. If the stylesheet changes the root size (`html { font-size: 62.5% }`, `font-size: 10px`), px values from the source must be arbitrary (`p-[24px]`) and rem values need recomputing. State the assumption in the report whenever you use theme steps for px values, and switch to arbitrary values if a root font-size override is in the input.
22. **Keep the source's unit family when possible.** `1.5rem` maps to `6`; `24px` maps to `6` only under the 16px assumption; `1.5em` is `p-[1.5em]` (em depends on the element's font size and has no scale equivalent).
23. **Viewport units.** `100vh` is `h-screen`, `100dvh` is `h-dvh`, `100svh` is `h-svh`; anything else (`50vh`, `calc(100vh - 64px)`) is arbitrary: `h-[50vh]`, `h-[calc(100vh-64px)]`.

## Environment assumptions

24. **Preflight.** Both versions assume Tailwind's reset (zeroed margins and paddings, `box-sizing: border-box`, `border: 0 solid`, images `display: block`, unstyled headings and lists). Source CSS written against browser defaults may look different once converted. If the markup depends on default heading sizes or list bullets, say so.
25. **Specificity and order change.** See `variants-and-at-rules.md`.
26. **Classes must appear complete in the user's files.** Tailwind scans source text for class names; `bg-[#3b82f6]` works, building it by string concatenation does not.
27. **Prefix and important config.** If the project sets a prefix or `important` in config, honor what the user provided; never invent one.

## Input-level hazards

28. **Do not parse by regex.** Data URLs hold `;` and `:`; strings hold braces; comments hide declarations. Use `scripts/parse_css.py` for anything beyond a few plain declarations, and surface its warnings (unterminated brace, stray `}`, malformed declaration).
29. **Unsupported constructs stay out of the class list.** `@font-face`, `@keyframes`, `@import`, `@charset`, `@property` are reported separately (see `variants-and-at-rules.md`). The original web translator returned an error and no output for any of them; do not copy that behavior, and do not pretend they became classes.
30. **Custom properties.** Preserve `var(--x)` references; never guess the variable's value; `:root` definitions stay in CSS.
