---
name: layout-e-left-filter-form
description: Full-width top, narrow left column (w=13) alongside wide right slot (w=47), filter strip with spacer, form alongside card, full-width bottom
---

# Layout E: Left Filter + Form

**isDynamic:** False
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 145
**Canvas entry count:** 9 CARD + 2 PAGE_BREAK + 1 SPACER + 1 FORM

## Grid Diagram

| y | x | w | h | Slot |
|---|---|---|---|------|
| 0 | 0 | 60 | 12 | A1 |
| 12 | 0 | 13 | 22 | B1 |
| 12 | 13 | 47 | 52 | C1 |
| 34 | 0 | 13 | 10 | B2 |
| 44 | 0 | 13 | 10 | B3 |
| 54 | 0 | 13 | 10 | B4 |
| 64 | — | — | 0 | PAGE_BREAK |
| 64 | 0 | 40 | 9 | D1 |
| 64 | 40 | 20 | 9 | SPACER |
| 73 | 0 | 30 | 38 | FORM |
| 73 | 30 | 30 | 38 | E1 |
| 111 | — | — | 0 | PAGE_BREAK |
| 111 | 0 | 60 | 34 | F1 |

## card_positions

```python
card_positions = {
    A1: {'x':  0, 'y':  0, 'w': 60, 'h': 12, 'cx':  0, 'cy':  0, 'cw': 12, 'ch':  5},
    B1: {'x':  0, 'y': 12, 'w': 13, 'h': 22, 'cx':  0, 'cy':  5, 'cw': 12, 'ch': 12},
    C1: {'x': 13, 'y': 12, 'w': 47, 'h': 52, 'cx':  0, 'cy': 17, 'cw': 12, 'ch': 20},
    B2: {'x':  0, 'y': 34, 'w': 13, 'h': 10, 'cx':  0, 'cy': 37, 'cw': 12, 'ch':  6},
    B3: {'x':  0, 'y': 44, 'w': 13, 'h': 10, 'cx':  0, 'cy': 43, 'cw': 12, 'ch':  6},
    B4: {'x':  0, 'y': 54, 'w': 13, 'h': 10, 'cx':  0, 'cy': 49, 'cw': 12, 'ch':  4},
    D1: {'x':  0, 'y': 64, 'w': 40, 'h':  9, 'cx':  0, 'cy': 53, 'cw': 12, 'ch':  5},
    E1: {'x': 30, 'y': 73, 'w': 30, 'h': 38, 'cx':  0, 'cy': 63, 'cw': 12, 'ch': 12},
    F1: {'x':  0, 'y':111, 'w': 60, 'h': 34, 'cx':  0, 'cy': 75, 'cw': 12, 'ch': 12},
}
```

Replace slot labels with actual integer cardIds.

## Special entry injection

```python
special_entries = [
    {'type': 'PAGE_BREAK', 'x': 0, 'y':  64, 'w': 60, 'h':  0, 'cx': 0, 'cy':  64, 'cw': 12, 'ch': 0},
    {'type': 'SPACER',     'x':40, 'y':  64, 'w': 20, 'h':  9, 'cx': 0, 'cy':  64, 'cw': 12, 'ch': 0},
    {'type': 'FORM',       'x': 0, 'y':  73, 'w': 30, 'h': 38, 'cx': 0, 'cy':  73, 'cw': 12, 'ch': 6},
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 111, 'w': 60, 'h':  0, 'cx': 0, 'cy': 111, 'cw': 12, 'ch': 0},
]
is_dynamic = False
```

## Compact grid notes

All card slots stack full-width (w=12). SPACER collapses to h=0. FORM becomes w=12, h=6.
