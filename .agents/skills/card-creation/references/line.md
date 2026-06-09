# Line Charts (16 types)

Trend lines, curved lines, step lines, symbol lines, stacked trends, and variance lines.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_trendline` | 180 | general, legend, grid_lines, data_label_settings, value_scale_y, line_labels_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_two_trendline` | 203 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), line_labels_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, total_line, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_curvedline` | 194 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), line_labels_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_stepline` | 163 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, data_table, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_symbolline` | 190 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_rttrendline` | 144 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), line_labels_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, multi-period_projection, gradient_colors, colors |
| `badge_stackedtrend` | 136 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_variance_line` | 143 | general, actual_line, target_line, legend, grid_lines, data_label_settings, value_scale_(left), line_labels_(right), category_scale_x, hover_text_settings, hints, number_format, scale_marker |
| `badge_spark_line` | 40 | general, value_options, change_value_options, line_options, hover_text_settings, number_format, colors |
| `badge_curved_symbolline` | 194 | general, legend, grid_lines, data_label_settings, value_scale_(left), value_scale_(right), line_labels_(right), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, outlier_filtering, scale_marker_range, scale_marker, regression_line, last_value_projection, multi-period_projection, gradient_colors, colors |
| `badge_horiz_trendline` | 142 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_horiz_curvedline` | 142 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_horiz_stepline` | 138 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_horiz_symbolline` | 141 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_horiz_curved_symbolline` | 141 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, outlier_filtering, scale_marker, gradient_colors, colors |
| `badge_horiz_stackedtrend` | 131 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |

## Notable Overrides

- `line_style` — Solid, Dashed, Dotted
- `line_thickness` — Line weight
- `outlier_filtering` — `outliers_above`, `outliers_below` to filter outlier data points
- `scale_marker_range` — Shaded range bands (`sm_min_val`, `sm_max_val`, `mkr_color`)
- `total_line` — Show aggregated total line (badge_two_trendline)
- `line_labels_(right)` — `show_line_labels`, `right_label_scale_display`
- `actual_line` / `target_line` — Variance line actual vs target styling
- `show_linear_regression` — Trend/regression line overlay
- `last_value_projection` / `multi-period_projection` — Forecasting projections
