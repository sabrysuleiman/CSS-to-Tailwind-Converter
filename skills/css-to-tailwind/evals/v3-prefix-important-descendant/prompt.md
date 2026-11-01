---
tags: [css-to-tailwind]
max_turns: 25
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We're on Tailwind 3 with the prefix `tw-`. Convert this to utility classes:

```css
.alert { color: #991b1b !important; background-color: #fef2f2; padding: 12px 16px; border-left: 4px solid #ef4444; }
.alert a { text-decoration: underline; }
.alert:hover { background-color: #fee2e2; }
```
