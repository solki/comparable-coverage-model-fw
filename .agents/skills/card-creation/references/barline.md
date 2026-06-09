# Combo Charts (18 types)

Line + bar, symbol + bar, curved line + bar, and nested line + bar combinations.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_line_bar` | 147 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, last_bar_value_projection, last_line_value_projection, gradient_colors, colors |
| `badge_line_stackedbar` | 147 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_line_clusterbar` | 144 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_bar_line` | 131 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_bar, value_scale_line, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_bar_line` | 126 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_bar, value_scale_line, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_curved_line_bar` | 130 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_curved_line_stackedbar` | 136 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_line_bar` | 127 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_line_clusterbar` | 129 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_line_stackedbar` | 133 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_100pct_linebar` | 131 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_100pct_linebar` | 127 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_nested_linebar` | 137 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_nested_linebar` | 132 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_symbol_bar` | 138 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_symbols, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_symbol_stackedbar` | 144 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_symbols, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_symbol_bar` | 124 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_symbols, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_symbol_stackedbar` | 130 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_symbols, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |

## Notable Overrides

- `set_line_count` — Number of series rendered as lines vs bars
- `value_scale_line` / `value_scale_bar` — Separate Y axes for line and bar
- `value_scale_symbols` — Dedicated scale for symbol overlays
- `last_bar_value_projection` — Bar-specific projection (`project_bar_val_method`, `proj_bar_value`)
- `last_line_value_projection` — Line-specific projection (`project_line_val_method`, `proj_line_value`)
- `title_line` / `title_bar` — Separate axis titles for line and bar scales
