# Text + Marimekko + Faceted Bar (6 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_textbox` | 3 | general |
| `badge_dynamic_textbox` | 3 | general |
| `badge_vert_marimekko` | 90 | general, legend, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, data_table, number_format, gradient_colors, colors |
| `badge_horiz_marimekko` | 88 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, gradient_colors, colors |
| `badge_vert_facetedbar` | 126 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_y, category_scale_x, hover_text_settings, hints, trellis_tiered_date_settings, data_table, number_format, scale_marker, gradient_colors, colors |
| `badge_horiz_facetedbar` | 120 | general, legend, bar_settings, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, trellis_tiered_date_settings, number_format, scale_marker, gradient_colors, colors |

## Notable Overrides

- **Textbox**: `text_content` (HTML), `background_color`. Only 3 overrides. Used for static text content on dashboards.
- **Dynamic Textbox**: Same as textbox but supports macros/variables in `text_content`.
- **Marimekko**: Variable-width bar chart. Each bar's width represents a secondary value. Like a stacked bar but with proportional widths.
- **Faceted Bar**: Small multiples / trellis bar chart. Each facet shows a bar chart for one series value.
