---
name: layout-a-right-sidebar
description: Two-column — wide left (w=52) with narrow right sidebar (w=8), multi-section with page breaks
---

# Layout A: Right Sidebar

**isDynamic:** True
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 124
**Canvas entry count:** 9 CARD + 2 PAGE_BREAK

## Grid Diagram

| y | x | w | h | Slot |
|---|---|---|---|------|
| 0 | 0 | 52 | 11 | A1 |
| 0 | 52 | 8 | 19 | B1 |
| 11 | 0 | 52 | 40 | A2 |
| 19 | 52 | 8 | 11 | B2 |
| 30 | 52 | 8 | 8 | B3 |
| 38 | 52 | 8 | 13 | B4 |
| 51 | — | — | 0 | PAGE_BREAK |
| 51 | 0 | 52 | 42 | A3 |
| 51 | 52 | 8 | 42 | B5 |
| 93 | — | — | 0 | PAGE_BREAK |
| 93 | 0 | 60 | 31 | C1 |

## card_positions

```python
card_positions = {
    A1: {'x':  0, 'y':  0, 'w': 52, 'h': 11, 'cx':  0, 'cy':  0, 'cw': 12, 'ch':  6},
    B1: {'x': 52, 'y':  0, 'w':  8, 'h': 19, 'cx':  0, 'cy':  6, 'cw': 12, 'ch':  6},
    A2: {'x':  0, 'y': 11, 'w': 52, 'h': 40, 'cx':  0, 'cy': 12, 'cw': 12, 'ch': 20},
    B2: {'x': 52, 'y': 19, 'w':  8, 'h': 11, 'cx':  0, 'cy': 32, 'cw': 12, 'ch':  6},
    B3: {'x': 52, 'y': 30, 'w':  8, 'h':  8, 'cx':  0, 'cy': 38, 'cw': 12, 'ch':  6},
    B4: {'x': 52, 'y': 38, 'w':  8, 'h': 13, 'cx':  0, 'cy': 44, 'cw': 12, 'ch':  6},
    A3: {'x':  0, 'y': 51, 'w': 52, 'h': 42, 'cx':  0, 'cy': 50, 'cw': 12, 'ch': 20},
    B5: {'x': 52, 'y': 51, 'w':  8, 'h': 42, 'cx':  0, 'cy': 70, 'cw': 12, 'ch': 20},
    C1: {'x':  0, 'y': 93, 'w': 60, 'h': 31, 'cx':  0, 'cy': 90, 'cw': 12, 'ch': 20},
}
```

Replace slot labels with actual integer cardIds.

## Special entry injection

```python
special_entries = [
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 51, 'w': 60, 'h': 0, 'cx': 0, 'cy': 51, 'cw': 12, 'ch': 0},
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 93, 'w': 60, 'h': 0, 'cx': 0, 'cy': 93, 'cw': 12, 'ch': 0},
]
is_dynamic = True
```

## Compact grid notes

All slots stack full-width (w=12), sequential y. Sidebar cards (B1–B5) interleave with left column cards in compact view.
