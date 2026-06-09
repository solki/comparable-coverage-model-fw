import test from 'node:test';
import assert from 'node:assert/strict';

import { getPeriodPage, PERIOD_PAGE_SIZE, sortPeriodRowsForDisplay } from '../src/periodTable.js';

test('sortPeriodRowsForDisplay orders rows by period, financial year, week, and side', () => {
  const rows = [
    { id: 'ytd-prior', period_type: 'Year to Date', financial_year: '24-25', week_of_year: 49, comparison_side: 'prior', week_ending: '2025-06-08' },
    { id: 'last-week-current-week-49', period_type: 'Last Week', financial_year: '25-26', week_of_year: 49, comparison_side: 'current', week_ending: '2026-06-07' },
    { id: 'last-week-current-week-48', period_type: 'Last Week', financial_year: '25-26', week_of_year: 48, comparison_side: 'current', week_ending: '2026-05-31' },
    { id: 'last-week-prior', period_type: 'Last Week', financial_year: '25-26', week_of_year: 49, comparison_side: 'prior', week_ending: '2026-06-07' },
    { id: 'last-month-current', period_type: 'Last Month', financial_year: '25-26', week_of_year: 45, comparison_side: 'current', week_ending: '2026-05-10' }
  ];

  const sorted = sortPeriodRowsForDisplay(rows);

  assert.deepEqual(sorted.map((row) => row.id), [
    'last-week-current-week-48',
    'last-week-current-week-49',
    'last-week-prior',
    'last-month-current',
    'ytd-prior'
  ]);
});

test('getPeriodPage returns 30 rows per page with display metadata', () => {
  const rows = Array.from({ length: 138 }, (_, index) => ({
    id: `row-${index + 1}`,
    period_type: 'Year to Date',
    financial_year: '25-26',
    week_of_year: index + 1,
    comparison_side: 'current',
    week_ending: `2026-01-${String(index + 1).padStart(2, '0')}`
  }));

  const page = getPeriodPage(rows, 5);

  assert.equal(PERIOD_PAGE_SIZE, 30);
  assert.equal(page.rows.length, 18);
  assert.equal(page.currentPage, 5);
  assert.equal(page.totalPages, 5);
  assert.equal(page.startRow, 121);
  assert.equal(page.endRow, 138);
  assert.equal(page.totalRows, 138);
});
