---
tags: [css-to-tailwind]
max_turns: 25
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Convert this CSS to Tailwind classes:

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
