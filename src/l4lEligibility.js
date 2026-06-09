import { REASON_CODES } from './constants.js';
import { parseDateOnly, subtractDays } from './dateUtils.js';

export function evaluateStoreEligibility(store, period) {
  const commencementValue = store.store_trading_commencement_date ?? store['Store Trading Commencement date'];
  const closureValue = store.store_closure_date ?? store['Store Closure Date'];
  const currentStart = parseDateOnly(period.current_period_start_date);
  const currentEnd = parseDateOnly(period.current_period_end_date);

  if (!currentStart.valid || !currentStart.iso || !currentEnd.valid || !currentEnd.iso) {
    return { eligible: false, reason_code: REASON_CODES.invalidPeriodDates };
  }

  if (!commencementValue) {
    return { eligible: false, reason_code: REASON_CODES.missingCommencementDate };
  }

  const commencement = parseDateOnly(commencementValue);
  if (!commencement.valid || !commencement.iso) {
    return { eligible: false, reason_code: REASON_CODES.invalidCommencementDate };
  }

  const closure = parseDateOnly(closureValue);
  if (closureValue && (!closure.valid || !closure.iso)) {
    return { eligible: false, reason_code: REASON_CODES.invalidClosureDate };
  }

  const cutoff = subtractDays(currentStart.iso, 6);
  if (commencement.iso > cutoff) {
    return { eligible: false, reason_code: REASON_CODES.commencedTooLate };
  }

  if (closure.iso && closure.iso < currentEnd.iso) {
    return { eligible: false, reason_code: REASON_CODES.closedBeforePeriodEnd };
  }

  return { eligible: true, reason_code: REASON_CODES.included };
}

