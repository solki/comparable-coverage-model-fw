export function applyMaskGenerationLimit(rows, { enabled, limit }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const fullRowCount = safeRows.length;
  const numericLimit = Number(limit);
  const limitApplied = Boolean(enabled && Number.isFinite(numericLimit) && numericLimit > 0 && fullRowCount > numericLimit);

  return {
    rows: limitApplied ? safeRows.slice(0, numericLimit) : safeRows,
    fullRowCount,
    limitApplied
  };
}
