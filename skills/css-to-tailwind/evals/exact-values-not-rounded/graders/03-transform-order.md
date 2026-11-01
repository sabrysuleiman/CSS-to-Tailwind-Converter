---
type: llm
focus: trace
weight: 1
---

The transform keeps rotate(-2deg) before translateX(-50%), for example with [transform:rotate(-2deg)_translateX(-50%)]. If it instead uses separate rotate and translate utilities, the response explicitly warns that the order differs.
