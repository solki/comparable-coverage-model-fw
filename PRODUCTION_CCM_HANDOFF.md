# Production CCM Dataset Handoff

This note documents the future Domo Workflow / ETL handoff needed to produce a dashboard-ready production CCM dataset. It is a design handoff only. The current repository does not modify Workflow definitions, Magic ETL/DataFlow definitions, source datasets, AppDB schemas, dataset mappings, or published Domo objects.

## Target Dataset Grain

The future final dataset should contain one row per original source dataset row, with period-specific CCM field groups joined back onto the raw source row.

LFL OFF remains inclusive: dashboards using LFL OFF should keep the original source rows in the selected comparison window even when a CCM include flag is `N`.

LFL ON filters to rows where the selected period include flag is `Y`.

## Expected Join Keys

Join CCM outputs back to source rows using:

- `store_code`
- `metric`
- `week_ending`

The production CCM output should also preserve period context so downstream joins can select the intended period field group:

- `period_lens`
- `comparison_mode`
- `comparison_side`
- `comparable_slot`

Current AppDB selected-scope output uses compatible existing fields:

- `period_type`
- `comparison_side`
- `comparable_week_slot`
- `store_code`
- `metric`
- `week_ending`
- `mask_include_flag`
- `final_reason_code`

## Required Period Field Groups

The final row-level dataset should include these period-specific CCM fields:

- `lcw_include_flag`, `lcw_comparison_side`, `lcw_reason_code`
- `lcm_include_flag`, `lcm_comparison_side`, `lcm_reason_code`
- `lcq_include_flag`, `lcq_comparison_side`, `lcq_reason_code`
- `ytd_include_flag`, `ytd_comparison_side`, `ytd_reason_code`
- `qtd_include_flag`, `qtd_comparison_side`, `qtd_reason_code`
- `mtd_include_flag`, `mtd_comparison_side`, `mtd_reason_code`

Period abbreviations:

- `lcw`: Last Completed Week
- `lcm`: Last Completed Month
- `lcq`: Last Completed Quarter
- `ytd`: Year To Date
- `qtd`: Quarter To Date
- `mtd`: Month To Date

## Period Comparison Rules

- Last Completed Week compares against Previous Period.
- Last Completed Month compares against Previous Period.
- Last Completed Quarter compares against Previous Period.
- Year To Date compares against Same Period Last Year.
- Quarter To Date compares against Same Period Last Year.
- Month To Date compares against Same Period Last Year.
- Quarter logic uses 13 fiscal weeks.

Comparable slots that exist on only one required comparison side must be excluded from LFL ON with `UNPAIRED_PERIOD_WEEK`, but remain visible for LFL OFF.

Week 53 must be shown where relevant and automatically excluded with `WEEK_53_EXCLUDED`.

## Workflow Output Requirements

The future Workflow should output full production CCM rows for all required Store x Metric x Period Lens combinations, not only the current selected-scope prototype output.

For each Store + Metric + Period Lens + Comparison Mode + Comparable Slot, the Workflow / ETL output should include:

- `store_code`
- `metric`
- `week_ending`
- `period_lens`
- `comparison_mode`
- `comparison_side`
- `comparable_slot`
- `include_flag`
- `reason_code`

The output may use current prototype field names during transition:

- `period_type` as Period Lens
- `comparable_week_slot` as Comparable Slot
- `mask_include_flag` as include flag
- `final_reason_code` as reason code

## ETL Join Requirements

The ETL should:

1. Start from the raw source dataset so the final dataset remains one row per original source row.
2. Normalize join keys to the same formats used by CCM:
   - Store code as string.
   - Metric as source metric name.
   - Week ending as date.
3. Join each period-specific CCM output group by `store_code + metric + week_ending`.
4. Pivot or conditionally aggregate CCM rows into the required period-specific field groups.
5. Preserve source fields needed by dashboards.
6. Preserve LFL OFF rows even when the matching include flag is `N`.

## Dashboard Filtering

For a selected period:

- LFL ON: filter to `<period>_include_flag = Y`.
- LFL OFF: do not filter out rows by CCM include flag; keep all rows in the comparison window.

Reason fields should be available for explainability tables and exclusion drilldowns.

## Not Implemented In This Repo

The following remain manual / future Domo-side work:

- Full production CCM mask generation orchestration.
- Workflow definition changes.
- Magic ETL / DataFlow changes.
- Production dataset creation or replacement.
- Dataset alias or card mapping updates in Domo.
- AppDB schema changes for additional persisted fields.
- Any mutation of the read-only `sourceMetrics` dataset.
