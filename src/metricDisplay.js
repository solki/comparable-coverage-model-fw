const METRIC_DISPLAY_NAMES = {
  'S - Line Sell Total': 'Sales',
  'Traffic In': 'Foot Traffic',
  'Bed Match': 'BedMatch'
};

export function getMetricDisplayName(metric) {
  return METRIC_DISPLAY_NAMES[metric] || metric || '';
}
