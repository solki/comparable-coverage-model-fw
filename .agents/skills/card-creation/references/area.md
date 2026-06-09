# Area Charts (16 types) + Dot Plot Charts (10 types)

## Area Charts

Overlay, stacked, 100% area, with curved and step variants in both orientations.

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_vert_area_overlay` | 109 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_area_overlay` | 107 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_100pct_area` | 92 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, gradient_colors, colors |
| `badge_horiz_100pct_area` | 91 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_vert_curved_area_overlay` | 109 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_curved_area_overlay` | 107 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_curved_stacked_area` | 112 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_curved_stacked_area` | 110 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_curved_100pct_area` | 92 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, gradient_colors, colors |
| `badge_horiz_curved_100pct_area` | 91 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_vert_step_area_overlay` | 109 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_step_area_overlay` | 107 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_step_stacked_area` | 133 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_step_stacked_area` | 131 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_step_100pct_area` | 92 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, gradient_colors, colors |
| `badge_horiz_step_100pct_area` | 91 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, gradient_colors, colors |

**Area notes:** No bar_settings. Vertical variants include `data_table`; horizontal do not. 100% variants omit `scale_marker`. Curved, step, and standard variants share identical override structures.

## Dot Plot Charts

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_vert_dotplot_overlay` | 121 | general, legend, grid_lines, data_label_settings, value_scale_(left), category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_dotplot_overlay` | 117 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_multi_dotplot` | 144 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_multi_dotplot` | 139 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_stacked_dotplot` | 149 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_stacked_dotplot` | 144 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_line_multi_dotplot` | 131 | general, legend, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_line_multi_dotplot` | 125 | general, legend, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |
| `badge_vert_line_stacked_dotplot` | 134 | general, legend, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_line_stacked_dotplot` | 128 | general, legend, grid_lines, data_label_settings, value_scale_line, value_scale_bar, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |

**Dot plot notes:** No bar_settings. Line + dot variants have dual scales (`value_scale_line` and `value_scale_bar`). All types support trellis_tiered_date_settings.
