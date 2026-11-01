---
tags: [css-to-tailwind]
max_turns: 25
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Convert this stylesheet to Tailwind v4 classes and check them properly, I don't want any class that doesn't exist:

```css
.nav { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 64px; background-color: #0f172a; }
.nav a { color: #e2e8f0; text-decoration: none; font-weight: 500; }
.nav a:hover { color: #fff; }
.card { background-color: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); overflow: hidden; }
.card img { width: 100%; height: 160px; object-fit: cover; }
.card h3 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
.card p { margin: 0; font-size: 14px; line-height: 20px; color: #475569; }
@media (min-width: 768px) { .nav { padding: 0 48px; } }
```
