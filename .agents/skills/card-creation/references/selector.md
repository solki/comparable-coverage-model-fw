# Selector Charts (6 types)

Interactive filter controls. Used in dashboards and App Studio layouts to drive page filters.

## CRITICAL: Selectors require big_number columns

Empty `big_number.columns` causes HTTP 400 with `"big_number subscription missing select columns"`. 

- **Dropdown/Checkbox/Radio/Slicer**: COUNT on the filtering column in `big_number`:
```json
"big_number": {
  "name": "big_number",
  "columns": [{"column": "Category", "aggregation": "COUNT"}],
  "filters": []
}
```
- **Date Selector**: MAX on the date column:
```json
"big_number": {
  "name": "big_number",
  "columns": [{"column": "Date", "aggregation": "MAX"}],
  "filters": []
}
```
- **Range Selector**: MAX on the numeric column.

## Types

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_checkbox_selector` | 10 | general, display_settings |
| `badge_date_selector` | 8 | general, date_range, preset_ranges |
| `badge_dropdown_selector` | 13 | general, display_settings, search_settings |
| `badge_radio_selector` | 9 | general, display_settings |
| `badge_range_selector` | 11 | general, range_settings |
| `badge_slicer` | 25 | general, display_settings, search_settings, slicer_settings |

## Notable Overrides

- `multi_select` — Allow multiple selections (checkbox/slicer)
- `default_selection` — Pre-selected value(s)
- `search_enabled` — Search bar in dropdown/slicer
- `sort_order` — Ascending/Descending/None for option ordering
- `show_all_option` — "All" toggle for clearing filters
- `hide_card_header` — Remove the header for cleaner dashboard embedding
- `show_apply_button` — Require explicit "Apply" vs immediate filtering

## App Studio Filter Card Pattern

For App Studio layouts, selectors should use the **low-profile style**:

```json
{
  "definition": {
    "charts": {
      "main": {
        "chartType": "badge_dropdown_selector",
        "overrides": {}
      }
    },
    "subscriptions": {
      "big_number": {
        "name": "big_number",
        "columns": [{"column": "Category", "aggregation": "COUNT"}],
        "filters": []
      },
      "main": {
        "name": "main",
        "columns": [{"column": "Category", "mapping": "ITEM"}],
        "filters": [],
        "groupBy": [{"column": "Category"}],
        "orderBy": []
      }
    }
  }
}
```

**Layout content entry**: height 6, `style: null`, `hideTitle: true`, `hideSummary: true`. See the `app-studio-build` skill for full layout assembly.
