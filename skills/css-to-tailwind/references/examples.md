# Worked examples

Each conversion below was compiled and compared with `scripts/verify_classes.mjs` against the stated Tailwind version (no invalid classes, no unexplained differences). Use them as models for **format and tone**: lead with the result, keep notes short, and report only what the reader needs to know.

## Contents
1. [Stateful button, Tailwind v4 (default)](#1-stateful-button-tailwind-v4-default)
2. [Alert with prefix, `!important` and a descendant rule, Tailwind v3](#2-alert-with-prefix-important-and-a-descendant-rule-tailwind-v3)
3. [Unsupported constructs and a data URL](#3-unsupported-constructs-and-a-data-url)
4. [Off-scale values and a non-canonical transform](#4-off-scale-values-and-a-non-canonical-transform)

---

## 1. Stateful button, Tailwind v4 (default)

Input (no version stated, so v4 is assumed):

```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; font-size: 14px; line-height: 20px; font-weight: 600;
  color: #fff; background-color: #2563eb;
  border: 1px solid transparent; border-radius: 6px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.btn:hover { background-color: #1d4ed8; }
.btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
@media (min-width: 768px) { .btn { padding: 12px 24px; } }
```

Output:

> Targeting Tailwind v4 (say "v3" if you are on v3).
>
> **.btn**
> ```
> inline-flex items-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-[#2563eb] border border-solid border-transparent rounded-md shadow-xs transition-[background-color] duration-150 ease-in-out hover:bg-[#1d4ed8] focus-visible:outline-2 focus-visible:outline-[#93c5fd] focus-visible:outline-offset-2 md:py-3 md:px-6
> ```
>
> Notes
> - `text-sm` is exact here because it sets `font-size: 14px` and `line-height: 20px`, which the source declares.
> - Colors stay as arbitrary hex: v4's palette is oklch, so `bg-blue-600` would shift the color slightly.
> - `transition-[background-color]` instead of `transition-colors` keeps the transition to the one property in the source.
> - v4 applies `hover:` only on devices that support hover; CSS `:hover` also fires on touch.
> - Assumes a 16px root font size and Tailwind's Preflight.

v3 differences, if asked: `shadow-sm` (instead of `shadow-xs`), `bg-blue-600`, `hover:bg-blue-700`, `focus-visible:outline-blue-300`, and an extra `focus-visible:outline` because v3's `outline-2` sets only the width, not the style. (v3 palette is hex-exact, so named colors are safe there.)

---

## 2. Alert with prefix, `!important` and a descendant rule, Tailwind v3

User says: "Tailwind 3, prefix is `tw-`."

Input:

```css
.alert { color: #991b1b !important; background-color: #fef2f2; padding: 12px 16px; border-left: 4px solid #ef4444; }
.alert a { text-decoration: underline; }
.alert:hover { background-color: #fee2e2; }
```

Output:

> **.alert**
> ```
> !tw-text-red-800 tw-bg-red-50 tw-py-3 tw-px-4 tw-border-l-4 tw-border-solid tw-border-l-red-500 hover:tw-bg-red-100
> ```
> **.alert a** (descendant rule, element form: put these classes on the `<a>`)
> ```
> tw-underline
> ```
>
> Notes
> - v3 syntax: `!` leads the utility and the prefix sits after variants (`hover:tw-bg-red-100`).
> - Hex values matched the v3 palette exactly (`#991b1b` is red-800, `#fef2f2` red-50, `#fee2e2` red-100, `#ef4444` red-500).
> - `tw-border-solid` also sets the style on the other three sides; their width is 0, so nothing renders.
> - `.alert a` is expressed as classes on the link itself, so it no longer depends on being inside `.alert`. To keep that condition use `[.alert_&]:tw-underline`; to style the links from the container use `[&_a]:tw-underline` on `.alert`.

The same input on v4 with prefix `tw`: `tw:text-[#991b1b]! tw:bg-[#fef2f2] tw:py-3 tw:px-4 tw:border-l-4 tw:border-solid tw:border-l-[#ef4444] tw:hover:bg-[#fee2e2]`, and the scoped form of the descendant rule is `tw:[.alert_&]:underline`. The v4 prefix always comes first, so `[.alert_&]:tw:underline` is invalid (verified). Colors stay arbitrary hex in v4.

---

## 3. Unsupported constructs and a data URL

Input:

```css
@charset "utf-8";
@font-face { font-family: "Brand"; src: url(brand.woff2) format("woff2"); }
.hero {
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>") center / cover no-repeat;
  animation: fade 1s ease-out both;
  padding: 48px 24px; /* generous; shrinks later */
}
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
```

Output:

> **.hero**
> ```
> py-12 px-6 animate-[fade_1s_ease-out_both]
> ```
>
> **Not converted (kept as CSS)**
> - `@charset "utf-8"`: dropped; UTF-8 is the default for CSS served as UTF-8.
> - `@font-face` for "Brand": keep as CSS. v4 can expose it as a utility with `@theme { --font-brand: "Brand", sans-serif; }`, giving `font-brand`.
> - `@keyframes fade`: keep in CSS; `animate-[fade_...]` above references it by name.
> - `.hero { background: url("data:image/svg+xml;...") center / cover no-repeat }`: the inline data URL would make an unreadable class name. Keep the image in CSS as a variable and use the rest as utilities:
>   ```css
>   :root { --hero-bg: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"); }
>   ```
>   ```
>   bg-[image:var(--hero-bg)] bg-center bg-cover bg-no-repeat
>   ```
>   Note that the `background` shorthand also reset color, attachment, origin and clip; the utilities do not.

Parsing note: the `;` inside the data URL and the comment after `padding` are handled correctly by `scripts/parse_css.py`; a split-on-semicolon approach would have broken the `background` value.

---

## 4. Off-scale values and a non-canonical transform

Input (v4 assumed):

```css
.tooltip {
  position: absolute; top: calc(100% + 6px); left: 50%;
  transform: rotate(-2deg) translateX(-50%);
  padding: 5px 11px; font-size: 13px; letter-spacing: .02em;
  background: rgba(17, 24, 39, .92); border-radius: 5px; z-index: 9999;
}
```

Output:

> **.tooltip**
> ```
> absolute top-[calc(100%+6px)] left-1/2 [transform:rotate(-2deg)_translateX(-50%)] py-[5px] px-[11px] text-[13px] tracking-[0.02em] bg-[rgba(17,24,39,0.92)] rounded-[5px] z-9999
> ```
>
> Notes
> - Values that are not on the scale stay exact (`5px`, `11px`, `13px`, `5px` radius) instead of rounding to `1`, `3`, `text-sm`, `rounded`.
> - `text-[13px]` rather than `text-sm`: the `text-*` sizes also set a line-height the source does not declare.
> - The transform list is `rotate` then `translateX`. Tailwind's utilities always apply translate before rotate, so `rotate-[-2deg] -translate-x-1/2` would render differently. An arbitrary property keeps the source order.
> - `z-9999` is valid in v4; in v3 write `z-[9999]`.
