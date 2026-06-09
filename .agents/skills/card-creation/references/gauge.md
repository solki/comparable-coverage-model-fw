# Single Value, Gauges & Multi-Value (16 types)

## Single Value & Gauges (14 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_singlevalue` | 25 | general, header_footer, hover_text_settings, number_format, colors |
| `badge_filledgauge` | 35 | general, target, min_max, number_format |
| `badge_gauge` | 51 | general, value_label, radial_labels, range_1 through range_6 |
| `badge_facegauge` | 11 | general, green_range, yellow_range, red_range |
| `badge_shapegauge` | 58 | general, range_1 through range_10, out_of_range, data_label_settings, hover_text_settings |
| `badge_compgauge` | 20 | general, hover_text_settings, number_format |
| `badge_compfillgauge_basic` | 15 | general, hover_text_settings, number_format |
| `badge_compfillgauge_adv` | 15 | general, hover_text_settings, number_format |
| `badge_progressbar` | 20 | general, color_range_1 through color_range_4 |
| `badge_radial_progress` | 24 | general, hover_text_settings, color_range_1 through color_range_4 |
| `badge_multi_radial_progress` | 15 | general, data_label_settings, hover_text_settings |
| `badge_in_range_gauge` | 22 | general, fixed_values, value_text, range_text, label_text |
| `badge_imagegauge` | 4 | general |
| `badge_bullet` | 98 | general, legend, grid_lines, data_label_settings, value_scale_x, category_scale_y, hover_text_settings, hints, number_format, scale_marker, colors |

### Gauge Overrides

- `value_type` / `value_format` / `value_label` — Value display config
- `target_value` / `target_label` / `target_line_color` — Target line (filledgauge)
- `min_value` / `max_value` — Gauge range
- `radial_style` / `radial_indicator` — Gauge appearance
- `range1_min` through `range10_max` / `range1_color` through `range10_color` — Color ranges (shapegauge)
- `out_of_range_fill_color` / `out_of_range_symbol` — Out-of-range handling (shapegauge)
- `green_range` / `yellow_range` / `red_range` — Traffic light ranges (facegauge)
- `fill_color` / `bkg_ring_style` — Radial progress styling
- `image_fit` / `default_imageurl` — Image gauge (only 4 overrides)

## Multi-Value (2 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_multi_value` | 69 | general, title_options, value_options, change_value_options, additional_text_options, date_grain_options, tooltip_options, number_format |
| `badge_multi_value_cols` | 63 | general, title_options, value_options, change_value_options, additional_text_options, tooltip_options, number_format |

### Multi-Value Overrides

- `gauge_layout` / `gauge_sizing` / `item_padding` — Layout configuration
- `title_text` / `title_font_color` — Per-value title styling
- `hide_single_value` / `single_value_type` / `value_font_color` — Value display
- `hide_change_value` / `comp_val_displayed` / `comp_data_used` — Comparison value config
- `addl_text` / `addl_text_font_color` — Additional text per metric
- `show_date_grain` / `date_grain_font_color` — Date grain display (multi_value only)
- `tooltip1_value_type` through `tooltip3_value_type` — Tooltip metric selection
