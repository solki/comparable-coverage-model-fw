import { deriveRuntimePeriodDefinitions, validatePeriodDefinitions } from './periodDefinition.js';

export function derivePeriodDefinitions(sourceRows) {
  return {
    rows: deriveRuntimePeriodDefinitions(sourceRows),
    source: 'sourceMetrics runtime derivation',
    diagnostics: {}
  };
}

export function validatePeriods(rows) {
  return validatePeriodDefinitions(rows);
}
