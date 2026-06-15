---
name: OneChat design constraints
description: Strict visual/design rules for the OneChat app that must never be violated.
---

No chat bubbles, no cards, no navbars, no purple/blue gradients, no glassmorphism.

Fonts: Cormorant Garamond (messages/names) + JetBrains Mono (timestamps/system text). Both loaded via Google Fonts in index.html AND index.css @import.

Color system: time-driven CSS variables keyed off `data-time` attribute on `<html>`. Set by useTimeOfDay hook (UTC-based). Four states: morning (#F4F1EA), day (#E9E4DB), evening (#2A211C dark bg + #C8A36A accent), midnight (#0E0D0C).

Border-radius: 0 everywhere.

**Why:** The entire product concept is "anti-SaaS Paper & Ink" — the design IS the product differentiator.

**How to apply:** Any new UI component must follow these rules. No rounded corners, no cards with shadows, no colored backgrounds on interactive elements.
