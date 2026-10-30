export const PROPERTY_COLLECTIONS = [
  {
    type: 'apartment,flat,studio,penthouse',
    title: 'Apartments',
    subtitle: 'Apartments, flats, studios and penthouses',
    matches: ['apartment', 'flat', 'studio', 'penthouse'],
  },
  {
    type: 'villa,house,townhouse',
    title: 'Villas & houses',
    subtitle: 'Villas, houses and townhouses',
    matches: ['villa', 'house', 'townhouse'],
  },
  {
    type: 'commercial,office',
    title: 'Commercial spaces',
    subtitle: 'Offices and commercial listings',
    matches: ['commercial', 'office'],
  },
];
export const availabilityInfo = (property) => {
  if (property.status && property.status !== 'sale') return { stale: false, label: '' };
  const confirmedAt = property.availabilityConfirmedAt || property.updatedAt || property.createdAt;
  if (!confirmedAt) return { stale: true, label: 'Availability unconfirmed' };
  const days = Math.max(0, Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 86_400_000));
  // Match the server's 30-day confirmation window when older records lack the computed flag.
  const stale = property.availabilityNeedsConfirmation ?? days > 30;
  return {
    stale,
    label: stale
      ? 'Availability unconfirmed'
      : days === 0
        ? 'Confirmed today'
        : days === 1
          ? 'Confirmed yesterday'
          : `Confirmed ${days} days ago`,
  };
};

export const availabilityLabel = (property) =>
  property.status === 'unavailable'
    ? 'Unavailable'
    : property.status === 'sold'
      ? 'Sold'
      : property.status === 'rented'
        ? 'Rented'
        : property.purpose === 'rent'
          ? 'For rent'
          : 'For sale';
