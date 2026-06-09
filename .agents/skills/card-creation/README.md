# Card Creation Skill

Programmatic KPI card CRUD for Domo via `community-domo-cli`. Covers 207 chart types with full body schema, column mapping, beast modes, and override catalogs.

## Skill Structure

```
card-creation/
├── SKILL.md              — Core: CRUD, body schema, column mapping, beast modes, chart type index, gotchas
├── README.md             — This file
└── references/
    ├── bar.md            — Bar charts (24 types)
    ├── line.md           — Line charts (16 types)
    ├── barline.md        — Combo bar+line (18 types)
    ├── area.md           — Area + dot plot (26 types)
    ├── pie.md            — Pie / donut / rose (5 types)
    ├── table.md          — Tables (5 types)
    ├── gauge.md          — Single value, gauges, multi-value (16 types)
    ├── map.md            — Maps (42 types)
    ├── specialty.md      — Treemap, funnel, waffle, Gantt, etc. (16 types)
    ├── data-science.md   — Forecasting, outliers, SPC, matrices (6 types)
    ├── period-over-period.md — PoP comparison charts (13 types)
    ├── statistical.md    — Histogram, box plot, waterfall, scatter (8 types)
    ├── selector.md       — Filter selectors + App Studio patterns (6 types)
    ├── small-charts.md   — Text, marimekko, faceted bar (6 types)
    └── examples.md       — CLI workflows, read→modify→update, Python helper
```

## How to Use

1. **Always read `SKILL.md` first** — it has everything needed to create a card: body schema, column mapping, and the chart type index.
2. **Read a reference file only when you need chart-specific overrides** — the index in SKILL.md Section 5 maps chart groups to reference files.
3. For code examples and the `build_card_body()` Python helper, see `references/examples.md`.
