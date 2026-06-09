# Tables (5 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_basic_table` | 131 | general, row_height, sorting, header_row, total_row, subtotal_rows, alignment, colors, heatmap, excel_export |
| `badge_pivot_table` | 135 | general, row_height, sorting, header_row, header_col, totals, subtotals, colors, excel_export |
| `badge_flex_table` | 71 | general, column_definitions, header_row, graph_settings, graph_data_label_settings, change_value_options, regression_line, colors |
| `badge_table` | 70 | general, header_row, total_row, subtotal_rows, alignment, attribute, colors |
| `badge_heatmap_table` | 74 | theme, general, scale, header_row, total_row, subtotal_rows, alignment, attribute, colors |

## Notable Overrides

- `padding` / `header_padding` / `total_padding` — Row height controls
- `enable_sorting` / `alphanumeric_sorting` — Interactive sorting
- `header_row_fill_color` / `header_row_font_color` — Header styling
- `total_row` / `total_row_label` / `total_row_suppress_count` — Total row config
- `subtotal_rows` / `all_group_names` — Subtotal grouping
- `use_heatmap_colors` / `color_theme` / `range_by_column` — Heatmap mode (basic_table)
- `column_definitions` — Inline chart config (flex_table)
- `graph_settings` / `graph_data_label_settings` — Inline chart styling (flex_table)
- `excel_export_row_limit` — Export limits
- `use_logscale` — Log scale for heatmap_table
