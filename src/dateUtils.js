export function cleanString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function parseDateOnly(value) {
  const raw = cleanString(value);
  if (!raw) {
    return { valid: true, iso: null, empty: true };
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return validateDateParts(Number(year), Number(month), Number(day), raw);
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return validateDateParts(Number(year), Number(month), Number(day), raw);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, iso: null, empty: false, raw };
  }

  return validateDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(), raw);
}

export function normalizeDate(value) {
  const parsed = parseDateOnly(value);
  return parsed.valid ? parsed.iso : null;
}

export function subtractDays(isoDate, days) {
  const parsed = parseDateOnly(isoDate);
  if (!parsed.valid || !parsed.iso) return null;

  const date = fromIsoDate(parsed.iso);
  date.setUTCDate(date.getUTCDate() - days);
  return toIsoDate(date);
}

export function minDate(values) {
  const dates = Array.from(values)
    .map((value) => normalizeDate(value))
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}

export function maxDate(values) {
  const dates = Array.from(values)
    .map((value) => normalizeDate(value))
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] || null;
}

export function addDays(isoDate, days) {
  const parsed = parseDateOnly(isoDate);
  if (!parsed.valid || !parsed.iso) return null;

  const date = fromIsoDate(parsed.iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function validateDateParts(year, month, day, raw) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;

  return {
    valid,
    iso: valid ? toIsoDate(date) : null,
    empty: false,
    raw
  };
}

function fromIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

