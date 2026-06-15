---
name: OneChat design system
description: Visual design rules and current theme for the OneChat app.
---

## Current design (v2 — Soft Dark)

Single static dark theme. No time-of-day switching (removed after usability feedback).

### Color palette
- Background: `hsl(220 13% 11%)` — #1C1C1E (iOS-style soft dark)
- Surface: `hsl(240 5% 17%)` — #2C2C2E (header, input bar, cards)
- Surface raised: `hsl(240 4% 23%)` — #3A3A3C (their bubbles, input field)
- Bubble mine: `hsl(211 100% 52%)` — #0A7AFF (blue, sent messages)
- Foreground: `hsl(240 8% 95%)` — #F2F2F7 (main text)
- Secondary: `hsl(240 4% 55%)` — #8E8E93 (timestamps, labels)
- Border: `hsl(240 4% 22%)` — #38383A
- Accent: `hsl(211 100% 52%)` — #0A7AFF

### Typography
- Cormorant Garamond (serif): messages, names, body
- JetBrains Mono (monospace): labels, timestamps, system text, buttons

### Chat bubble CSS classes
- `.bubble-mine` — blue bg, white text, `border-radius: 18px 18px 4px 18px` (tail bottom-right)
- `.bubble-theirs` — surface-raised bg, `border-radius: 18px 18px 18px 4px` (tail bottom-left)
- Both defined in `index.css`

### Border radius
- `--radius: 0.875rem` — used for cards, inputs, buttons
- Chat bubbles use custom `18px/4px` tail shape (in `.bubble-mine` / `.bubble-theirs`)
- Avatar: always `rounded-full`

### UI structure ("normal chat app")
- All pages have a header bar with back button + avatar + name/status
- Gallery: conversation list (avatar + name + preview + date)
- Room/Lounge: header + message area + input bar with send button
- Setup: bordered inputs with focus highlight

**Why removed time theme:** Time-driven dark themes caused near-invisible text at night (especially midnight: bg #0E0D0C + dim foreground). Opacity-based text hierarchy doesn't work on very dark backgrounds without very bright base foreground. Decision: single consistent soft dark.

**How to apply:** Any new component must use the CSS variables from `:root` in index.css. Use `bubble-mine` / `bubble-theirs` classes for chat messages. Use `hsl(211 100% 52%)` for primary actions.
