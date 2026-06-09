export const mockSourceRows = [
  sourceRow({ week: 1, month: 1, fy: '24-25', weekEnding: '2024-07-07', lastFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 2, month: 2, fy: '24-25', weekEnding: '2024-07-14', lastFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 3, month: 3, fy: '24-25', weekEnding: '2024-07-21', lastFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 4, month: 11, fy: '24-25', weekEnding: '2025-05-04', lastFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 5, month: 12, fy: '24-25', weekEnding: '2025-06-01', lastFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 9, month: 2, fy: '25-26', weekEnding: '2025-08-31', currentFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 10, month: 3, fy: '25-26', weekEnding: '2025-09-07', currentFy: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 11, month: 4, fy: '25-26', weekEnding: '2025-09-14', currentFy: 'Y', lastMonth: 'Y', storeCode: '21CH' }),
  sourceRow({ week: 12, month: 5, fy: '25-26', weekEnding: '2025-09-21', currentFy: 'Y', currentMonth: 'Y', storeCode: '21CH' }),
  sourceRow({
    week: 11,
    month: 4,
    fy: '25-26',
    weekEnding: '2025-09-14',
    currentFy: 'Y',
    lastMonth: 'Y',
    storeCode: '99NEW',
    storeName: 'New Store',
    region: 'VIC/TAS',
    commencementDate: '2025-09-10'
  }),
  sourceRow({
    week: 11,
    month: 4,
    fy: '25-26',
    weekEnding: '2025-09-14',
    currentFy: 'Y',
    lastMonth: 'Y',
    storeCode: '88CLS',
    storeName: 'Closed Store',
    region: 'QLD',
    closureDate: '2025-09-13'
  })
];

function sourceRow({
  week,
  month,
  fy,
  weekEnding,
  storeCode,
  storeName = 'Castle Hill',
  region = 'NSW/ACT',
  currentFy = 'N',
  currentMonth = 'N',
  lastMonth = 'N',
  lastFy = 'N',
  commencementDate = '2010-01-01',
  closureDate = ''
}) {
  return {
    Date: weekEnding,
    'Week Ending': weekEnding,
    Metric: 'S - Line Sell Total',
    Value: 100,
    'Store Code': storeCode,
    'Store Name': storeName,
    Region: region,
    'Month of Year': month,
    'Week Of Year': week,
    'Financial Year': fy,
    'FC Current FY Flag': currentFy,
    'FC Current Month Flag': currentMonth,
    'FC Last Month Flag': lastMonth,
    'FC Last FY Flag': lastFy,
    'FC YTD Flag': currentFy,
    'Store Trading Commencement date': commencementDate,
    'Store Closure Date': closureDate
  };
}

