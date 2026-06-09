---
name: layout-b-symmetric-grid
description: Symmetric columns — full-width top, halves, thirds, six-slot equal grid, full-width bottom with separator
---

# Layout B: Symmetric Grid

**isDynamic:** False
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 129
**Canvas entry count:** 13 CARD + 2 PAGE_BREAK + 1 SEPARATOR

## Grid Diagram

| y | x | w | h | Slot |
|---|---|---|---|------|
| 0 | 0 | 60 | 13 | A1 |
| 13 | 0 | 30 | 14 | B1 |
| 13 | 30 | 30 | 14 | B2 |
| 27 | 0 | 20 | 13 | C1 |
| 27 | 20 | 20 | 13 | C2 |
| 27 | 40 | 20 | 13 | C3 |
| 40 | — | — | 0 | PAGE_BREAK |
| 40 | 0 | 20 | 28 | D1 |
| 40 | 20 | 20 | 28 | D2 |
| 40 | 40 | 20 | 28 | D3 |
| 68 | 0 | 20 | 28 | D4 |
| 68 | 20 | 20 | 28 | D5 |
| 68 | 40 | 20 | 28 | D6 |
| 96 | — | — | 0 | PAGE_BREAK |
| 96 | 0 | 60 | 30 | E1 |
| 126 | 0 | 60 | 3 | SEPARATOR |

## card_positions

```python
card_positions = {
    A1: {'x':  0, 'y':  0, 'w': 60, 'h': 13, 'cx':  0, 'cy':  0, 'cw': 12, 'ch':  6},
    B1: {'x':  0, 'y': 13, 'w': 30, 'h': 14, 'cx':  0, 'cy':  6, 'cw':  6, 'ch':  6},
    B2: {'x': 30, 'y': 13, 'w': 30, 'h': 14, 'cx':  6, 'cy':  6, 'cw':  6, 'ch':  6},
    C1: {'x':  0, 'y': 27, 'w': 20, 'h': 13, 'cx':  0, 'cy': 12, 'cw': 12, 'ch':  5},
    C2: {'x': 20, 'y': 27, 'w': 20, 'h': 13, 'cx':  0, 'cy': 17, 'cw': 12, 'ch':  5},
    C3: {'x': 40, 'y': 27, 'w': 20, 'h': 13, 'cx':  0, 'cy': 22, 'cw': 12, 'ch':  5},
    D1: {'x':  0, 'y': 40, 'w': 20, 'h': 28, 'cx':  0, 'cy': 27, 'cw': 12, 'ch': 10},
    D2: {'x': 20, 'y': 40, 'w': 20, 'h': 28, 'cx':  0, 'cy': 37, 'cw': 12, 'ch': 10},
    D3: {'x': 40, 'y': 40, 'w': 20, 'h': 28, 'cx':  0, 'cy': 47, 'cw': 12, 'ch': 10},
    D4: {'x':  0, 'y': 68, 'w': 20, 'h': 28, 'cx':  0, 'cy': 57, 'cw': 12, 'ch': 10},
    D5: {'x': 20, 'y': 68, 'w': 20, 'h': 28, 'cx':  0, 'cy': 67, 'cw': 12, 'ch': 10},
    D6: {'x': 40, 'y': 68, 'w': 20, 'h': 28, 'cx':  0, 'cy': 77, 'cw': 12, 'ch': 10},
    E1: {'x':  0, 'y': 96, 'w': 60, 'h': 30, 'cx':  0, 'cy': 87, 'cw': 12, 'ch': 20},
}
```

Replace slot labels with actual integer cardIds.

## Special entry injection

```python
special_entries = [
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 40, 'w': 60, 'h': 0, 'cx': 0, 'cy': 40, 'cw': 12, 'ch': 0},
    {'type': 'PAGE_BREAK', 'x': 0, 'y': 96, 'w': 60, 'h': 0, 'cx': 0, 'cy': 96, 'cw': 12, 'ch': 0},
    {'type': 'SEPARATOR',  'x': 0, 'y':126, 'w': 60, 'h': 3, 'cx': 0, 'cy':126, 'cw': 12, 'ch': 3},
]
is_dynamic = False
```

## Compact grid notes

Full-width (w=12) stacking. B1/B2 halves become w=6 side-by-side. Thirds (C1-C3) and grid cells (D1-D6) stack full-width individually.
