export const PERIOD_PAGE_SIZE = 30;

const PERIOD_ORDER = {
  'Last Completed Week': 1,
  'Last Completed Month': 2,
  'Last Completed Quarter': 3,
  'Year To Date': 4,
  'Quarter To Date': 5,
  'Month To Date': 6
};

const SIDE_ORDER = {
  current: 1,
  prior: 2
};

export function sortPeriodRowsForDisplay(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort(comparePeriodRows);
}

export function getPeriodPage(rows, requestedPage, pageSize = PERIOD_PAGE_SIZE) {
  const sortedRows = sortPeriodRowsForDisplay(rows);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = clampPage(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = sortedRows.slice(startIndex, startIndex + pageSize);

  return {
    rows: pageRows,
    currentPage,
    totalPages,
    totalRows,
    startRow: totalRows === 0 ? 0 : startIndex + 1,
    endRow: startIndex + pageRows.length
  };
}

function comparePeriodRows(left, right) {
  return compareValue(periodOrder(left.period_type), periodOrder(right.period_type))
    || compareValue(fiscalYearOrder(left.financial_year), fiscalYearOrder(right.financial_year))
    || compareValue(numberValue(left.week_of_year), numberValue(right.week_of_year))
    || compareValue(sideOrder(left.comparison_side), sideOrder(right.comparison_side))
    || compareValue(numberValue(left.comparable_week_slot), numberValue(right.comparable_week_slot))
    || String(left.week_ending || '').localeCompare(String(right.week_ending || ''));
}

function periodOrder(periodType) {
  return PERIOD_ORDER[periodType] || 999;
}

function sideOrder(side) {
  return SIDE_ORDER[side] || 999;
}

function fiscalYearOrder(financialYear) {
  const match = String(financialYear || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 999;
}

function compareValue(left, right) {
  return left === right ? 0 : left - right;
}

function clampPage(page, totalPages) {
  const parsed = Number(page);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), totalPages);
}
