# Mapping tables: CSS property to Tailwind utility

Scale values come from the default themes of Tailwind 3.4.19 and 4.3.3. Entries marked "same" behave identically in v3 and v4. Every row in the "Worked mappings" section is also a fixture in `scripts/selftest/` and passes `verify_classes.mjs` on both versions.

## Contents
- [Choosing between theme utility and arbitrary value](#choosing-between-theme-utility-and-arbitrary-value)
- [Theme scales](#theme-scales)
- [Property patterns](#property-patterns)
- [Worked mappings](#worked-mappings)

## Choosing between theme utility and arbitrary value

Use a named utility only when it emits **exactly** the CSS in the source, including any extra declarations it brings along:

1. Compute the CSS value, converting units: `px / 16 = rem`, so `24px` is `1.5rem` and spacing step `6`.
2. If a scale step equals that value and the utility sets no additional declaration, use the step.
3. If a utility sets more than the source did (the `text-*` sizes also set `line-height`), either use it only when the source declares the same line-height, or use an arbitrary value (`text-[18px]`).
4. Otherwise use an arbitrary value. Never round `13px` to `3` or `3.5`.

Arbitrary-value syntax rules (both versions):
- Spaces become underscores: `grid-cols-[1fr_2fr]`, `shadow-[0_4px_6px_rgb(0_0_0/0.1)]`, `font-['Helvetica_Neue',Arial]`. A literal underscore needs `\_`.
- No spaces around operators inside `calc()`: `w-[calc(100%-2rem)]` (Tailwind adds them).
- When the value type is ambiguous give a hint: `text-[length:var(--size)]` vs `text-[color:var(--c)]`, `border-[length:var(--w)]` vs `border-[color:var(--c)]`, `bg-[position:...]`, `bg-[size:...]`, `bg-[url(...)]`.
- A property with no utility: arbitrary property `[mask-type:luminance]`, with variants as usual: `hover:[clip-path:inset(0)]`.

## Theme scales

**Spacing** (padding, margin, gap, inset, width, height, translate, space): `step × 0.25rem`.
`0`=0, `px`=1px, `0.5`=2px, `1`=4px, `1.5`=6px, `2`=8px, `2.5`=10px, `3`=12px, `3.5`=14px, `4`=16px, `5`=20px, `6`=24px, `7`=28px, `8`=32px, `9`=36px, `10`=40px, `11`=44px, `12`=48px, `14`=56px, `16`=64px, `20`=80px, `24`=96px, `28`=112px, `32`=128px, `36`=144px, `40`=160px, `44`=176px, `48`=192px, `52`=208px, `56`=224px, `60`=240px, `64`=256px, `72`=288px, `80`=320px, `96`=384px. v4 accepts any other number (`13` = 52px); v3 does not.

**Font size** (always sets `line-height` too): `xs` 12px/16px, `sm` 14px/20px, `base` 16px/24px, `lg` 18px/28px, `xl` 20px/28px, `2xl` 24px/32px, `3xl` 30px/36px, `4xl` 36px/40px, `5xl` 48px/1, `6xl` 60px/1, `7xl` 72px/1, `8xl` 96px/1, `9xl` 128px/1.
`text-lg/7` sets size and line-height together (`7` = 28px). `text-lg/[1.4]` sets line-height 1.4.

**Line height**: `leading-none` 1, `tight` 1.25, `snug` 1.375, `normal` 1.5, `relaxed` 1.625, `loose` 2, and spacing-based `leading-3`...`leading-10` (v3: 12-40px; v4: any `leading-N` = N × 0.25rem). Unitless source values such as `1.4`: `leading-[1.4]`.

**Font weight**: `thin` 100, `extralight` 200, `light` 300, `normal` 400, `medium` 500, `semibold` 600, `bold` 700, `extrabold` 800, `black` 900. Other numbers: `font-[450]`.

**Letter spacing**: `tighter` -0.05em, `tight` -0.025em, `normal` 0em, `wide` 0.025em, `wider` 0.05em, `widest` 0.1em.

**Border radius** (v3 / v4 names): `none` 0; 2px = `rounded-sm` / `rounded-xs`; 4px = `rounded` / `rounded-sm`; 6px `md`; 8px `lg`; 12px `xl`; 16px `2xl`; 24px `3xl`; v4 only `4xl` 32px; `full` 9999px.

**Border width**: `border` 1px, `border-0`, `border-2`, `border-4`, `border-8`; other widths `border-[3px]`.

**Box shadow** (v3 / v4 names):
- `0 1px 2px 0 rgb(0 0 0/.05)`: `shadow-sm` / `shadow-xs`
- `0 1px 3px 0 rgb(0 0 0/.1), 0 1px 2px -1px rgb(0 0 0/.1)`: `shadow` / `shadow-sm`
- `0 4px 6px -1px rgb(0 0 0/.1), 0 2px 4px -2px rgb(0 0 0/.1)`: `shadow-md` (same)
- `0 10px 15px -3px rgb(0 0 0/.1), 0 4px 6px -4px rgb(0 0 0/.1)`: `shadow-lg` (same)
- `0 20px 25px -5px rgb(0 0 0/.1), 0 8px 10px -6px rgb(0 0 0/.1)`: `shadow-xl` (same)
- `0 25px 50px -12px rgb(0 0 0/.25)`: `shadow-2xl` (same)
- `inset 0 2px 4px 0 rgb(0 0 0/.05)`: `shadow-inner` (v3) / `inset-shadow-sm` (v4)
- `none`: `shadow-none`

**Transitions**: `transition` (v3 property list: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; v4 adds outline-color, translate, scale, rotate, gradient stops, and display, content-visibility, overlay, pointer-events), `transition-colors`, `transition-opacity`, `transition-shadow`, `transition-transform`, `transition-all`, `transition-none`. Durations: `duration-75/100/150/200/300/500/700/1000`. Default duration 150ms. Utilities that set a transition **also set** `transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)`.
Easing names are **not** the CSS keywords: Tailwind `ease-in-out` is `cubic-bezier(0.4,0,0.2,1)`, CSS `ease-in-out` is `cubic-bezier(0.42,0,0.58,1)`, CSS `ease` is `cubic-bezier(0.25,0.1,0.25,1)`. Map `linear` to `ease-linear`; map `cubic-bezier(0.4,0,0.2,1)` to `ease-in-out`; map a CSS keyword with `ease-[ease]`, `ease-[ease-in]`, etc.

**Breakpoints**: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. Other widths: `min-[900px]:`, `max-[899px]:`. `max-w-screen-sm` is 640px; `max-w-sm` is 24rem (384px). These are not the same.

**Container widths** (`max-w-*`): `xs` 20rem, `sm` 24rem, `md` 28rem, `lg` 32rem, `xl` 36rem, `2xl` 42rem, `3xl` 48rem, `4xl` 56rem, `5xl` 64rem, `6xl` 72rem, `7xl` 80rem, `prose` 65ch, `full`, `none`, plus `screen-sm`...`screen-2xl`.

**Default colors**: `black`, `white`, `transparent`, `current` (= `currentColor`), and 22 families (slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose) with shades 50, 100-900 (and 950). For a hex value, search `palette-v3.json` (**v3 only**; see `tailwind-versions.md` for why v4 keeps arbitrary hex).

## Property patterns

### Layout
| CSS | Tailwind |
|---|---|
| `display: block / inline-block / inline / flex / inline-flex / grid / inline-grid / contents / flow-root / table` | same names. `display: none` is `hidden`. |
| `position: static / relative / absolute / fixed / sticky` | same names |
| `top/right/bottom/left: 0` | `top-0` ...; all four equal: `inset-0`; left+right: `inset-x-0`; top+bottom: `inset-y-0`; negative: `-top-2`; percent: `top-1/2`, `left-1/3`, `w-2/3`; `auto`: `top-auto`; other: `top-[7px]` |
| `z-index: 10` | `z-10` (v3 scale: 0, 10, 20, 30, 40, 50, auto). Other: `z-[5]` (v3), `z-5` (v4). Negative: `-z-10` |
| `overflow: hidden / auto / scroll / visible` | `overflow-hidden`, `overflow-auto`, `overflow-scroll`, `overflow-visible`; axis: `overflow-x-auto` |
| `visibility: hidden / visible` | `invisible` / `visible` |
| `float`, `clear` | `float-left`, `float-right`, `float-none`, `clear-both` |
| `box-sizing` | `box-border`, `box-content` |
| `aspect-ratio: 16 / 9` | `aspect-video`; `1 / 1` is `aspect-square`; other: `aspect-[4/3]` |
| `object-fit` / `object-position` | `object-cover`, `object-contain`, `object-center`, ... |

### Flexbox and grid
| CSS | Tailwind |
|---|---|
| `flex-direction` | `flex-row`, `flex-col`, `flex-row-reverse`, `flex-col-reverse` |
| `flex-wrap` | `flex-wrap`, `flex-nowrap`, `flex-wrap-reverse` |
| `flex: 1 1 0%` / `1 1 auto` / `0 1 auto` / `none` | `flex-1` / `flex-auto` / `flex-initial` / `flex-none`. Other: `flex-[2_2_0%]` |
| `flex-grow: 1` / `flex-shrink: 0` | `grow` / `shrink-0` (v3 also `flex-grow`, `flex-shrink-0`) |
| `flex-basis` | `basis-1/2`, `basis-full`, `basis-[200px]` |
| `justify-content: flex-start / flex-end / center / space-between / space-around / space-evenly` | `justify-start / justify-end / justify-center / justify-between / justify-around / justify-evenly` |
| `align-items: flex-start / flex-end / center / baseline / stretch` | `items-start / items-end / items-center / items-baseline / items-stretch` |
| `align-self`, `align-content`, `justify-self`, `justify-items` | `self-*`, `content-*`, `justify-self-*`, `justify-items-*` |
| `gap: 16px` / `row-gap` / `column-gap` | `gap-4` / `gap-y-4` / `gap-x-4`; `gap: 8px 16px` is `gap-y-2 gap-x-4` |
| `order: 1` | `order-1` (`order-first`, `order-last`, `order-none`) |
| `grid-template-columns: repeat(3, minmax(0, 1fr))` | `grid-cols-3`. **`repeat(3, 1fr)` is not identical** (no `minmax(0, ...)`): use `grid-cols-[repeat(3,1fr)]`. |
| `grid-template-columns: 1fr 2fr` | `grid-cols-[1fr_2fr]` |
| `grid-column: span 2 / span 2` | `col-span-2`; `grid-row` likewise `row-span-2` |
| `grid-auto-flow` | `grid-flow-row`, `grid-flow-col`, `grid-flow-dense` |

### Spacing and sizing
| CSS | Tailwind |
|---|---|
| `padding: 8px 16px` | `py-2 px-4`. Four values: `pt-* pr-* pb-* pl-*`. |
| `margin: 0 auto` | `my-0 mx-auto` (do not drop the vertical zeros: the source sets them) |
| `margin-left: auto` | `ml-auto`; negative `-mt-4` |
| `width / height` | `w-4`, `w-1/2`, `w-full` (100%), `w-screen` (100vw), `h-screen` (100vh), `w-auto`, `w-min`, `w-max`, `w-fit`, `h-dvh`, `w-[288px]`. Same-value width and height: `size-4` (v3.4+). |
| `min-width / max-width / min-height / max-height` | `min-w-0`, `min-w-full`, `max-w-full`, `max-w-none`, `max-w-prose`, `max-w-screen-lg`, `min-h-screen`, `max-h-96`, `max-w-[1280px]` |

### Typography
| CSS | Tailwind |
|---|---|
| `font-size` | see "Font size" above; remember the line-height coupling |
| `font-family: Inter, system-ui, sans-serif` | `font-[Inter,system-ui,sans-serif]`. `font-sans/serif/mono` are Tailwind's own stacks, not equal to arbitrary lists. For a family with spaces: `font-['Helvetica_Neue',Arial]`. |
| `font-style: italic / normal` | `italic` / `not-italic` |
| `text-align` | `text-left`, `text-center`, `text-right`, `text-justify`, `text-start`, `text-end` |
| `text-transform` | `uppercase`, `lowercase`, `capitalize`, `normal-case` |
| `text-decoration: underline / line-through / none` | `underline`, `line-through`, `no-underline` |
| `text-overflow: ellipsis` | `text-ellipsis`; with `overflow: hidden; white-space: nowrap` together: `truncate` |
| `white-space` | `whitespace-nowrap`, `whitespace-normal`, `whitespace-pre`, `whitespace-pre-line`, `whitespace-pre-wrap` |
| `word-break: break-all` | `break-all`; `overflow-wrap: break-word` is `break-words` |
| `vertical-align` | `align-top`, `align-middle`, `align-bottom`, `align-baseline` |
| `list-style-type` | `list-none`, `list-disc`, `list-decimal`; `list-style-position: inside` is `list-inside` |
| `color` | `text-white`, `text-[#333]`, `text-current`, `text-black/50` |
| `content: "x"` | `content-['x']` (with the `before:`/`after:` variant on pseudo-elements) |

### Backgrounds and borders
| CSS | Tailwind |
|---|---|
| `background-color` | `bg-white`, `bg-[#0a0a0a]`, `bg-transparent` |
| `background-image: url(a.png)` | `bg-[url(a.png)]` (quotes allowed: `bg-[url('/a.png')]`) |
| `background-size: cover / contain / auto` | `bg-cover / bg-contain / bg-auto`; `bg-[length:200px_100px]` |
| `background-position: center` | `bg-center`, `bg-top`, `bg-left-top`, ...; `bg-[position:25%_75%]` |
| `background-repeat` | `bg-no-repeat`, `bg-repeat`, `bg-repeat-x`, `bg-repeat-y` |
| `background: linear-gradient(...)` | exact: `bg-[linear-gradient(to_right,#fff,#000)]`; theme-based: v3 `bg-gradient-to-r from-X via-Y to-Z`, v4 `bg-linear-to-r from-X to-Z` (see interpolation note in `tailwind-versions.md`) |
| `border: 1px solid #e5e7eb` | `border border-solid border-[#e5e7eb]` (v3 also `border-gray-200`). Sides: `border-t`, `border-x-2`, `border-b-0`. Style: `border-dashed`, `border-dotted`, `border-none`. |
| `border-collapse` | `border-collapse`, `border-separate` |
| `border-radius` | see scale above; corners `rounded-t-lg`, `rounded-tl-md`; `50%` is `rounded-[50%]` (not `rounded-full`, which is 9999px) |
| `outline` | `outline`, `outline-2`, `outline-dashed`, `outline-offset-2`, `outline-[#3b82f6]` (and the v3/v4 `outline-none` difference) |
| `box-shadow` | see scale; other: `shadow-[0_4px_12px_rgba(0,0,0,0.15)]`; color: `shadow-black/25` |

### Effects, filters, motion
| CSS | Tailwind |
|---|---|
| `opacity: .5` | `opacity-50` (every multiple of 5 from 0 to 100); other: `opacity-[0.35]` |
| `mix-blend-mode` | `mix-blend-multiply`, `mix-blend-screen`, ... |
| `filter: blur(4px) grayscale(1)` | `blur-sm grayscale` (v3) / `blur-xs grayscale` (v4). Filter functions compose in a fixed order: blur, brightness, contrast, grayscale, hue-rotate, invert, saturate, sepia, drop-shadow. If the source order differs, use `[filter:...]`. |
| `backdrop-filter: blur(8px)` | `backdrop-blur` (v3) / `backdrop-blur-sm` (v4) |
| `transform: rotate(45deg)` | `rotate-45`; `translateX(-50%)`: `-translate-x-1/2`; `scale(.95)`: `scale-95`; `skewX(6deg)`: `skew-x-6` |
| `transform: translate(-50%, -50%)` | `-translate-x-1/2 -translate-y-1/2` |
| `transform-origin` | `origin-center`, `origin-top-left`, `origin-[20%_30%]` |
| `transition` shorthand | split into `transition-*` + `duration-*` + `delay-*` + `ease-*`; check the easing note above |
| `animation: spin 1s linear infinite` | `animate-spin` only for Tailwind's built-ins (spin, ping, pulse, bounce). Custom `@keyframes` stay in CSS: `animate-[wiggle_1s_ease-in-out_infinite]` references it by name. |

### Interaction and misc
| CSS | Tailwind |
|---|---|
| `cursor` | `cursor-pointer`, `cursor-not-allowed`, `cursor-default`, ... |
| `pointer-events: none / auto` | `pointer-events-none` / `pointer-events-auto` |
| `user-select: none` | `select-none` (`select-text`, `select-all`) |
| `resize` | `resize`, `resize-none`, `resize-x`, `resize-y` |
| `appearance: none` | `appearance-none` |
| `scroll-behavior: smooth` | `scroll-smooth` |
| `fill`, `stroke`, `stroke-width` | `fill-current`, `fill-[#fff]`, `stroke-2`, `stroke-[1.5]` |
| `will-change`, `touch-action` | `will-change-transform`, `touch-none`, `touch-pan-x` |
| `line-clamp` (webkit box) | `line-clamp-3` only if the source uses the standard `-webkit-line-clamp: 3` plus `overflow: hidden`, `display: -webkit-box`, `-webkit-box-orient: vertical` (the utility emits all four) |

### CSS-wide and special values
- `inherit`, `initial`, `unset`, `revert`: use an arbitrary property: `[color:inherit]`, `[all:unset]`. Some properties have named utilities (`bg-inherit`, `text-inherit`, `border-inherit`), use them when they exist.
- `currentColor`: `text-current`, `bg-current`, `border-current`, `fill-current`.
- `var(--x)` values: `bg-[var(--x)]` or (v4) `bg-(--x)`. Do not guess the variable's value.

## Worked mappings

These are fixtures from `scripts/selftest/`: the CSS on the left was compiled against the classes on the right and compared declaration by declaration.

| CSS | v3 classes | v4 classes |
|---|---|---|
| `display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:16px` | `flex flex-col items-center justify-between gap-4` | same |
| `margin:0 auto; padding:24px` | `my-0 mx-auto p-6` | same |
| `font-size:14px; line-height:20px` | `text-sm` | same |
| `font-size:18px` | `text-[18px]` | same |
| `border:1px solid #e5e7eb` | `border border-solid border-gray-200` | `border border-solid border-[#e5e7eb]` |
| `box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.05)` | `shadow-sm` | `shadow-xs` |
| `transition:all 150ms cubic-bezier(0.4,0,0.2,1)` | `transition-all duration-150 ease-in-out` | same |
| `transition:all 300ms ease` | `transition-all duration-300 ease-[ease]` | same |
| `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%)` | `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` | same |
| `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` | `truncate` | same |
| `backdrop-filter:blur(8px)` | `backdrop-blur` | `backdrop-blur-sm` |
| `display:none !important; color:#fff !important` | `!hidden !text-white` | `hidden! text-white!` |
| `width:288px; margin-top:13px; z-index:5` | `w-72 mt-[13px] z-[5]` | `w-72 mt-[13px] z-5` |
