# Statistical Charts (8 types)

Histograms, box plots, waterfall, scatter, and XY line.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_vert_histogram` | 122 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_histogram` | 111 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_boxplot` | 105 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, colors |
| `badge_horiz_boxplot` | 100 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, colors |
| `badge_vert_waterfall` | 106 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, colors |
| `badge_horiz_waterfall` | 99 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, colors |
| `badge_xy_line` | 126 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, colors |
| `badge_xybubble` | 122 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, bubble_size, quadrant_lines, colors |

## Notable Overrides

- **Histogram**: `num_buckets`, `bucket_width` — Bin configuration
- **Box Plot**: `show_outliers`, `show_mean`, `whisker_style` (IQR/MinMax) — Statistical display
- **Waterfall**: `total_bar_color`, `positive_bar_color`, `negative_bar_color`, `show_connectors` — Step colors and connector lines
- **XY Line**: Like a line chart but uses X-Y coordinate pairs instead of category axis
- **XY Bubble**: `bubble_min_size`, `bubble_max_size`, `bubble_transparency` — Bubble sizing
- **Quadrant Lines** (xybubble): `show_quadrant_lines`, `quadrant_x_value`, `quadrant_y_value`, `quadrant_line_color` — Four-quadrant overlay
