---
name: layout-c-left-column-feature
description: Narrow left column (w=13) with stacked cards alongside wide right slot (w=47), asymmetric two-panel below, full-width bottom
---

# Layout C: Left Column Feature

**isDynamic:** True
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 165
**Canvas entry count:** 7 CARD + 2 PAGE_BREAK

## Grid Diagram

| y | x | w | h | Slot |
|---|---|---|---|------|
| 0 | 0 | 13 | 11 | A1 |
| 0 | 13 | 47 | 33 | B1 |
| 11 | 0 | 13 | 11 | A2 |
| 22 | 0 | 13 | 11 | A3 |
| 33 | — | — | 0 | PAGE_BREAK |
| 33 | 0 | 23 | 71 | C1 |
| 33 | 23 | 37 | 71 | C2 |
| 104 | — | — | 0 | PAGE_BREAK |
| 104 | 0 | 60 | 61 | D1 |

## card_positions

```python
card_positions = {
    A1: {'x':  0, 'y':  0, 'w': 13, 'h': 11, 'cx':  0, 'cy':  0, 'cw': 12, 'ch':  6},
    B1: {'x': 13, 'y':  0, 'w': 47, 'h': 33, 'cx':  0, 'cy':  6, 'cw': 12, 'ch': 20},
    A2: {'x':  0, 'y': 11, 'w': 13, 'h': 11, 'cx':  0, 'cy': 26, 'cw': 12, 'ch':  6},
    A3: {'x':  0, 'y': 22, 'w': 13, 'h': 11, 'cx':  0, 'cy': 32, 'cw': 12, 'ch':  6},
    C1: {'x':  0, 'y': 33, 'w': 23, 'h': 71, 'cx':  0, 'cy': 38, 'cw': 12, 'ch': 30},
    C2: {'x': 23, 'y': 33, 'w': 37, 'h': 71, 'cx':  0, 'cy': 68, 'cw': 12, 'ch': 30},
    D1: {'x':  0, 'y':104, 'w': 60, 'h': 61, 'cx':  0, 'cy': 98, 'cw': 12, 'ch': 40},
}
```

Replace slot labels with actual integer cardIds.

## Special entry injection

```python
special_entries = [
    {'type': 'PAGE_BREAK', 'x': 0, 'y':  33, 'w': 60, 'h': 0, 'cx': 0, 'cy':  33, 'cw': 12, 'ch': 0},
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 104, 'w': 60, 'h': 0, 'cx': 0, 'cy': 104, 'cw': 12, 'ch': 0},
]
is_dynamic = True
```

## Compact grid notes

All slots stack full-width (w=12), sequential y. Left column cards (A1-A3) appear before the wide slot (B1) in compact view.
