# Bar Charts (24 types)

Standard, stacked, nested, percent, multi-axis, running total, overlay, and symbol bar variants.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_vert_bar` | 171 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_horiz_bar` | 152 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_stackedbar` | 178 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, regression_line, last_value_projection, multi-period_projection, colors, gradient_colors |
| `badge_horiz_stackedbar` | 158 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_multibar` | 179 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_horiz_multibar` | 147 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_nestedbar` | 129 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_nestedbar` | 122 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_percentbar` | 104 | general, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_percentbar` | 101 | general, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_100pct` | 125 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_100pct` | 123 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_dual_stackedbar` | 123 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_dual_stackedbar` | 118 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_rtbar` | 135 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, multi-period_projection, gradient_colors, colors |
| `badge_horiz_rtbar` | 118 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_rtmultibar` | 136 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, multi-period_projection, gradient_colors, colors |
| `badge_horiz_rtmultibar` | 118 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_rtstackedbar` | 142 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, multi-period_projection, gradient_colors, colors |
| `badge_horiz_rtstackedbar` | 124 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_bar_overlay` | 123 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_(left), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_bar_overlay` | 117 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_symbol` | 134 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_spark_bar` | 35 | general, value_options, change_value_options, hover_text_settings, number_format, colors |

## Notable Overrides

- `width_percentage` / `height_percentage` — Control bar thickness
- `fixed_bar_width` / `fixed_bar_height` — Absolute bar sizing
- `allow_wide_bars` / `allow_tall_bars` — Allow bars to exceed default width
- `datalabel_show_total` — Show stacked bar totals
- `regression_line` — Trend line on bar charts (vert_bar, vert_stackedbar)
- `last_value_projection` / `multi-period_projection` — Forecasting
- `value_scale_(left)` / `value_scale_(right)` — Dual Y axes on multibar
- `show_as_trellis` — Small multiples / trellis mode
