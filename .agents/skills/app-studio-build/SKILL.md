---
name: app-studio-build
description: Step-by-step orchestrator for building Domo App Studio apps with native KPI cards via community-domo-cli. Sequences app creation, pages, theme, hero metrics, native charts, filter cards, layout assembly, and navigation. CLI-first — no raw API calls.
---

# App Studio Build Orchestrator

Build a complete App Studio app with native cards, hero metrics, filters, and polished layout. Every operation uses `community-domo-cli`.

**Delegate to these skills for details:**
- `card-creation` — card body schema, chart type index, reference files for specific chart overrides

---

## Prerequisites

Before starting, you need:

1. **Dataset GUIDs** for every card. Discover columns:
```bash
community-domo-cli --output json datasets schema $DATASET_ID > schema.json
```
2. **Page definitions** — names, icons, which dataset powers each page
3. **Hero metric definitions** — which columns, aggregations, comparison periods
4. **Chart selections** — which `badge_*` type per page (vary across pages)

---

## Step 1: Create App + Pages

### Create the app

```bash
community-domo-cli --output json -y app-studio create \
  --body '{"title": "APP_TITLE", "description": "APP_DESCRIPTION"}' > app.json

APP_ID=$(python3 -c "import json; print(json.load(open('app.json'))['dataAppId'])")
LANDING_PAGE=$(python3 -c "import json; print(json.load(open('app.json'))['landingViewId'])")
```

### Create additional pages

One call per page. The landing page already exists — rename it if needed.

```bash
python3 -c "
import json
app = json.load(open('app.json'))
owner_id = app['owners'][0]['id']
body = {
    'owners': [{'id': owner_id, 'type': 'USER', 'displayName': None}],
    'type': 'dataappview', 'title': 'PAGE_NAME', 'pageName': 'PAGE_NAME',
    'locked': False, 'mobileEnabled': True, 'sharedViewPage': True, 'virtualPage': False
}
json.dump(body, open('view_body.json', 'w'))
"
community-domo-cli --output json -y app-studio create-view $APP_ID \
  --body-file view_body.json > view_PAGE_NAME.json
PAGE_ID=$(python3 -c "import json; print(json.load(open('view_PAGE_NAME.json'))['view']['pageId'])")
```

Repeat for each page. Track all page IDs.

---

## Step 2: Theme + Icon

### Apply theme

```bash
community-domo-cli --output json app-studio get $APP_ID > app_full.json
```

Modify `theme` in the response. Key theme standards:

```python
theme = app['theme']

# Zero-chrome mandatory standards
# theme keys are plural arrays — iterate, don't index directly
for comp in theme.get('components', []):
    comp['borderRadius'] = 0
    comp['borderWidth'] = 0
    comp['dropShadow'] = 'NONE'
    comp['itemBorderRadius'] = 0
    if isinstance(comp.get('padding'), dict):
        comp['padding'] = {'left': 0, 'right': 0, 'top': 0, 'bottom': 0}

for tbl in theme.get('tables', []):
    tbl['borderRadius'] = 0

for nb in theme.get('notebooks', []):
    if 'borderRadius' in nb:
        nb['borderRadius'] = 0

# isDynamic and density are set on the layout JSON in Step 6, not on the theme.

# Colors use a reference system — you cannot assign hex strings directly.
# theme['colors'] is an array of 60 color objects: {"id": "c1", "value": {"value": "#333333", "type": "RGB_HEX"}, ...}
# Color fields on components/pages hold references: {"value": "c56", "type": "COLOR_REFERENCE"}
# To change a color, look up the referenced ID and update its hex in theme['colors']:
#
#   target_id = theme['components'][0]['backgroundColor']['value']  # e.g. 'c56'
#   for color in theme['colors']:
#       if color['id'] == target_id:
#           color['value']['value'] = '#1A1A2E'
#           break
#
# Skip color changes unless you know the target color ID.
```

Write back:
```bash
community-domo-cli --output json -y app-studio update $APP_ID --body-file app_full.json
```

### Upload custom icon (optional)

```bash
community-domo-cli --output json -y files upload --file-path icon.png > icon.json
DATA_FILE_ID=$(python3 -c "import json; print(json.load(open('icon.json'))['dataFileId'])")
```

Set `iconDataFileId` and `navIconDataFileId` to `DATA_FILE_ID` in the app update body.

---

## Step 3: Hero Metrics

Heroes use `badge_pop_multi_value`. This is the most failure-prone card type — follow exactly.

### Required subscriptions

```json
{
  "subscriptions": {
    "big_number": {
      "name": "big_number",
      "columns": [{"column": "METRIC_COL", "aggregation": "SUM", "alias": "METRIC_NAME", "format": {"type": "abbreviated", "format": "#A"}}],
      "filters": []
    },
    "main": {
      "name": "main",
      "columns": [
        {"column": "DATE_COL", "mapping": "ITEM"},
        {"column": "METRIC_COL", "mapping": "VALUE", "aggregation": "SUM"}
      ],
      "filters": [],
      "orderBy": [],
      "groupBy": [{"column": "DATE_COL"}],
      "fiscal": false, "projection": false, "distinct": false
    }
  }
}
```

### Required chart config

```json
{
  "charts": {
    "main": {
      "component": "main",
      "chartType": "badge_pop_multi_value",
      "overrides": {},
      "goal": null
    }
  }
}
```

### Critical hero gotchas

| Rule | Why |
|------|-----|
| 3-4 heroes per page, SINGLE ROW | Never 5+, never 2 rows |
| `"format": {"type": "abbreviated", "format": "#A"}` only | Other format types (currency, percentage) cause 400 |
| Do NOT include `dateGrain` | Conflicts with subscription structure |

> **Note:** `dateRangeFilter` + `time_period` subscription (period-over-period comparison) causes HTTP 400 at the cards create endpoint. Omit both
> until resolved. Heroes will render as single-value KPI metrics without YoY delta.

Create one card per hero metric:
```bash
community-domo-cli --output json -y cards create \
  --body-file hero_metric.json --page-id $PAGE_ID > hero_card.json
```

---

## Step 4: Native Charts

Each page gets a primary visualization (full-width) plus 2-6 detail cards. **Vary chart types across pages** — don't use the same type everywhere.

### Chart selection strategy

| Data Pattern | Recommended Types |
|-------------|-------------------|
| Trend over time | `badge_two_trendline`, `badge_vert_area_overlay`, `badge_curvedline` |
| Category comparison | `badge_vert_bar`, `badge_horiz_bar`, `badge_vert_stackedbar` |
| Part-to-whole | `badge_donut`, `badge_vert_100pct`, `badge_treemap` |
| Ranking | `badge_horiz_bar`, `badge_funnel`, `badge_bump` |
| Correlation / scatter | `badge_xybubble`, `badge_xy_line` |
| Tabular detail | `badge_flex_table`, `badge_basic_table` |
| Combo (bar + line) | `badge_line_bar`, `badge_symbol_bar` |

### Create each card

1. Build the card body per the `card-creation` skill (Section 2: Body Schema), in the same skills directory as this file
2. Pick `chartType` from the chart type index (Section 5)
3. Read the relevant reference file from `card-creation/references/` (in the same skills directory as this file). Key references: `bar.md`, `line.md`, `pie.md`, `period-over-period.md`, `selector.md`, `table.md`.
4. Create via CLI:

```bash
community-domo-cli --output json -y cards create \
  --body-file chart_card.json --page-id $PAGE_ID > chart_response.json
```

Primary viz: width 60 in layout. Detail cards: width 20 or 30 (2-3 per row).

---

## Step 5: Filter Cards

Selectors that drive page-level filtering. Use `badge_dropdown_selector` for most filters.

### Filter card body

```json
{
  "definition": {
    "subscriptions": {
      "big_number": {
        "name": "big_number",
        "columns": [{"column": "FILTER_COL", "aggregation": "COUNT"}],
        "filters": []
      },
      "main": {
        "name": "main",
        "columns": [{"column": "FILTER_COL", "mapping": "ITEM"}],
        "filters": [],
        "groupBy": [{"column": "FILTER_COL"}],
        "orderBy": [], "fiscal": false, "projection": false, "distinct": false
      }
    },
    "formulas": {"dsUpdated": [], "dsDeleted": [], "card": []},
    "annotations": {"new": [], "modified": [], "deleted": []},
    "conditionalFormats": {"card": [], "datasource": []},
    "controls": [],
    "segments": {"active": [], "create": [], "update": [], "delete": []},
    "charts": {
      "main": {"component": "main", "chartType": "badge_dropdown_selector", "overrides": {}, "goal": null}
    },
    "dynamicTitle": {"text": [{"text": "FILTER_COL", "type": "TEXT"}]},
    "dynamicDescription": {"text": [{"text": "", "type": "TEXT"}], "displayOnCardDetails": true},
    "chartVersion": "12", "inputTable": false, "noDateRange": false,
    "title": "FILTER_COL", "description": ""
  },
  "dataProvider": {"dataSourceId": "DATASET_UUID"},
  "variables": true, "columns": false
}
```

**CRITICAL**: `big_number.columns` must NOT be empty for selectors — use COUNT on the filter column. Empty columns causes HTTP 400.

Create on first page, then share to other pages:
```bash
# Create on first page
community-domo-cli --output json -y cards create \
  --body-file filter.json --page-id $FIRST_PAGE > filter_resp.json
FILTER_ID=$(python3 -c "import json; print(json.load(open('filter_resp.json'))['id'])")

# Add to other pages (goes to appendix — layout-set moves it to canvas)
community-domo-cli -y pages add-card $OTHER_PAGE $FILTER_ID
```

---

## Step 6: Layout Assembly

Choose a layout from the table below (default is the Hero Grid). Read the corresponding
layout reference file for full grid coordinates, `card_positions`, and `special_entries`.

### Layout index

| Layout | File | isDynamic | Slots | Best for |
|--------|------|-----------|-------|----------|
| **Default: Hero Grid** | `layouts/layout-default-hero-grid.md` | False | Filters + heroes + primary viz + detail row | Standard dashboard with KPI metrics |
| **A: Right Sidebar** | `layouts/layout-a-right-sidebar.md` | True | Wide left + narrow right, 3 sections with page breaks | Master-detail, commentary panels |
| **B: Symmetric Grid** | `layouts/layout-b-symmetric-grid.md` | False | Full→halves→thirds→6-grid→full, separator | Data-dense comparison dashboards |
| **C: Left Column Feature** | `layouts/layout-c-left-column-feature.md` | True | Narrow left stack + wide right, two-panel lower | KPI sidebar with feature visualization |
| **D: Full Canvas** | `layouts/layout-d-full-canvas.md` | True | Single edge-to-edge slot | Embedded app, map, or full-bleed viz |
| **E: Left Filter + Form** | `layouts/layout-e-left-filter-form.md` | False | Left filters + wide right, spacer, form + card, full bottom | Data entry / interactive forms |

> **Read the layout reference file before building.** It contains the exact `card_positions`,
> `special_entries`, and `is_dynamic` values to paste into `layout-builder.py` or the inline script below.

> **Critical:** `cards create --page-id` automatically adds cards to the layout's `content` array
> as appendix entries. Always run `layout-get` AFTER creating all cards so the content array is
> populated. The Python builder below mutates those existing entries — it does not create new ones.
> Running `layout-get` before card creation will result in an empty content array with nothing to position.

```bash
community-domo-cli --output json app-studio layout-get $APP_ID $PAGE_ID > layout.json
```

### Default y-band grid pattern (Hero Grid)

| Band | y | height | Content |
|------|---|--------|---------|
| Banner | 0 | 14 | Page banner image (pro-code) or HEADER |
| Filters | 14 | 6 | Filter cards side-by-side |
| Heroes | 20 | 14 | 3-4 hero metrics in single row |
| Section header | 34 | 4 | HEADER text |
| Primary viz | 38 | 30 | Full-width chart (width 60) |
| Section header | 68 | 4 | HEADER text |
| Detail cards | 72 | 30 | 2-3 cards per row (width 20 or 30) |

### Content entry types

| Type | Required Fields |
|------|----------------|
| `CARD` | `contentKey`, `type: "CARD"`, `cardId`, `x`, `y`, `width`, `height`, `style: null`, `hideTitle: true/false`, `hideSummary: true`, `virtual: false`, `virtualAppendix: false` |
| `HEADER` | `contentKey`, `type: "HEADER"`, `text`, `x`, `y`, `width`, `height`, `virtual: false`, `virtualAppendix: false` |
| `PAGE_BREAK` | `contentKey`, `type: "PAGE_BREAK"`, `x`, `y`, `width`, `height: 0` — visual page boundary |
| `SEPARATOR` | `contentKey`, `type: "SEPARATOR"`, `x`, `y`, `width`, `height` — horizontal rule |
| `SPACER` | `contentKey`, `type: "SPACER"`, `x`, `y`, `width`, `height` — empty whitespace block |
| `FORM` | `contentKey`, `type: "FORM"`, `x`, `y`, `width`, `height` — embedded form region |

### Card layout content entry

```json
{
  "contentKey": 100,
  "type": "CARD",
  "cardId": CARD_ID_INT,
  "x": 0, "y": 38, "width": 60, "height": 30,
  "style": null,
  "hideTitle": false,
  "hideSummary": true,
  "hideBorder": false,
  "hideMargins": false,
  "fitToFrame": false,
  "virtual": false,
  "virtualAppendix": false,
  "children": null
}
```

**Hero card entry** — additional flags:
```json
{
  "hideTitle": true, "hideSummary": true,
  "hideBorder": true, "hideMargins": true, "fitToFrame": true,
  "style": null, "height": 14
}
```

**Filter card entry** — low-profile:
```json
{
  "hideTitle": true, "hideSummary": true,
  "hideBorder": true, "hideMargins": true, "fitToFrame": true,
  "style": null, "height": 6
}
```

### Build and apply layout

> **Shortcut:** Copy `layout-builder.py` (in the same skill directory as this file) to your working
> directory, fill in `card_positions`, `header_positions`, `special_entries`, and `is_dynamic` at the
> top (copy these values from the layout reference file), and run:
> `python3 layout-builder.py --layout layout_PAGE.json --out layout_PAGE_updated.json`
> The full inline script below is the same logic — use it if you need to customize beyond positions.

```python
import json, copy

layout = json.load(open('layout.json'))

# cards create --page-id puts every card in the appendix as a content entry.
# Build a cardId → contentKey lookup so positions can be keyed by cardId.
card_to_key = {}
for c in layout['content']:
    if c['type'] == 'CARD' and 'cardId' in c:
        card_to_key[c['cardId']] = c['contentKey']

# ── Define positions keyed by CARD ID (not contentKey) ──────────────────────
# Standard grid: total width = 60. Compact grid: total width = 12.
# hero=True  → hideTitle/hideSummary/hideBorder/hideMargins/fitToFrame all True, h=14
# filt=True  → same flags True, h=6
card_positions = {
    # CARD_ID: {'x': X, 'y': Y, 'w': W, 'h': H, 'cx': CX, 'cy': CY, 'cw': CW, 'ch': CH}
    # Hero example:   {'x':  0, 'y': 20, 'w': 15, 'h': 14, 'cx': 0, 'cy': 7,  'cw': 6,  'ch': 6,  'hero': True}
    # Filter example: {'x':  0, 'y': 14, 'w': 20, 'h':  6, 'cx': 0, 'cy': 0,  'cw': 12, 'ch': 4,  'filt': True}
    # Chart example:  {'x':  0, 'y': 38, 'w': 60, 'h': 30, 'cx': 0, 'cy': 19, 'cw': 12, 'ch': 20}
}

# Headers have no cardId — find their contentKey from the existing content array.
# layout['content'] will have one HEADER entry auto-created (text="Appendix").
# Add more by inspecting contentKeys after layout-get.
header_positions = {
    # CONTENT_KEY: {'text': 'Section Title', 'x': 0, 'y': 34, 'w': 60, 'h': 4, 'cx': 0, 'cy': 15, 'cw': 12, 'ch': 3}
}

# ── Build new arrays ─────────────────────────────────────────────────────────
new_content = []
std_template = []
cmp_template = []

# Preserve SEPARATOR (contentKey=0, template-only system entry — no matching content entry).
for entry in layout['standard']['template']:
    if entry.get('contentKey', -1) == 0:
        std_template.append({**entry, 'virtual': True, 'virtualAppendix': True})
for entry in layout['compact']['template']:
    if entry.get('contentKey', -1) == 0:
        cmp_template.append({**entry, 'virtual': True, 'virtualAppendix': True})

for c in layout['content']:
    key = c['contentKey']
    entry = copy.deepcopy(c)

    if c['type'] == 'HEADER' and key in header_positions:
        pos = header_positions[key]
        entry.update({'text': pos['text'], 'x': pos['x'], 'y': pos['y'],
                      'width': pos['w'], 'height': pos['h'],
                      'virtual': False, 'virtualAppendix': False})
        new_content.append(entry)
        std_template.append({'contentKey': key, 'type': 'HEADER',
                              'x': pos['x'], 'y': pos['y'], 'width': pos['w'], 'height': pos['h'],
                              'virtual': False, 'virtualAppendix': False, 'children': None})
        cmp_template.append({'contentKey': key, 'type': 'HEADER',
                              'x': pos['cx'], 'y': pos['cy'], 'width': pos['cw'], 'height': pos['ch'],
                              'virtual': False, 'virtualAppendix': False, 'children': None})

    elif c['type'] == 'CARD' and c.get('cardId') in card_positions:
        pos = card_positions[c['cardId']]
        hero = pos.get('hero', False)
        filt = pos.get('filt', False)
        flags = {'hideTitle': hero or filt, 'hideSummary': True,
                 'hideBorder': hero or filt, 'hideMargins': hero or filt,
                 'fitToFrame': hero or filt}
        entry.update({**flags, 'x': pos['x'], 'y': pos['y'],
                      'width': pos['w'], 'height': pos['h'],
                      'virtual': False, 'virtualAppendix': False})
        new_content.append(entry)
        std_template.append({**flags, 'contentKey': key, 'type': 'CARD',
                              'x': pos['x'], 'y': pos['y'], 'width': pos['w'], 'height': pos['h'],
                              'virtual': False, 'virtualAppendix': False, 'style': None, 'children': None})
        cmp_template.append({**flags, 'contentKey': key, 'type': 'CARD',
                              'x': pos['cx'], 'y': pos['cy'], 'width': pos['cw'], 'height': pos['ch'],
                              'virtual': False, 'virtualAppendix': False, 'style': None, 'children': None})

    else:
        # Leave in appendix (test cards, cards not yet positioned, etc.)
        entry.update({'virtual': True, 'virtualAppendix': True})
        new_content.append(entry)
        std_template.append({'contentKey': key, 'type': c['type'],
                              'x': 0, 'y': 0, 'width': 15, 'height': 14,
                              'virtual': True, 'virtualAppendix': True, 'style': None, 'children': None})
        cmp_template.append({'contentKey': key, 'type': c['type'],
                              'x': 0, 'y': 0, 'width': 6, 'height': 14,
                              'virtual': True, 'virtualAppendix': True, 'style': None, 'children': None})

# ── Special entries (PAGE_BREAK, SEPARATOR, SPACER, FORM) ────────────────────
# Copy these from the layout reference file. Empty list for default hero grid.
special_entries = [
    # {'type': 'PAGE_BREAK', 'x': 0, 'y': 51, 'w': 60, 'h': 0, 'cx': 0, 'cy': 51, 'cw': 12, 'ch': 0},
]

# Set from layout reference file. Default hero grid uses False.
is_dynamic = False

if special_entries:
    all_keys = [c.get('contentKey', 0) for c in new_content]
    all_keys += [e.get('contentKey', 0) for e in std_template]
    next_key = max(all_keys) + 100 if all_keys else 900
    for se in special_entries:
        ck = next_key
        next_key += 1
        base = {'contentKey': ck, 'type': se['type'],
                'virtual': False, 'virtualAppendix': False, 'children': None}
        new_content.append({**base, 'x': se['x'], 'y': se['y'],
                            'width': se['w'], 'height': se['h']})
        std_template.append({**base, 'x': se['x'], 'y': se['y'],
                              'width': se['w'], 'height': se['h']})
        cmp_template.append({**base, 'x': se['cx'], 'y': se['cy'],
                              'width': se['cw'], 'height': se['ch']})

layout['content'] = new_content
layout['standard']['template'] = std_template
layout['compact']['template'] = cmp_template
layout['isDynamic'] = is_dynamic
json.dump(layout, open('layout_updated.json', 'w'))

canvas = sum(1 for c in new_content if not c.get('virtualAppendix'))
appx   = sum(1 for c in new_content if c.get('virtualAppendix'))
print(f'Layout written: {canvas} canvas, {appx} appendix, isDynamic={is_dynamic}')
```

Apply:
```bash
community-domo-cli --output json -y app-studio layout-set $APP_ID $PAGE_ID \
  --body-file layout_updated.json
```

**Repeat for every page.**

---

## Step 7: Navigation

Set LEFT orientation with custom icons on every page.

```bash
community-domo-cli --output json app-studio get $APP_ID > app_nav.json
```

```python
import json
app = json.load(open('app_nav.json'))

app['navOrientation'] = 'LEFT'
app['showDomoNavigation'] = False
app['showTitle'] = False
app['showLogo'] = False

# nav['icon'] and nav['title'] are always silently ignored by the API — do not set them.
# Page titles in the nav come from the pageName set at create-view time, not from this update.
# To control a page's nav label, set 'pageName' and 'title' in the create-view body.

# Preserve system items (SEARCH, FAVORITES, etc.)
# They appear in navigations[] with type != 'VIEW' — don't remove them

json.dump(app, open('app_nav_updated.json', 'w'))
```

```bash
community-domo-cli --output json -y app-studio update $APP_ID --body-file app_nav_updated.json
```

> **Note:** `navOrientation`, `showDomoNavigation`, `showTitle`, `showLogo` update correctly via
> `app-studio update`. Nav entry `title` and `icon` fields are **always** silently ignored by this
> API — do not set them. Page nav labels come from `pageName` set at `create-view` time.

### Verified Domo-native icon names

Google Material icon names DO NOT WORK. Use only these:

| Category | Icons |
|----------|-------|
| Home | `home` |
| Dashboard | `analytics`, `pop-chart`, `chart-bar-vertical`, `select-chart`, `badge-layout-8` |
| Operations | `gauge`, `dataflow`, `cube-filled`, `completed-submissions` |
| Quality | `certified`, `checkbox-marked-outline`, `check-in-icon`, `approval-center` |
| Logistics | `globe`, `data-app`, `local_shipping`, `warehouse`, `shopping_cart` |
| Retail | `store`, `cube-filled`, `numbers`, `toolbox` |
| Financial | `money-universal`, `money`, `benchmark`, `books`, `calculator` |
| People | `people`, `person`, `person-card`, `person-plus` |
| Time | `clock`, `calendar-simple`, `calendar-time`, `alarm` |
| AI | `ai-chat`, `magic`, `wand`, `lightbulb`, `lightning-bolt` |
| Settings | `controls`, `pages-gear`, `code-tags`, `pencil-box` |

---

## Step 8: Verification

After all pages are complete:

1. **Check card counts**:
```bash
for PAGE in $LANDING_PAGE $PAGE2 $PAGE3 $PAGE4; do
  echo "Page $PAGE:"
  community-domo-cli --output json pages list-cards $PAGE | python3 -c "
import json,sys
data=json.load(sys.stdin)
cards=data.get('cards', [])
print(f'  {len(cards)} cards')
for c in cards: print(f'  - {c[\"id\"]}: {c.get(\"title\",\"untitled\")}')
"
done
```

2. **Report to user**:
   - App URL: `https://INSTANCE.domo.com/app-studio/APP_ID`
   - App ID and all page IDs
   - Card count per page
   - Any cards that failed creation (with error details)

---

## Global UI/UX Standards (Mandatory)

These apply to EVERY App Studio app built with this skill:

| Standard | Value |
|----------|-------|
| `borderRadius` | `0` everywhere — cards, tables, notebooks, components, buttons, tabs |
| `borderWidth` | `0` on all cards |
| `dropShadow` | `NONE` on all cards |
| `padding` | `0` on all cards |
| `isDynamic` | `false` — fixed-width layout |
| `density` | `{compact: 8, standard: 8}` |
| Controls color c8 | `#2563BE` |
| Heroes | SINGLE ROW, height 14, max 4, `hideTitle`/`hideSummary`/`hideBorder`/`hideMargins`/`fitToFrame` all true |
| Filters | Height 6, `style: null`, all hide flags true |
| Never duplicate apps | On retry, reuse existing `appId` |
| `navOrientation` | `LEFT` |
| `showDomoNavigation` | `false` when nav is LEFT |
