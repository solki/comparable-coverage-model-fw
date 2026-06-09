---
name: layout-default-hero-grid
description: Horizontal band grid — filters, hero metrics row, section headers, full-width primary viz, detail card rows
---

# Layout Default: Hero Grid

**isDynamic:** False
**Total width:** 60 (standard) / 12 (compact)
**Total height:** 102
**Canvas entry count:** Variable CARD count, no PAGE_BREAK

## Grid Diagram

| Band | y | x | w | h | Slot |
|------|---|---|---|---|------|
| Banner | 0 | 0 | 60 | 14 | HEADER or pro-code banner |
| Filters | 14 | 0+ | 20 each | 6 | F1, F2, F3 (side-by-side) |
| Heroes | 20 | 0+ | 15 each | 14 | H1, H2, H3, H4 (single row) |
| Section header | 34 | 0 | 60 | 4 | HEADER |
| Primary viz | 38 | 0 | 60 | 30 | A1 |
| Section header | 68 | 0 | 60 | 4 | HEADER |
| Detail cards | 72 | 0+ | 20 or 30 | 30 | B1, B2, B3 (2-3 per row) |

## card_positions

```python
card_positions = {
    # Filters — side-by-side, 3 filters at width 20 each
    F1: {'x':  0, 'y': 14, 'w': 20, 'h':  6, 'cx': 0, 'cy':  0, 'cw': 12, 'ch': 4, 'filt': True},
    F2: {'x': 20, 'y': 14, 'w': 20, 'h':  6, 'cx': 0, 'cy':  4, 'cw': 12, 'ch': 4, 'filt': True},
    F3: {'x': 40, 'y': 14, 'w': 20, 'h':  6, 'cx': 0, 'cy':  8, 'cw': 12, 'ch': 4, 'filt': True},
    # Heroes — single row, 4 heroes at width 15 each
    H1: {'x':  0, 'y': 20, 'w': 15, 'h': 14, 'cx': 0, 'cy': 12, 'cw': 6, 'ch': 6, 'hero': True},
    H2: {'x': 15, 'y': 20, 'w': 15, 'h': 14, 'cx': 6, 'cy': 12, 'cw': 6, 'ch': 6, 'hero': True},
    H3: {'x': 30, 'y': 20, 'w': 15, 'h': 14, 'cx': 0, 'cy': 18, 'cw': 6, 'ch': 6, 'hero': True},
    H4: {'x': 45, 'y': 20, 'w': 15, 'h': 14, 'cx': 6, 'cy': 18, 'cw': 6, 'ch': 6, 'hero': True},
    # Primary visualization — full width
    A1: {'x':  0, 'y': 38, 'w': 60, 'h': 30, 'cx': 0, 'cy': 28, 'cw': 12, 'ch': 20},
    # Detail cards — 3 per row at width 20
    B1: {'x':  0, 'y': 72, 'w': 20, 'h': 30, 'cx': 0, 'cy': 52, 'cw': 12, 'ch': 15},
    B2: {'x': 20, 'y': 72, 'w': 20, 'h': 30, 'cx': 0, 'cy': 67, 'cw': 12, 'ch': 15},
    B3: {'x': 40, 'y': 72, 'w': 20, 'h': 30, 'cx': 0, 'cy': 82, 'cw': 12, 'ch': 15},
}
```

Replace slot labels (F1, H1, A1, B1, etc.) with actual integer cardIds from your build. Remove unused slots — not every page needs all filters/heroes/details.

## Special entry injection

None required. No PAGE_BREAK, SEPARATOR, SPACER, or FORM entries.

```python
special_entries = []
is_dynamic = False
```

## Compact grid notes

Filters and heroes stack full-width (w=12). Heroes pair up two per row (cw=6). Detail cards stack full-width. All vertical sequential.
