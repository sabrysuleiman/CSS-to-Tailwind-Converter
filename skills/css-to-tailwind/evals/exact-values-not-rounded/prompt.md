---
tags: [css-to-tailwind]
max_turns: 25
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Tailwind 4. Convert this and keep it pixel-exact:

```css
.tooltip {
  position: absolute; top: calc(100% + 6px); left: 50%;
  transform: rotate(-2deg) translateX(-50%);
  padding: 5px 11px; font-size: 13px; letter-spacing: .02em;
  background: rgba(17, 24, 39, .92); border-radius: 5px; z-index: 9999;
}
```
