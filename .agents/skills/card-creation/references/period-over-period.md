# Period over Period Charts (13 types)

PoP cards compare current period vs prior period. They require special `dateRangeFilter` and `time_period` subscription configuration beyond normal chart types.

## CRITICAL: PoP Configuration

PoP cards show "0" for the comparison value unless properly configured:

1. **Date column** in `main` subscription with `"mapping": "ITEM"` and `"aggregation": "MAX"`
2. **`dateRangeFilter`** on the date column with `dateTimeRange` and `periods` array:
```json
{
  "column": "Date_Column",
  "dateTimeRange": { "dateType": "RELATIVE", "rangePeriod": "CURRENT_AND_PREVIOUS" },
  "periods": [
    { "enabled": true, "name": "Current", "periodType": "CURRENT", "interval": "YEAR" },
    { "enabled": true, "name": "Previous", "periodType": "PRIOR", "interval": "YEAR" }
  ]
}
```
3. **`time_period`** subscription:
```json
"time_period": {
  "name": "time_period",
  "columns": [{"column": "Date_Column", "aggregation": "MAX", "mapping": "ITEM"}],
  "filters": [],
  "groupBy": [{"column": "Date_Column"}]
}
```
4. **Remove `dateGrain`** from the main subscription before adding `periods` — they conflict.
5. Set `"interval": "YEAR"` (not MONTH) for hero metrics showing YoY comparison.

## Types

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_pop_trendline` | 146 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_trendline_var` | 133 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_rttrendline` | 134 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), line_labels_(right), category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_bar_line` | 135 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_bar, value_scale_line, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_bar_line_var` | 137 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_bar, value_scale_line, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_line_bar` | 125 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_line_bar_var` | 133 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_vert_multibar` | 108 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_pop_filledgauge` | 36 | general, target, min_max, number_format |
| `badge_pop_shapegauge` | 52 | general, range_1 through range_10, out_of_range, data_label_settings, hover_text_settings |
| `badge_pop_multi_value` | 69 | general, title_options, value_options, change_value_options, additional_text_options, date_grain_options, tooltip_options, number_format |
| `badge_pop_progressbar` | 22 | general, color_range_1 through color_range_4 |
| `badge_pop_flex_table` | 74 | general, column_definitions, header_row, graph_settings, graph_data_label_settings, change_value_options, regression_line, colors |

## Notable Overrides

- **PoP trendline variants**: Same as regular trendlines but with `periods` comparison built in. `_var` variants add a variance band.
- **`badge_pop_multi_value`**: The hero metric card. Overrides: `comp_val_displayed` (percent_change/point_change/value), `comp_data_used` (period_1 vs period_2), `addl_text` ("Prior Year"), `show_date_grain`, `gauge_layout`, `gauge_sizing`.
- **`badge_pop_filledgauge`** / **`badge_pop_shapegauge`**: PoP gauge comparisons. Same overrides as non-PoP versions.
- **`badge_pop_progressbar`**: PoP progress bar with color ranges.
- **`badge_pop_flex_table`**: PoP flex table with inline charts.
