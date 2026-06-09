# Data Science Charts (6 types)

| Chart Type | Overrides | Key Categories |
|-----------|-----------|----------------|
| `badge_ds_forecasting` | 37 | general, model_type, display, confidence_interval, hover_text_settings |
| `badge_ds_outliers` | 40 | general, model_type, display, outlier_sensitivity, hover_text_settings |
| `badge_ds_pred_modeling` | 22 | general, model_type, model_options, display |
| `badge_ds_spc` | 58 | general, control_chart_type, center_line, control_limits, spec_limits, zones, hover_text_settings, number_format |
| `badge_correlation_matrix` | 26 | general, color_scale, data_label_settings, hover_text_settings, number_format |
| `badge_confusion_matrix` | 26 | general, color_scale, data_label_settings, hover_text_settings, number_format |

## Notable Overrides

- **Forecasting**: `forecast_model` (Auto/Linear/Exponential/ARIMA), `num_periods`, `confidence_level`
- **Outliers**: `outlier_model` (Z-Score/IQR/DBSCAN), `sensitivity`, `show_outlier_labels`
- **Predictive**: `pred_model_type` (Linear Regression/Logistic/etc), `target_column`, `feature_columns`
- **SPC (Statistical Process Control)**: `chart_type` (Xbar-R/Xbar-S/p/np/c/u), `show_center_line`, `show_control_limits`, `show_spec_limits`, `show_zones` (A/B/C)
- **Correlation Matrix**: `color_min`/`color_mid`/`color_max`, `show_values`, `show_significance`
- **Confusion Matrix**: `show_percentages`, `color_scale_type` (Sequential/Diverging)
