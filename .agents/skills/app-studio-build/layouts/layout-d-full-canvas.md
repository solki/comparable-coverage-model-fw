---
name: layout-d-full-canvas
description: Single slot occupies the entire canvas — one card, no other slots
---

# Layout D: Full Canvas

**isDynamic:** True
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 70
**Canvas entry count:** 1 CARD + 1 PAGE_BREAK

## Grid Diagram

| y | x | w | h | Slot |
|---|---|---|---|------|
| 0 | 0 | 60 | 70 | A1 |
| 70 | — | — | 0 | PAGE_BREAK |

## card_positions

```python
card_positions = {
    A1: {'x': 0, 'y': 0, 'w': 60, 'h': 70, 'cx': 0, 'cy': 0, 'cw': 12, 'ch': 6, 'hero': True},
}
```

Replace A1 with actual integer cardId. The `hero: True` flag sets hideTitle/hideSummary/hideBorder/hideMargins/fitToFrame all True so the card fills the entire canvas edge-to-edge.

## Special entry injection

```python
special_entries = [
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 70, 'w': 60, 'h': 0, 'cx': 0, 'cy': 70, 'cw': 12, 'ch': 0},
]
is_dynamic = True
```

## Compact grid notes

Single slot at w=12, h=6.
