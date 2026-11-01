---
tags: [css-to-tailwind]
max_turns: 25
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Convert this stylesheet to Tailwind classes and tell me what couldn't be converted:

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
