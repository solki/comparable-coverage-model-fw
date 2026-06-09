# Maps (42 types)

## Core Maps (6 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_world_map` | 113 | theme, general, diverging, hover_legend, data_label_settings, hover_text, values, number_format, ranges, cities |
| `badge_map` | 116 | theme, general, diverging, hover_legend, data_label_settings, hover_text, values, number_format, ranges, cities |
| `badge_map_us_state` | 116 | theme, general, diverging, hover_legend, data_label_settings, hover_text, values, number_format, ranges, cities |
| `badge_map_us_county` | 116 | theme, general, diverging, hover_legend, data_label_settings, hover_text, values, number_format, ranges, cities |
| `badge_map_latlong` | 27 | general, symbols, scale, legend, hover_text, background, cities |
| `badge_map_latlong_route` | 19 | general, routes, scale, legend, hover_text, background, cities |

## Country/Region Maps (36 types, all 114 overrides)

All share identical categories: theme, general, diverging, hover_legend, data_label_settings, hover_text, values, number_format, ranges, cities.

`badge_map_africa`, `badge_map_asia`, `badge_map_australia`, `badge_map_austria`, `badge_map_brazil`, `badge_map_canada`, `badge_map_chile`, `badge_map_china`, `badge_map_europe`, `badge_map_france`, `badge_map_france2016`, `badge_map_france_dept` (115), `badge_map_germany`, `badge_map_ghana`, `badge_map_india`, `badge_map_indonesia`, `badge_map_italy`, `badge_map_japan`, `badge_map_malaysia`, `badge_map_mexico`, `badge_map_middle_east`, `badge_map_new_zealand`, `badge_map_nigeria`, `badge_map_north_america`, `badge_map_panama`, `badge_map_peru`, `badge_map_philippines`, `badge_map_portugal`, `badge_map_south_america`, `badge_map_south_korea`, `badge_map_spain`, `badge_map_switzerland`, `badge_map_uae`, `badge_map_uk_area`, `badge_map_uk_postal`, `badge_map_united_kingdom`

## Notable Overrides

- `color_theme` / `use_custom_gradient_colors` / `num_colors` — Choropleth theming
- `balanced_distribution` / `auto_zoom` / `hide_no_data_items` — Map behavior
- `show_diverging` / `diverging_range_count` / `midpoint_value_type` — Diverging color scale
- `range_1_text` / `range_1_min` / `range_1_max` — Manual range definitions
- `show_cities` — City markers overlay
- `hover_always_on_map` — Persistent hover tooltips
- `symbol_color` / `symbol_size` / `symbol_transparency` — Lat/long point styling
- `map_bkg_color` / `bkg_area_fill_color` / `ocean_fill_color` — Map background (latlong)
- `routes` — Route path config (latlong_route)
- `region_stroke_color` — Border styling (latlong)
