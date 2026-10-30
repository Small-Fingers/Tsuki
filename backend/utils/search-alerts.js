const allowedTypes = new Set([
  'flat',
  'apartment',
  'villa',
  'house',
  'studio',
  'penthouse',
  'office',
  'townhouse',
  'plot',
  'commercial',
]);

export function normalizeFilters(input = {}) {
  const filters = {};
  for (const key of ['city', 'propertyType', 'purpose', 'bhk', 'minPrice', 'maxPrice']) {
    if (input[key] === undefined || input[key] === '') continue;
    if (key === 'purpose' && !['sale', 'rent'].includes(input[key])) continue;
    if (key === 'propertyType') {
      const types = [
        ...new Set(
          String(input[key])
            .split(',')
            .filter((type) => allowedTypes.has(type)),
        ),
      ];
      if (types.length) filters[key] = types.join(',');
    } else if (key === 'city') filters[key] = String(input[key]).trim().slice(0, 100);
    else if (key === 'bhk' && ['1', '2', '3', '4', '5+'].includes(String(input[key])))
      filters[key] = String(input[key]);
    else if (
      ['minPrice', 'maxPrice'].includes(key) &&
      Number.isFinite(Number(input[key])) &&
      Number(input[key]) >= 0
    )
      filters[key] = Number(input[key]);
    else if (key === 'purpose') filters[key] = input[key];
  }
  return filters;
}

export function buildSearchAlertQuery(filters, createdAfter) {
  const query = { status: 'sale', createdAt: { $gt: createdAfter } };
  if (filters.city) {
    const escapedCity = filters.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$and = [
      { $or: [{ city: new RegExp(escapedCity, 'i') }, { area: new RegExp(escapedCity, 'i') }] },
    ];
  }
  if (filters.purpose) query.purpose = filters.purpose;
  if (filters.propertyType) query.propertyType = { $in: filters.propertyType.split(',') };
  if (filters.bhk) query.bhk = filters.bhk === '5+' ? { $gte: '5' } : filters.bhk;
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    query.price = {
      ...(filters.minPrice !== undefined ? { $gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { $lte: filters.maxPrice } : {}),
    };
  }
  return query;
}
