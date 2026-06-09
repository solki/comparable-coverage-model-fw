---
name: card-creation
description: Domo KPI card CRUD via community-domo-cli — body schema, column mapping, beast modes, chart type index with on-demand reference files, and gotchas.
---

# Domo Card CRUD Reference

> **CLI vs raw API**: All card operations use the `community-domo-cli`. No raw curl/fetch needed. The CLI wraps the Domo Product API endpoints and handles auth automatically.

Complete reference for programmatic KPI card management. 207 chart types documented with override data. 206/207 confirmed working (only `badge_line` fails).

---

## 1. CRUD Operations

### Create a Card

```bash
community-domo-cli --output json -y cards create \
  --body-file card.json --page-id $PAGE_ID > card_response.json

CARD_ID=$(python3 -c "import json; print(json.load(open('card_response.json'))['id'])")
```

`--page-id` is **required** for creation.

### Read a Card Definition

```bash
community-domo-cli --output json cards definition $CARD_ID > card_def.json
```

Returns `definition`, `dataSourceWrite`, `drillpath`, `columns`. See Gotchas for read/write format mismatches.

### Update a Card

```bash
community-domo-cli --output json -y cards update $CARD_ID \
  --body-file card_updated.json
```

Full body replacement — include ALL fields, not just changed ones. Always read first, modify, write back.

### Copy a Card (raw API — no CLI command)

```bash
curl -X POST "https://$INSTANCE/api/content/v1/cards/$CARD_ID/copy" \
  -H "x-domo-developer-token: $TOKEN" -H "Content-Type: application/json" -d '{}'
```

### Delete a Card (raw API — no CLI command)

```bash
curl -X DELETE "https://$INSTANCE/api/content/v1/cards/$CARD_ID" \
  -H "x-domo-developer-token: $TOKEN"
```

Permanent, cannot be undone.

### Supporting Operations

```bash
# Discover dataset columns before creating cards
community-domo-cli --output json datasets schema $DATASET_ID > schema.json

# List cards on a page
community-domo-cli --output json pages list-cards $PAGE_ID

# Add an existing card to another page (goes to appendix)
community-domo-cli -y pages add-card $PAGE_ID $CARD_ID

# Create a beast mode / variable
community-domo-cli --output json -y beast-modes create --body-file beastmode.json
```

---

## 2. Complete Body Schema

This is the exact structure required for CREATE and UPDATE operations.

```json
{
  "definition": {
    "subscriptions": {
      "big_number": {
        "name": "big_number",
        "columns": [
          {
            "column": "Revenue",
            "aggregation": "SUM",
            "alias": "Revenue",
            "format": {"type": "abbreviated", "format": "#A"}
          }
        ],
        "filters": []
      },
      "main": {
        "name": "main",
        "columns": [
          {"column": "Team", "mapping": "ITEM"},
          {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"}
        ],
        "filters": [],
        "orderBy": [],
        "groupBy": [{"column": "Team"}],
        "fiscal": false,
        "projection": false,
        "distinct": false
      }
    },
    "formulas": {
      "dsUpdated": [],
      "dsDeleted": [],
      "card": []
    },
    "annotations": {
      "new": [],
      "modified": [],
      "deleted": []
    },
    "conditionalFormats": {
      "card": [],
      "datasource": []
    },
    "controls": [],
    "segments": {
      "active": [],
      "create": [],
      "update": [],
      "delete": []
    },
    "charts": {
      "main": {
        "component": "main",
        "chartType": "badge_vert_bar",
        "overrides": {},
        "goal": null
      }
    },
    "dynamicTitle": {
      "text": [{"text": "My Card Title", "type": "TEXT"}]
    },
    "dynamicDescription": {
      "text": [{"text": "Card description here", "type": "TEXT"}],
      "displayOnCardDetails": true
    },
    "chartVersion": "12",
    "inputTable": false,
    "noDateRange": false,
    "title": "My Card Title",
    "description": "Card description here"
  },
  "dataProvider": {
    "dataSourceId": "DATASET_UUID_HERE"
  },
  "variables": true,
  "columns": false
}
```

### Field-by-Field Reference

#### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `definition` | object | Yes | Contains all card configuration |
| `dataProvider.dataSourceId` | string | Yes | Dataset UUID. **Must use `dataSourceId`, NOT `dsId`!** |
| `variables` | boolean | Yes | **Must be `true`**. |
| `columns` | boolean | Yes | **Must be `false`**. |

#### definition.subscriptions.big_number

Controls the summary number at the top of the card. Always required, but `columns` should be **empty for `badge_singlevalue`** (the card itself displays the number).

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Always `"big_number"` |
| `columns` | array | Empty `[]` for `badge_singlevalue`. First VALUE column for all other types. |
| `columns[].column` | string | Column name (for dataset columns) |
| `columns[].formulaId` | string | Beast mode ID (for calculated fields) |
| `columns[].aggregation` | string | `SUM`, `AVG`, `COUNT`, `MIN`, `MAX` |
| `columns[].alias` | string | Display name |
| `columns[].format` | object | `{"type": "abbreviated", "format": "#A"}` |
| `filters` | array | Always `[]` for big_number |

#### definition.subscriptions.main

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Always `"main"` |
| `columns` | array | All column definitions with mappings (see Section 3) |
| `filters` | array | Filter objects |
| `orderBy` | array | Sort definitions |
| `groupBy` | array | Auto-built from ITEM and SERIES columns: `[{"column": "Name"}]` |
| `fiscal` | boolean | `false` default |
| `projection` | boolean | `false` default |
| `distinct` | boolean | `false` default |

**Filter object structure:**
```json
{
  "column": "Type",
  "values": ["New Business"],
  "filterType": "LEGACY",
  "operand": "IN"
}
```

#### definition.formulas

| Field | Type | Description |
|-------|------|-------------|
| `dsUpdated` | array | Dataset-level formulas updated |
| `dsDeleted` | array | Dataset-level formulas deleted |
| `card` | array | Card-level beast modes (see Section 4) |

#### definition.charts.main

| Field | Type | Description |
|-------|------|-------------|
| `component` | string | Always `"main"` |
| `chartType` | string | One of 207 types (see Section 5) |
| `overrides` | object | Chart styling overrides (all values are strings) |
| `goal` | null/object | Goal line configuration |

#### definition.conditionalFormats — MUST be object

```json
{"card": [], "datasource": []}
```

#### definition.segments — MUST be object

```json
{"active": [], "create": [], "update": [], "delete": []}
```

#### definition.dynamicTitle / dynamicDescription

```json
{
  "text": [{"text": "Title goes here", "type": "TEXT"}]
}
```

`dynamicDescription` also has `"displayOnCardDetails": true`.

#### Other definition fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chartVersion` | string | `"12"` | Chart rendering version |
| `inputTable` | boolean | `false` | Whether card is an input table |
| `noDateRange` | boolean | `false` | Disable date range filtering |
| `title` | string | -- | Plain text title (also set dynamicTitle) |
| `description` | string | -- | Plain text description |

---

## 3. Column Mapping

### Mapping Types

| Mapping | Visual Role | Required | Description |
|---------|-------------|----------|-------------|
| `ITEM` | X-axis / Category | Yes (most charts) | The dimension/category axis |
| `VALUE` | Y-axis / Measure | Yes | The numeric value being measured |
| `SERIES` | Color / Legend | No | Groups data into colored series |

### Column Object Structure

**For dataset columns:**
```json
{
  "column": "Team",
  "mapping": "ITEM",
  "aggregation": "SUM",
  "alias": "Team Name",
  "format": {"type": "number", "format": "###,##0"}
}
```

**For beast mode columns:**
```json
{
  "formulaId": "calculation_123456",
  "mapping": "VALUE",
  "aggregation": "SUM",
  "alias": "Win Rate %"
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `column` | Yes* | Column name from the dataset |
| `formulaId` | Yes* | Beast mode legacy ID (use instead of `column` for calculated fields) |
| `mapping` | Yes | `ITEM`, `VALUE`, or `SERIES` |
| `aggregation` | No | `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `UNIQUE` |
| `alias` | No | Display name override |
| `format` | No | Number/date formatting object |

*One of `column` or `formulaId` is required.

### Examples by Chart Type

**Bar chart** (category + measure):
```json
[
  {"column": "Region", "mapping": "ITEM"},
  {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"}
]
```

**Stacked bar** (category + measure + series):
```json
[
  {"column": "Region", "mapping": "ITEM"},
  {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"},
  {"column": "Product Line", "mapping": "SERIES"}
]
```

**Single value** (measure only):
```json
[
  {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM", "alias": "Total Revenue"}
]
```

**Table** (multiple items):
```json
[
  {"column": "Name", "mapping": "ITEM"},
  {"column": "Department", "mapping": "ITEM"},
  {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"},
  {"column": "Deals", "mapping": "VALUE", "aggregation": "COUNT"}
]
```

### groupBy Auto-Generation

Build `groupBy` from all ITEM and SERIES columns:
```python
group_by = []
for c in columns:
    if c.get("mapping") in ("ITEM", "SERIES") and "column" in c:
        group_by.append({"column": c["column"]})
```

---

## 4. Beast Modes

### Card-Level vs Dataset-Level

| Scope | Storage | Visibility | How to Reference |
|-------|---------|------------|-----------------|
| **Card-level** | `definition.formulas.card[]` | Only on this card | Included inline in card body |
| **Dataset-level** | Created via API | All cards using that dataset | Referenced by `formulaId` |

### Creating a Beast Mode (Dataset-Level)

```bash
community-domo-cli --output json -y beast-modes create \
  --body-file beastmode.json > bm_response.json
```

Body:
```json
{
  "name": "Revenue per Deal",
  "owner": 705231757,
  "locked": false,
  "global": false,
  "expression": "SUM(`Distinct Closed Won ACV`) / COUNT(`Opportunity ID`)",
  "links": [
    {
      "resource": {"type": "DATA_SOURCE", "id": "DATASET_UUID"},
      "visible": true,
      "active": false,
      "valid": "VALID"
    }
  ],
  "aggregated": true,
  "analytic": false,
  "nonAggregatedColumns": [],
  "dataType": "DECIMAL",
  "status": "VALID",
  "cacheWindow": "non_dynamic",
  "columnPositions": [],
  "functions": [],
  "functionTemplateDependencies": [],
  "archived": false,
  "hidden": false,
  "variable": false
}
```

The response includes `id` (UUID) and `legacyId` — use `legacyId` as `formulaId` in card columns.

### dataType Options

| Value | Use For |
|-------|---------|
| `DECIMAL` | Currency, percentages, ratios (default) |
| `LONG` | Whole numbers, counts |
| `DOUBLE` | High-precision decimals |
| `STRING` | Text/category results |
| `DATE` | Date calculations |

---

## 5. Chart Type Index

207 chart types across 22 groups. Pick a `badge_*` type string from the index below, then read the corresponding reference file for override details.

> `badge_line` is the only type that returns HTTP 400 on creation. Use `badge_two_trendline` or `badge_spark_line` instead.

| Group | Count | Types | Reference |
|-------|-------|-------|-----------|
| **Bar** | 24 | `badge_vert_bar`, `badge_horiz_bar`, `badge_vert_stackedbar`, `badge_horiz_stackedbar`, `badge_vert_multibar`, `badge_horiz_multibar`, `badge_vert_nestedbar`, `badge_horiz_nestedbar`, `badge_vert_percentbar`, `badge_horiz_percentbar`, `badge_vert_100pct`, `badge_horiz_100pct`, `badge_vert_dual_stackedbar`, `badge_horiz_dual_stackedbar`, `badge_vert_rtbar`, `badge_horiz_rtbar`, `badge_vert_rtmultibar`, `badge_horiz_rtmultibar`, `badge_vert_rtstackedbar`, `badge_horiz_rtstackedbar`, `badge_vert_bar_overlay`, `badge_horiz_bar_overlay`, `badge_vert_symbol`, `badge_spark_bar` | [references/bar.md](references/bar.md) |
| **Line** | 16 | `badge_trendline`, `badge_two_trendline`, `badge_curvedline`, `badge_stepline`, `badge_symbolline`, `badge_rttrendline`, `badge_stackedtrend`, `badge_variance_line`, `badge_spark_line`, `badge_curved_symbolline`, `badge_horiz_trendline`, `badge_horiz_curvedline`, `badge_horiz_stepline`, `badge_horiz_symbolline`, `badge_horiz_curved_symbolline`, `badge_horiz_stackedtrend` | [references/line.md](references/line.md) |
| **Combo** | 18 | `badge_line_bar`, `badge_line_stackedbar`, `badge_line_clusterbar`, `badge_vert_bar_line`, `badge_horiz_bar_line`, `badge_curved_line_bar`, `badge_curved_line_stackedbar`, `badge_horiz_line_bar`, `badge_horiz_line_clusterbar`, `badge_horiz_line_stackedbar`, `badge_vert_100pct_linebar`, `badge_horiz_100pct_linebar`, `badge_vert_nested_linebar`, `badge_horiz_nested_linebar`, `badge_symbol_bar`, `badge_symbol_stackedbar`, `badge_horiz_symbol_bar`, `badge_horiz_symbol_stackedbar` | [references/barline.md](references/barline.md) |
| **Area + Dot Plot** | 26 | `badge_vert_area_overlay`, `badge_horiz_area_overlay`, `badge_vert_100pct_area`, `badge_horiz_100pct_area`, `badge_vert_curved_area_overlay`, `badge_horiz_curved_area_overlay`, `badge_vert_curved_stacked_area`, `badge_horiz_curved_stacked_area`, `badge_vert_curved_100pct_area`, `badge_horiz_curved_100pct_area`, `badge_vert_step_area_overlay`, `badge_horiz_step_area_overlay`, `badge_vert_step_stacked_area`, `badge_horiz_step_stacked_area`, `badge_vert_step_100pct_area`, `badge_horiz_step_100pct_area`, `badge_vert_dotplot_overlay`, `badge_horiz_dotplot_overlay`, `badge_vert_multi_dotplot`, `badge_horiz_multi_dotplot`, `badge_vert_stacked_dotplot`, `badge_horiz_stacked_dotplot`, `badge_vert_line_multi_dotplot`, `badge_horiz_line_multi_dotplot`, `badge_vert_line_stacked_dotplot`, `badge_horiz_line_stacked_dotplot` | [references/area.md](references/area.md) |
| **Pie / Donut / Rose** | 5 | `badge_pie`, `badge_donut`, `badge_nautilus`, `badge_nautilus_donut`, `badge_nightingale_rose` | [references/pie.md](references/pie.md) |
| **Tables** | 5 | `badge_basic_table`, `badge_pivot_table`, `badge_flex_table`, `badge_table`, `badge_heatmap_table` | [references/table.md](references/table.md) |
| **Gauges + Multi-Value** | 16 | `badge_singlevalue`, `badge_filledgauge`, `badge_gauge`, `badge_facegauge`, `badge_shapegauge`, `badge_compgauge`, `badge_compfillgauge_basic`, `badge_compfillgauge_adv`, `badge_progressbar`, `badge_radial_progress`, `badge_multi_radial_progress`, `badge_in_range_gauge`, `badge_imagegauge`, `badge_bullet`, `badge_multi_value`, `badge_multi_value_cols` | [references/gauge.md](references/gauge.md) |
| **Maps** | 42 | `badge_world_map`, `badge_map`, `badge_map_us_state`, `badge_map_us_county`, `badge_map_latlong`, `badge_map_latlong_route`, + 36 country maps | [references/map.md](references/map.md) |
| **Specialty** | 16 | `badge_treemap`, `badge_funnel`, `badge_funnel_bars`, `badge_funnel_swing`, `badge_waffle`, `badge_word_cloud`, `badge_stream`, `badge_stream_funnel`, `badge_slope`, `badge_bump`, `badge_pareto`, `badge_heatmap`, `badge_gantt`, `badge_gantt_dep`, `badge_gantt_percent`, `badge_calendar` | [references/specialty.md](references/specialty.md) |
| **Data Science** | 6 | `badge_ds_forecasting`, `badge_ds_outliers`, `badge_ds_pred_modeling`, `badge_ds_spc`, `badge_correlation_matrix`, `badge_confusion_matrix` | [references/data-science.md](references/data-science.md) |
| **Period over Period** | 13 | `badge_pop_trendline`, `badge_pop_trendline_var`, `badge_pop_rttrendline`, `badge_pop_bar_line`, `badge_pop_bar_line_var`, `badge_pop_line_bar`, `badge_pop_line_bar_var`, `badge_pop_vert_multibar`, `badge_pop_filledgauge`, `badge_pop_shapegauge`, `badge_pop_multi_value`, `badge_pop_progressbar`, `badge_pop_flex_table` | [references/period-over-period.md](references/period-over-period.md) |
| **Statistical** | 8 | `badge_vert_histogram`, `badge_horiz_histogram`, `badge_vert_boxplot`, `badge_horiz_boxplot`, `badge_vert_waterfall`, `badge_horiz_waterfall`, `badge_xy_line`, `badge_xybubble` | [references/statistical.md](references/statistical.md) |
| **Selectors** | 6 | `badge_checkbox_selector`, `badge_date_selector`, `badge_dropdown_selector`, `badge_radio_selector`, `badge_range_selector`, `badge_slicer` | [references/selector.md](references/selector.md) |
| **Text + Small Charts** | 6 | `badge_textbox`, `badge_dynamic_textbox`, `badge_vert_marimekko`, `badge_horiz_marimekko`, `badge_vert_facetedbar`, `badge_horiz_facetedbar` | [references/small-charts.md](references/small-charts.md) |

---

## Common Override Categories

Most chart types share these standard override categories:

| Category | Purpose | Key Overrides |
|----------|---------|---------------|
| **general** | Fonts, sorting, limits | `default_font_family`, `font_size` (Smaller/Larger/Largest), `total_sort`, `display_limit`, `hide_interactivity`, `disable_animation` |
| **legend** | Legend position and styling | `lrg_legend_position` (Top/Bottom/Hide), `details_legend_position`, `legend_font_family` |
| **bar_settings** | Bar width/height | `width_percentage`, `fixed_bar_width`, `allow_wide_bars` |
| **grid_lines** | Grid, zero lines, calculated lines | `hide_value_gridlines`, `grid_line_color`, `zero_line_color`, `calculated_line` (Median/Average) |
| **data_label_settings** | Value labels on chart | `show_data_label` (Always/Always - Rotated), `datalabel_position`, `datalabel_fnt_clr`, `decimal_places_dl` |
| **value_scale_y** | Y-axis formatting | `title_y`, `label_format_y` (Number/Currency/Percentage), `divide_value_scale_by_y`, `value_scale_min`, `value_scale_max`, `log_scale_y` |
| **category_scale_x** | X-axis formatting | `title_x`, `cat_scale_show_labels`, `cat_scale_manual_rotate`, `max_label_length`, `never_use_time_scale` |
| **hover_text_settings** | Tooltip formatting | `hover_text`, `hover_format`, `decimal_places_hvr` |
| **number_format** | Currency/decimal config | `currency_symbol`, `currency_sym_position`, `decimal_separator`, `thousands_separator` |
| **gradient_colors** | Color gradients | `use_gradient_colors`, `gradient_start_fill_color`, `gradient_end_fill_color`, `gradient_by_value` |
| **scale_marker** | Reference lines/ranges | `sm_type` (Line/Range/Quantiles), `sm_val_type`, `sm_value`, `sm_line_color` |
| **colors** | Series colors | `series_1_color` (hex string) |

### Override Value Types

| Type | Format | Example |
|------|--------|---------|
| `boolean` | `"true"` or `"false"` (as strings) | `"use_gradient_colors": "true"` |
| `string` | Free text or hex color | `"gradient_start_fill_color": "#99CCEEFF"` |
| `float` | Number as string | `"display_limit": "10"` |
| `select_list` | One of the predefined values | `"font_size": "Largest"` |

**All override values are strings**, even booleans and numbers.

---

## 6. Conditional Formats

The structure **must be an object**, not an array.

```json
"conditionalFormats": {
  "card": [
    {
      "type": "COLOR",
      "column": "Revenue",
      "rules": [
        {"min": 0, "max": 50000, "color": "#FF0000", "label": "Below Target"},
        {"min": 50000, "max": 100000, "color": "#FFAA00", "label": "Near Target"},
        {"min": 100000, "color": "#00AA00", "label": "Above Target"}
      ]
    }
  ],
  "datasource": []
}
```

Passing `conditionalFormats` as an array `[]` instead of `{card:[], datasource:[]}` causes HTTP 400. The Domo UI returns it as an array when reading — convert to object before writing.

---

## 7. Gotchas

### Critical — Will Cause Failures

| Gotcha | Details |
|--------|---------|
| **`dataProvider.dataSourceId` NOT `dsId`** | The field name is `dataSourceId`. Using `dsId` silently fails. |
| **`variables: true` required at root** | Must be present at root level. |
| **`columns: false` required at root** | Must be present at root level. |
| **Both subscriptions required** | Must include BOTH `big_number` AND `main`. Missing either causes HTTP 400. |
| **`conditionalFormats` must be object** | `{"card":[], "datasource":[]}`. Passing `[]` causes HTTP 400. |
| **`segments` must be object** | `{"active":[], "create":[], "update":[], "delete":[]}`. Passing `[]` causes HTTP 400. |
| **`badge_line` fails** | Always returns HTTP 400. Use `badge_two_trendline` or `badge_spark_line`. |
| **CREATE requires `--page-id`** | `cards create --page-id $PAGE_ID` — mandatory. |
| **UPDATE uses NO page-id** | `cards update $CARD_ID` — card ID only. |

### Important — Affects Behavior

| Gotcha | Details |
|--------|---------|
| **Override values are strings** | Even booleans (`"true"`) and numbers (`"10"`) must be strings. |
| **UPDATE replaces entire definition** | Full replacement. Read first, modify, write back. |
| **READ→WRITE format mismatches** | Fix before updating: `formulas` (read=`[]`, write=`{"dsUpdated":[],"dsDeleted":[],"card":[]}`), `conditionalFormats` (read=`[]`, write=`{"card":[],"datasource":[]}`), `annotations` (read=`[]`, write=`{"new":[],"modified":[],"deleted":[]}`), `segments` (read=`{"active":[],"definitions":[]}`, write=`{"active":[],"create":[],"update":[],"delete":[]}`). Also add `title`, `description`, `noDateRange` if missing; remove `modified`, `allowTableDrill`. |
| **`groupBy` auto-generation** | Build from all ITEM and SERIES columns. Missing this = no grouping = all values aggregated into one. |
| **`big_number` for singlevalue** | `badge_singlevalue` needs `columns: []` in big_number. All other types: first VALUE column. |
| **PoP cards need `dateRangeFilter`** | `badge_pop_*` cards show "0" comparison unless: date column with `mapping:"ITEM"`, `aggregation:"MAX"` in main; `dateRangeFilter` with `dateTimeRange` and `periods`; `time_period` subscription. Remove `dateGrain` before adding `periods` (they conflict). |
| **Selector cards need big_number columns** | Empty `big_number.columns` causes `400 {"message":"big_number subscription missing select columns"}`. Use COUNT on the filtering column for dropdowns, MAX for date selectors. |

---

## Quick Reference

```
CREATE:  cards create --body-file card.json --page-id PAGE_ID
READ:    cards definition CARD_ID
UPDATE:  cards update CARD_ID --body-file card.json
COPY:    POST /content/v1/cards/CARD_ID/copy  (raw API)
DELETE:  DELETE /content/v1/cards/CARD_ID      (raw API)

Required root: variables=true, columns=false
Required data: dataProvider.dataSourceId (NOT dsId)
Required subs: big_number AND main
conditionalFormats: {card:[], datasource:[]}  (OBJECT)
segments:           {active:[], create:[], update:[], delete:[]}  (OBJECT)

Line charts: badge_two_trendline (NOT badge_line)
Total types: 207 (206 work, badge_line fails)
```
