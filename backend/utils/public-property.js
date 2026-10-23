export function publicProperty(property) {
  if (!property) return property;
  const result = property?.toObject ? property.toObject() : { ...property };
  const precision = result.locationPrecision === 'exact' ? 'exact' : 'approximate';
  result.locationPrecision = precision;
  result.availabilityConfirmedAt ||= result.updatedAt || result.createdAt || null;
  result.availabilityNeedsConfirmation = Boolean(result.status === 'sale' && result.availabilityConfirmedAt && Date.now() - new Date(result.availabilityConfirmedAt).getTime() > 30 * 24 * 60 * 60 * 1000);

  if (precision === 'approximate' && Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
    // Two decimal places keeps a stable neighborhood-level pin without sending the seller's exact coordinates.
    result.latitude = Math.round(result.latitude * 100) / 100;
    result.longitude = Math.round(result.longitude * 100) / 100;
  }
  return result;
}
