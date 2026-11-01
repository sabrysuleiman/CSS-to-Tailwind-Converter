# Tailwind v3 vs v4: what changes in a CSS conversion

Verified by compiling real classes with `tailwindcss@3.4.19` and `tailwindcss@4.3.3`. Newer patch releases should behave the same; if something looks off, run `scripts/verify_classes.mjs` against the user's installed version.

## Contents
- [Detect the target version](#detect-the-target-version)
- [Syntax differences](#syntax-differences)
- [Utilities whose meaning or name changed](#utilities-whose-meaning-or-name-changed)
- [Behavior differences that affect fidelity](#behavior-differences-that-affect-fidelity)
- [Custom values: theme vs arbitrary](#custom-values-theme-vs-arbitrary)

## Detect the target version

Check in this order and stop at the first clear signal:

1. The user said it ("Tailwind 3", "v4", "we just upgraded").
2. Files or snippets supplied: `@import "tailwindcss"`, `@theme`, `@source`, `@tailwindcss/vite` or `@tailwindcss/postcss` mean **v4**. `@tailwind base;`, `tailwind.config.js` with `content: [...]`, or `tailwindcss: ^3` mean **v3**.
3. Class names already in their markup: `bg-gradient-to-r`, `flex-shrink-0`, `shadow-sm` used for the small shadow suggest v3; `bg-linear-to-r`, `shadow-xs`, `outline-hidden`, `font-bold!` suggest v4.
4. Nothing to go on: **assume v4** (current release), say so in one line, and name the classes that would differ in v3 (`!` position, prefix position, renamed shadow/radius/blur steps, gradient names). Do not ask a blocking question for a simple conversion.

## Syntax differences

| Topic | Tailwind v3 | Tailwind v4 |
|---|---|---|
| `!important` | Leading bang: `!font-bold`, `hover:!font-bold`. Trailing `font-bold!` is **invalid**. | Trailing bang: `font-bold!`, `hover:font-bold!`. (Leading `!` still compiles but is legacy.) |
| Prefix `tw` | Prefix sits on the utility, after variants: `tw-flex`, `hover:tw-flex`, `!tw-flex`, negative `-tw-mt-4`. Set in config as `prefix: 'tw-'`. | Prefix is the **first** variant: `tw:flex`, `tw:hover:flex`, `tw:font-bold!`, negative `tw:-mt-4`. Declared as `@import "tailwindcss" prefix(tw);`. `hover:tw:flex` is invalid. |
| Spacing / z-index numbers | Fixed scale only (0-12, 14, 16, 20-64 by 4, 72, 80, 96 and .5 steps up to 3.5). `p-13`, `z-5` do not exist: use `p-[3.25rem]`, `z-[5]`. | Any number works: `p-13`, `w-72`, `z-5` (spacing = n × 0.25rem). |
| CSS-variable shorthand | `bg-[var(--brand)]` only. | Also `bg-(--brand)` and typed `text-(length:--size)`. Both forms work. |
| Container queries | Needs `@tailwindcss/container-queries`. | Built in: `@container`, `@md:flex`, `@[400px]:flex`, `@max-md:flex`. |
| New variants | Use arbitrary variants: `[&:nth-child(2n+1)]:`, `[&:not(:last-child)]:`. | Also `nth-[2n+1]:`, `not-last:`, `in-[.dark]:`. |
| Gradients | `bg-gradient-to-r from-... via-... to-...` | `bg-linear-to-r` (and `bg-linear-[45deg]`). `bg-gradient-to-r` still compiles but is the old name. |
| Theme tokens | `tailwind.config.js` `theme.extend`. | `@theme { --color-brand: #3b82f6; }` in CSS. |

## Utilities whose meaning or name changed

The same class name can mean different CSS. Always pick the name for the **target** version.

| Value you need | v3 class | v4 class |
|---|---|---|
| `box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` | `shadow-sm` | `shadow-xs` |
| `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | `shadow` | `shadow-sm` |
| `box-shadow: 0 1px rgb(0 0 0 / 0.05)` | (arbitrary) | `shadow-2xs` |
| `border-radius: 0.125rem` | `rounded-sm` | `rounded-xs` |
| `border-radius: 0.25rem` | `rounded` | `rounded-sm` |
| `filter: blur(4px)` | `blur-sm` | `blur-xs` |
| `filter: blur(8px)` | `blur` | `blur-sm` |
| `backdrop-filter: blur(4px)` / `(8px)` | `backdrop-blur-sm` / `backdrop-blur` | `backdrop-blur-xs` / `backdrop-blur-sm` |
| `outline: 2px solid transparent; outline-offset: 2px` | `outline-none` | `outline-hidden` |
| `outline-style: none` | (arbitrary `[outline-style:none]`) | `outline-none` |
| `ring` width 3px | `ring` | `ring-3` (bare `ring` is 1px) |
| `flex-shrink: 0` / `flex-grow: 1` | `flex-shrink-0` / `flex-grow` (also `shrink-0` / `grow`) | `shrink-0` / `grow` (old names still compile) |
| `text-overflow: ellipsis` | `text-ellipsis` (`overflow-ellipsis` alias) | `text-ellipsis` |
| `opacity` on a color | `bg-black/50` (v3 also has `bg-opacity-50`) | `bg-black/50` only. `bg-opacity-*` and its siblings are removed. |

Bare `shadow`, `rounded`, `blur` still compile in v4.3 as legacy aliases, but they are the **old** values. Use the new step names in v4 output so the result survives future cleanup.

## Behavior differences that affect fidelity

1. **Default palette values.** v3 palette is sRGB hex, so `#ef4444` is exactly `red-500`. v4 palette is `oklch`: `red-500` is `oklch(63.7% 0.237 25.331)`, which renders about `rgb(251 44 54)`, not `#ef4444`; `blue-500` renders about `rgb(43 127 255)`, not `#3b82f6`. **In v4 keep the source color as an arbitrary value (`bg-[#3b82f6]`)** unless the user says a palette shift is fine. Look hex values up in `palette-v3.json` for v3 only.
2. **Hover.** v4 wraps `hover:` in `@media (hover: hover)`, so touch-only devices never match it. CSS `:hover` has no such guard. Mention this once when a conversion contains `:hover` for v4.
3. **Default border color.** v3 preflight gives every border `#e5e7eb` (gray-200). v4 uses `currentcolor`. A source `border: 1px solid` (no color) means `currentcolor`: in v3 add `border-current`; in v4 nothing is needed.
4. **Border style and width.** Both versions assume Preflight (`border-style: solid`, `border-width: 0` on all elements). The `border` utility sets only width (v3) or width plus a solid default (v4). When the source states a style, emit it (`border-solid`, `border-dashed`) so the result does not depend on Preflight.
5. **Transforms.** v3 composes `translate`, `rotate`, `skew`, `scale` into one `transform` through `--tw-*` variables in a **fixed order** (translate, rotate, skewX, skewY, scaleX, scaleY) regardless of class order. v4 uses the individual properties `translate`, `rotate`, `scale` (applied in that order, then `transform`). Either way, a CSS transform list in any other order (for example `rotate(45deg) translateX(10px)`) cannot be expressed with these utilities. Use an arbitrary property: `[transform:rotate(45deg)_translateX(10px)]`.
6. **Gradient interpolation.** v4's `bg-linear-*` utilities interpolate in oklab by default, which changes midpoint colors compared with CSS's default sRGB. Add the `/srgb` modifier (`bg-linear-to-r/srgb`) or use an arbitrary `bg-[linear-gradient(to_right,#fff,#000)]` for an exact result. The arbitrary form is identical in both versions.
7. **Alpha colors.** `bg-black/50` is `rgb(0 0 0 / 0.5)` in v3 and `color-mix(in oklab, ...)` in v4 (with an sRGB fallback). For an exact `rgba()` use `bg-[rgba(0,0,0,0.5)]`.
8. **Logical vs physical properties.** v4 emits `margin-inline`, `padding-inline` and `inset-inline` for `mx-*`, `px-*`, `inset-x-*` where v3 emitted left/right. They are equivalent for equal left and right values. Keep `pl-*`/`pr-*`/`ml-*`/`mr-*` (physical) for one-sided source values; do not switch to `ps-*`/`ms-*` (logical) because RTL behavior would change.

## Custom values: theme vs arbitrary

- A value with no theme token becomes an arbitrary value: `mt-[13px]`, `text-[17px]`, `w-[calc(100%-2rem)]`.
- If the same custom value is repeated across many rules, suggest a theme token instead of repeating arbitrary values, and show the snippet only if the user wants it:
  - v4: `@theme { --color-brand: #3b82f6; --spacing-gutter: 13px; }`
  - v3: `theme: { extend: { colors: { brand: '#3b82f6' } } }`
- Never invent a theme value or scale step on the user's behalf. Use the default scale or an arbitrary value, and say which.
- If the user supplies their own theme or config, resolve against it first, then fall back to the defaults. `verify_classes.mjs` accepts `--theme-css` (v4) and `--config` (v3) for this.
