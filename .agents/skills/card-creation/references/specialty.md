# Specialty Charts (16 types)

Treemap, funnel, waffle, word cloud, stream, slope, bump, Pareto, heatmap, Gantt, and calendar.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_treemap` | 52 | general, legend, data_label_settings, hover_text_settings, number_format, gradient_colors, colors |
| `badge_funnel` | 52 | general, legend, data_label_settings, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_funnel_bars` | 136 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_funnel_swing` | 98 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_waffle` | 32 | general, legend, data_label_settings, hover_text_settings, number_format, colors |
| `badge_word_cloud` | 16 | general, font_settings, number_format, colors |
| `badge_stream` | 114 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_stream_funnel` | 110 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_slope` | 79 | general, legend, data_label_settings, hover_text_settings, hints, number_format, colors |
| `badge_bump` | 52 | general, legend, data_label_settings, hover_text_settings, number_format, colors |
| `badge_pareto` | 138 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_bar, value_scale_line, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_heatmap` | 51 | general, legend, data_label_settings, hover_text_settings, number_format, gradient_colors, colors |
| `badge_gantt` | 108 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, data_table, number_format, scale_marker, colors |
| `badge_gantt_dep` | 132 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, data_table, number_format, scale_marker, colors |
| `badge_gantt_percent` | 131 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, data_table, number_format, scale_marker, colors |
| `badge_calendar` | 60 | general, data_label_settings, hover_text_settings, number_format, gradient_colors |

## Notable Overrides

- **Treemap**: `min_font_size`, `max_font_size`, `show_parent_labels`, `parent_label_color`
- **Funnel**: `funnel_style`, `show_conversion`, `conversion_format`
- **Funnel Bars**: Behaves like a bar chart (full grid_lines, scale, bar_settings)
- **Waffle**: `waffle_shape`, `waffle_icon`, `squares_per_row`
- **Word Cloud**: `min_font_size`, `max_font_size`, `font_family`, `orientation`
- **Stream**: Like an area chart with full axis controls
- **Slope**: `show_start_labels`, `show_end_labels`, `show_point_values`
- **Bump**: `show_rank_numbers`, `highlight_position`
- **Pareto**: Dual-axis (bar_settings + value_scale_bar + value_scale_line)
- **Heatmap**: `color_theme`, `gradient_start_fill_color`, `gradient_end_fill_color`
- **Gantt**: `show_dependencies`, `show_percent_complete`, `task_height`
- **Calendar**: `calendar_view` (Month/Week), `start_day`, `show_cell_values`
