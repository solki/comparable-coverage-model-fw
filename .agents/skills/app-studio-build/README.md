# App Studio Build Skill

Step-by-step orchestrator for building Domo App Studio apps with native KPI cards. CLI-first via `community-domo-cli`.

## Skill Structure

```
app-studio-build/
├── SKILL.md          — 8-step build procedure: app, pages, theme, heroes, charts, filters, layout, nav
├── layout-builder.py — Reusable Python script for layout assembly (copy to working dir)
├── layouts/          — Layout reference files (one per pattern)
│   ├── layout-default-hero-grid.md
│   ├── layout-a-right-sidebar.md
│   ├── layout-b-symmetric-grid.md
│   ├── layout-c-left-column-feature.md
│   ├── layout-d-full-canvas.md
│   └── layout-e-left-filter-form.md
└── README.md         — This file
```

## How to Use

Read `SKILL.md` and follow Steps 1–8 in order. The skill delegates to:

- **`card-creation`** — Card body schema, chart type index, per-chart-type reference files

For layout assembly (Step 6), pick a layout from the index in `SKILL.md` and read the corresponding file in `layouts/`. Copy `card_positions`, `special_entries`, and `is_dynamic` into `layout-builder.py`.

Hero metric and filter card recipes are inlined in the skill (Steps 3 and 5) because they have specific failure modes that agents need at invocation time.

## When to Use This Skill

- Building a new App Studio app with native KPI cards
- Adding pages to an existing App Studio app
- Any dashboard build that uses Domo's native chart types (not pro-code)

For pro-code custom apps (React/Vite), use `basic-custom-app-build` instead.
